import './helpers/isolate-env';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { setSystemSetting } from '../lib/allergy';
import { getStudentCategory } from '../lib/october-2026-timetable';
import { TEACHER_ORDER_ACCESS, teacherGuestCookieName } from '../lib/teacher-orders';
import * as parentOrders from '../app/api/parent/orders/route';
import * as parentChildren from '../app/api/parent/children/route';
import { POST as verifyParentOrder } from '../app/api/parent/orders/verify/route';
import { GET as menuGet } from '../app/api/menu/route';
import * as adminOrders from '../app/api/admin/orders/route';
import * as adminKitchen from '../app/api/admin/kitchen/route';
import { GET as adminUsers } from '../app/api/admin/users/route';
import * as staffTeacherOrders from '../app/api/staff/teacher-orders/route';
import { GET as teacherOrderGet } from '../app/api/teacher/orders/[id]/route';
import { POST as teacherVerify } from '../app/api/teacher/orders/verify/route';

const env = process.env as Record<string, string | undefined>;
const MON = '2099-01-05';
const TUE = '2099-01-06';

let fs: FakeFirestore;
let parent: Record<string, string>; // par_usr_parent
let other: Record<string, string>; // par_usr_other
let staff: Record<string, string>;
let admin: Record<string, string>;

function seedMenu(date: string, cat: string, mealId: string, qty = 50) {
  const id = `menu_${date}_${cat.toLowerCase()}_${mealId}`;
  fs.seed('menus', id, { id, date, studentCategory: cat, mealId, isHoliday: false, availableQuantity: qty, maxQuantity: qty, orderingDeadline: '08:30', isActive: true });
}

beforeEach(async () => {
  fs = useFakeFirestore();
  parent = await signedInAs(fs, 'PARENT');
  other = await signedInAs(fs, 'PARENT', 'usr_other');
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  // Checkout needs the payer's phone.
  fs.seed('users', 'usr_parent', { id: 'usr_parent', email: 'usr_parent@example.com', name: 'PARENT', role: 'PARENT', phone: '9876543210' });
  fs.seed('users', 'usr_other', { id: 'usr_other', email: 'usr_other@example.com', name: 'OTHER', role: 'PARENT', phone: '9123456780' });

  fs.seed('students', 'stu_mine', { id: 'stu_mine', parentId: 'par_usr_parent', name: 'Riya', grade: '3', division: 'A', rollNo: '7', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_sib', { id: 'stu_sib', parentId: 'par_usr_parent', name: 'Arjun', grade: '8', division: 'B', rollNo: '12', studentCategory: 'Secondary', isActive: true });
  fs.seed('students', 'stu_theirs', { id: 'stu_theirs', parentId: 'par_usr_other', name: 'Kabir', grade: '3', division: 'A', rollNo: '9', studentCategory: 'Primary', allergies: 'Peanut', isActive: true });

  fs.seed('meals', 'meal_soya', { id: 'meal_soya', name: 'Soyabean Masala', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_paneer', { id: 'meal_paneer', name: 'Paneer Rice', price: 90, category: 'LUNCH', isVegetarian: true, allergens: 'Milk' });

  env.ALLOW_MOCK_PAYMENTS = 'true';
  await setSystemSetting('ALLOW_ALLERGY_ORDERS', 'true');
});

afterEach(() => {
  delete env.ALLOW_MOCK_PAYMENTS;
  setFirestoreForTesting(null);
});

const checkout = (cartItems: unknown[], who = parent, key = `K-${Math.random()}`) =>
  parentOrders.POST(jsonRequest('/api/parent/orders', 'POST', { cartItems, paymentMethod: 'UPI', idempotencyKey: key }, who));

function seedPaidOrder(id: string, parentId: string, items: Array<{ studentId: string; date: string; mealId?: string; hasAllergyAlert?: boolean }>, fields: Record<string, unknown> = {}) {
  fs.seed('orders', id, { id, parentId, totalAmount: 80 * items.length, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', createdAt: '2099-01-01T04:00:00Z', ...fields });
  items.forEach((it, i) => {
    fs.seed('orderItems', `oit_${id}_${i}`, { id: `oit_${id}_${i}`, orderId: id, studentId: it.studentId, mealId: it.mealId || 'meal_soya', date: it.date, quantity: 1, unitPrice: 80, totalPrice: 80, hasAllergyAlert: Boolean(it.hasAllergyAlert) });
  });
}

// ---------------------------------------------------------------- 3. DATA PRIVACY (IDOR)

test("OK: checkout with another parent's studentId is refused and nothing is saved", async () => {
  seedMenu(MON, 'Primary', 'meal_soya');
  const res = await checkout([{ studentId: 'stu_theirs', mealId: 'meal_soya', date: MON, quantity: 1 }]);
  assert.equal(res.status, 403);
  assert.equal(fs.list('orders').length, 0);
  assert.equal(fs.list('pending_orders').length, 0);
});

test("OK: a parent cannot edit or delete another parent's child", async () => {
  const put = await parentChildren.PUT(jsonRequest('/api/parent/children', 'PUT', { id: 'stu_theirs', name: 'Hacked', allergies: '' }, parent));
  assert.equal(put.status, 404);
  const del = await parentChildren.DELETE(jsonRequest('/api/parent/children?id=stu_theirs', 'DELETE', undefined, parent));
  assert.equal(del.status, 404);
  const kid = fs.getDoc('students', 'stu_theirs');
  assert.equal(kid?.name, 'Kabir');
  assert.equal(kid?.allergies, 'Peanut');
  assert.equal(kid?.isActive, true);
  // and the list only has own children
  const list = await (await parentChildren.GET(jsonRequest('/api/parent/children', 'GET', undefined, parent))).json();
  assert.deepEqual(list.students.map((s: { id: string }) => s.id).sort(), ['stu_mine', 'stu_sib']);
});

test("OK: a parent cannot read another parent's order by id, nor see it in the list", async () => {
  seedPaidOrder('ORD-THEIRS', 'par_usr_other', [{ studentId: 'stu_theirs', date: MON }]);
  seedPaidOrder('ORD-MINE', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }]);
  const one = await (await parentOrders.GET(jsonRequest('/api/parent/orders?id=ORD-THEIRS', 'GET', undefined, parent))).json();
  assert.deepEqual(one.orders, []);
  const all = await (await parentOrders.GET(jsonRequest('/api/parent/orders', 'GET', undefined, parent))).json();
  assert.deepEqual(all.orders.map((o: { id: string }) => o.id), ['ORD-MINE']);
  const patch = await parentOrders.PATCH(jsonRequest('/api/parent/orders', 'PATCH', { orderId: 'ORD-THEIRS' }, parent));
  assert.equal(patch.status, 403);
});

test("OK: a parent cannot verify (or probe) another parent's order or pending checkout", async () => {
  seedPaidOrder('ORD-THEIRS', 'par_usr_other', [{ studentId: 'stu_theirs', date: MON }]);
  fs.seed('pending_orders', 'PEND-THEIRS', { id: 'PEND-THEIRS', parentId: 'par_usr_other', totalAmount: 80, cartItems: [] });
  for (const orderId of ['ORD-THEIRS', 'PEND-THEIRS', 'DOES-NOT-EXIST']) {
    const res = await verifyParentOrder(jsonRequest('/api/parent/orders/verify', 'POST', { orderId }, parent));
    assert.equal(res.status, 404, orderId);
  }
});

test("OK: /api/menu?childId= does not reveal another family's child name or allergies", async () => {
  seedMenu(MON, 'Primary', 'meal_soya');
  const asParent = await menuGet(jsonRequest(`/api/menu?date=${MON}&childId=stu_theirs`, 'GET', undefined, parent));
  assert.equal(asParent.status, 404);
  const anon = await menuGet(jsonRequest(`/api/menu?date=${MON}&childId=stu_theirs`, 'GET'));
  assert.equal(anon.status, 404);
  const own = await menuGet(jsonRequest(`/api/menu?date=${MON}&childId=stu_mine`, 'GET', undefined, parent));
  assert.equal(own.status, 200);
});

test('OK: teacher guest order cannot be read or verified without its token (wrong token, parent session, no cookie)', async () => {
  const id = 'TCH-AAAABBBBCCCCDDDD';
  fs.seed('teacher_orders', id, { id, teacherName: 'Mrs Rao', phone: '9000000000', paymentStatus: 'PAID', orderStatus: 'CONFIRMED', date: MON, userId: null, items: [] });
  fs.seed(TEACHER_ORDER_ACCESS, id, { orderId: id, tokenHash: crypto.createHash('sha256').update('right-token').digest('hex') });
  const ctx = { params: Promise.resolve({ id }) };
  const req = (headers: Record<string, string>) => jsonRequest(`/api/teacher/orders/${id}`, 'GET', undefined, headers);

  assert.equal((await teacherOrderGet(req({}), ctx)).status, 401);
  assert.equal((await teacherOrderGet(req({ cookie: `${teacherGuestCookieName(id)}=wrong-token` }), ctx)).status, 404);
  assert.equal((await teacherOrderGet(req({ cookie: `${teacherGuestCookieName(id)}=right-token-but-longer` }), ctx)).status, 404);
  assert.equal((await teacherOrderGet(req(parent), ctx)).status, 404);
  // a cookie for a different order does not open this one
  assert.equal((await teacherOrderGet(req({ cookie: `${teacherGuestCookieName('TCH-OTHER')}=right-token` }), ctx)).status, 401);
  assert.equal((await teacherOrderGet(req({ cookie: `${teacherGuestCookieName(id)}=right-token` }), { params: Promise.resolve({ id }) })).status, 200);

  const v = await teacherVerify(jsonRequest('/api/teacher/orders/verify', 'POST', { orderId: id }, { cookie: `${teacherGuestCookieName(id)}=wrong-token` }));
  assert.equal(v.status, 404);
  const vp = await teacherVerify(jsonRequest('/api/teacher/orders/verify', 'POST', { orderId: id }, parent));
  assert.equal(vp.status, 404);
});

test('OK: staff/admin order, kitchen, teacher-order and user routes reject a parent', async () => {
  seedPaidOrder('ORD-MINE', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }]);
  const g = (h: (r: Request) => Promise<Response>, url: string) => h(jsonRequest(url, 'GET', undefined, parent));
  const p = (h: (r: Request) => Promise<Response>, url: string, body: unknown) => h(jsonRequest(url, 'PATCH', body, parent));
  assert.equal((await g(adminOrders.GET, `/api/admin/orders?date=${MON}`)).status, 403);
  assert.equal((await p(adminOrders.PATCH, '/api/admin/orders', { orderId: 'ORD-MINE', orderStatus: 'COLLECTED', date: MON })).status, 403);
  assert.equal((await g(adminKitchen.GET, `/api/admin/kitchen?date=${MON}`)).status, 403);
  assert.equal((await p(adminKitchen.PATCH, '/api/admin/kitchen', { date: MON, status: 'COLLECTED' })).status, 403);
  assert.equal((await g(staffTeacherOrders.GET, `/api/staff/teacher-orders?date=${MON}`)).status, 403);
  assert.equal((await p(staffTeacherOrders.PATCH, '/api/staff/teacher-orders', { orderId: 'X', orderStatus: 'GIVEN' })).status, 403);
  assert.equal((await g(adminUsers, '/api/admin/users')).status, 403);
  assert.equal(fs.getDoc('orders', 'ORD-MINE')?.orderStatus, 'CONFIRMED');
});

// ---------------------------------------------------------------- 7. STAFF COUNTER

test('OK: staff cannot mark Collected an unpaid, cancelled, wrong-date or already-collected order', async () => {
  seedPaidOrder('ORD-UNPAID', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }], { paymentStatus: 'PENDING' });
  seedPaidOrder('ORD-CXL', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }], { paymentStatus: 'REFUNDED', orderStatus: 'CANCELLED' });
  seedPaidOrder('ORD-CXL-PAID', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }], { orderStatus: 'CANCELLED' });
  seedPaidOrder('ORD-TUE', 'par_usr_parent', [{ studentId: 'stu_mine', date: TUE }]);
  seedPaidOrder('ORD-OK', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }]);
  const give = (orderId: string, date = MON) => adminOrders.PATCH(jsonRequest('/api/admin/orders', 'PATCH', { orderId, orderStatus: 'COLLECTED', date }, staff));

  assert.equal((await give('ORD-UNPAID')).status, 400);
  assert.equal((await give('ORD-CXL')).status, 400);
  assert.equal((await give('ORD-CXL-PAID')).status, 400);
  assert.equal((await give('ORD-TUE')).status, 400, "Tuesday's order cannot be given on Monday's list");
  assert.equal((await give('ORD-OK')).status, 200);
  assert.equal((await give('ORD-OK')).status, 409);
  assert.equal((await give('NOPE')).status, 404);
});

test('BUG: one "Mark Given" collects every child in a multi-child order; there is no per-child handover', async () => {
  // Riya (3-A) and her brother Arjun (8-B) paid in one checkout for Monday.
  seedPaidOrder('ORD-SIBS', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }, { studentId: 'stu_sib', date: MON }]);
  // Only Riya comes to the counter; the staff screen sends exactly this.
  const res = await adminOrders.PATCH(jsonRequest('/api/admin/orders', 'PATCH', { orderId: 'ORD-SIBS', orderStatus: 'COLLECTED', date: MON }, staff));
  assert.equal(res.status, 200);
  const order = fs.getDoc('orders', 'ORD-SIBS');
  assert.equal(order?.serviceDates?.[MON]?.status, 'COLLECTED', "Arjun's meal is now also marked given");
  // the API has no studentId / orderItemId field: the state lives on the whole order per date
  assert.equal(order?.serviceDates?.[MON]?.studentId, undefined);
});

test('BUG: a child added by a parent shows as "Class Primary--, Roll #-" on the staff screen (no class/div/roll)', async () => {
  // Exactly what app/parent/children/page.tsx sends: name, dob, category only.
  const res = await parentChildren.POST(jsonRequest('/api/parent/children', 'POST', { name: 'Aarav Shah', dob: null, category: 'Primary', studentCategory: 'Primary', grade: 'Primary' }, parent));
  assert.equal(res.status, 201);
  const { student } = await res.json();
  assert.equal(student.grade, 'Primary');
  assert.equal(student.division, '-');
  assert.equal(student.rollNo, '-');
  // A second family's child with the same name in a different class looks identical.
  const res2 = await parentChildren.POST(jsonRequest('/api/parent/children', 'POST', { name: 'Aarav Shah', category: 'Primary', studentCategory: 'Primary', grade: 'Primary' }, other));
  const { student: twin } = await res2.json();
  seedPaidOrder('ORD-A1', 'par_usr_parent', [{ studentId: student.id, date: MON }]);
  seedPaidOrder('ORD-A2', 'par_usr_other', [{ studentId: twin.id, date: MON }]);
  const { orders } = await (await adminOrders.GET(jsonRequest(`/api/admin/orders?date=${MON}`, 'GET', undefined, staff))).json();
  const shown = orders.map((o: any) => `${o.items[0].studentName}|${o.items[0].studentGrade}|${o.items[0].studentDivision}|${o.items[0].studentRollNo}`);
  assert.equal(shown.length, 2);
  assert.equal(shown[0], shown[1], 'staff can only tell them apart by the order id');
});

test("BUG: a parent editing a child's name overwrites the school class ('3') with the category ('Primary')", async () => {
  const res = await parentChildren.PUT(jsonRequest('/api/parent/children', 'PUT', { id: 'stu_mine', name: 'Riya S', dob: null, category: 'Primary', studentCategory: 'Primary', grade: 'Primary' }, parent));
  assert.equal(res.status, 200);
  assert.equal(fs.getDoc('students', 'stu_mine')?.grade, 'Primary', 'was "3"');
  assert.equal(fs.getDoc('students', 'stu_mine')?.division, 'A');
});

test('BUG (LOW): staff can mark a teacher order for another date as GIVEN (no date check)', async () => {
  fs.seed('teacher_orders', 'TCH-TUE', { id: 'TCH-TUE', date: TUE, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', items: [] });
  const res = await staffTeacherOrders.PATCH(jsonRequest('/api/staff/teacher-orders', 'PATCH', { orderId: 'TCH-TUE', orderStatus: 'GIVEN' }, staff));
  assert.equal(res.status, 200);
  assert.equal(fs.getDoc('teacher_orders', 'TCH-TUE')?.orderStatus, 'GIVEN');
  assert.equal(fs.getDoc('teacher_orders', 'TCH-TUE')?.collectedBy, undefined, 'who handed it over is not recorded');
});

test('OK: kitchen bulk PATCH skips unpaid/cancelled/other-date orders', async () => {
  seedPaidOrder('ORD-OK', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }]);
  seedPaidOrder('ORD-UNPAID', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON }], { paymentStatus: 'PENDING' });
  seedPaidOrder('ORD-TUE', 'par_usr_parent', [{ studentId: 'stu_mine', date: TUE }]);
  const res = await adminKitchen.PATCH(jsonRequest('/api/admin/kitchen', 'PATCH', { date: MON, status: 'COLLECTED', orderIds: ['ORD-OK', 'ORD-UNPAID', 'ORD-TUE'] }, staff));
  const body = await res.json();
  assert.equal(body.skipped, 2);
  assert.equal(fs.getDoc('orders', 'ORD-UNPAID')?.serviceDates, undefined);
  assert.equal(fs.getDoc('orders', 'ORD-TUE')?.serviceDates, undefined);
});

// ---------------------------------------------------------------- 9. CATEGORIES AND ALLERGIES

test('BUG: with default settings a meal matching the child\'s allergy is sold (server only flags it)', async () => {
  fs.seed('students', 'stu_mine', { id: 'stu_mine', parentId: 'par_usr_parent', name: 'Riya', grade: '3', division: 'A', rollNo: '7', studentCategory: 'Primary', allergies: 'Milk', isActive: true });
  seedMenu(MON, 'Primary', 'meal_paneer');
  const res = await checkout([{ studentId: 'stu_mine', mealId: 'meal_paneer', date: MON, quantity: 1 }]);
  assert.equal(res.status, 200, await res.clone().text());
  const items = fs.list('orderItems');
  assert.equal(items.length, 1);
  assert.equal(items[0].hasAllergyAlert, true, 'order accepted, only flagged');

  // With the school policy switched off it is blocked server-side.
  await setSystemSetting('ALLOW_ALLERGY_ORDERS', 'false');
  const blocked = await checkout([{ studentId: 'stu_mine', mealId: 'meal_paneer', date: MON, quantity: 1 }]);
  assert.equal(blocked.status, 400);
  assert.match((await blocked.json()).error, /allergen/i);
});

test('OK: multi-child multi-date cart checks each line against its own child category, allergy and date', async () => {
  fs.seed('students', 'stu_mine', { id: 'stu_mine', parentId: 'par_usr_parent', name: 'Riya', grade: '3', division: 'A', rollNo: '7', studentCategory: 'Primary', allergies: 'Milk', isActive: true });
  seedMenu(MON, 'Primary', 'meal_paneer');
  seedMenu(MON, 'Secondary', 'meal_paneer');
  seedMenu(TUE, 'Secondary', 'meal_soya');

  // Arjun (Secondary) cannot buy a Primary-only dish even if the client claims Primary.
  seedMenu(TUE, 'Primary', 'meal_paneer');
  const wrongCat = await checkout([
    { studentId: 'stu_mine', mealId: 'meal_paneer', date: MON, quantity: 1 },
    { studentId: 'stu_sib', mealId: 'meal_paneer', date: TUE, quantity: 1, studentCategory: 'Primary' },
  ]);
  assert.equal(wrongCat.status, 400);
  assert.equal(fs.list('orderItems').length, 0);

  // Wrong date for a dish (soya only on Tuesday) is refused.
  const wrongDate = await checkout([{ studentId: 'stu_sib', mealId: 'meal_soya', date: MON, quantity: 1 }]);
  assert.equal(wrongDate.status, 400);

  // Valid mix: only Riya's line carries the allergy flag.
  const ok = await checkout([
    { studentId: 'stu_mine', mealId: 'meal_paneer', date: MON, quantity: 1, hasAllergyAlert: false },
    { studentId: 'stu_sib', mealId: 'meal_paneer', date: MON, quantity: 1, hasAllergyAlert: true },
    { studentId: 'stu_sib', mealId: 'meal_soya', date: TUE, quantity: 1 },
  ]);
  assert.equal(ok.status, 200, await ok.clone().text());
  const items = fs.list('orderItems');
  const flag = (sid: string, date: string) => items.find((i: any) => i.studentId === sid && i.date === date)?.hasAllergyAlert;
  assert.equal(flag('stu_mine', MON), true);
  assert.equal(flag('stu_sib', MON), false);
  assert.equal(flag('stu_sib', TUE), false);
});

test('BUG: a child with no class/category, or a Roman-numeral class, is silently treated as Primary', () => {
  assert.equal(getStudentCategory(null, null), 'Primary');
  assert.equal(getStudentCategory('', ''), 'Primary');
  assert.equal(getStudentCategory('VIII', null), 'Primary', 'class 8 should be Secondary');
  assert.equal(getStudentCategory('Nursery', null), 'Pre-primary');
});

test('BUG: children list and checkout disagree on category for a grade like "Class 3" with no stored category', async () => {
  fs.seed('students', 'stu_legacy', { id: 'stu_legacy', parentId: 'par_usr_parent', name: 'Old', grade: 'Class 3', division: 'C', rollNo: '1', isActive: true });
  const { students } = await (await parentChildren.GET(jsonRequest('/api/parent/children', 'GET', undefined, parent))).json();
  const shown = students.find((s: any) => s.id === 'stu_legacy').studentCategory;
  assert.equal(shown, 'Secondary', 'children API: parseInt("Class 3") is NaN, so falls to Secondary');
  assert.equal(getStudentCategory('Class 3', null), 'Primary', 'checkout / menu say Primary');
  // The menu page feeds the list value back as the explicit category, so the parent is shown the Secondary menu
  assert.equal(getStudentCategory('Class 3', shown), 'Secondary');
  // ... and checkout then refuses the Secondary dish.
  seedMenu(MON, 'Secondary', 'meal_soya');
  const res = await checkout([{ studentId: 'stu_legacy', mealId: 'meal_soya', date: MON, quantity: 1, studentCategory: 'Secondary' }]);
  assert.equal(res.status, 400);
});

test('FIXED: admin Users shows "Meal conflict detected" only for a child with an allergy-flagged meal', async () => {
  seedPaidOrder('ORD-PLAIN', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON, hasAllergyAlert: false }]);
  const { students } = await (await adminUsers(jsonRequest('/api/admin/users', 'GET', undefined, admin))).json();
  const riya = students.find((s: any) => s.id === 'stu_mine');
  assert.equal(riya.allergyAlertState, 'NO_ALLERGY', 'Riya has no allergy and no flagged item');
  assert.equal(riya.conflictOrdersCount, 0);
  const mine = await (await parentChildren.GET(jsonRequest('/api/parent/children', 'GET', undefined, parent))).json();
  assert.equal(mine.students.find((s: any) => s.id === 'stu_mine').allergyAlertStatus, 'NO_ALLERGY');

  // A meal that was flagged at checkout is still reported.
  seedPaidOrder('ORD-FLAGGED', 'par_usr_parent', [{ studentId: 'stu_mine', date: MON, hasAllergyAlert: true }]);
  const again = await (await adminUsers(jsonRequest('/api/admin/users', 'GET', undefined, admin))).json();
  const flagged = again.students.find((s: any) => s.id === 'stu_mine');
  assert.equal(flagged.allergyAlertState, 'CONFLICT_DETECTED');
  assert.equal(flagged.conflictOrdersCount, 1);
});
