import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { GET as serveList, POST as serve } from '../app/api/staff/serve/route';
import { GET as adminOrders, PATCH as updateOrder } from '../app/api/admin/orders/route';
import { GET as stats } from '../app/api/admin/stats/route';
import { GET as teacherOrders } from '../app/api/staff/teacher-orders/route';
import { DELETE as deleteMenu } from '../app/api/admin/menus/route';
import { cancelOrderWithRefund, OrderCancellationError, type RefundClient } from '../lib/order-cancellation';
import { DEFAULT_SERVE_FILTER, filterServeRows, serveCounter } from '../lib/serve-filter';

const TODAY = '2026-11-17'; // Tuesday
const TOMORROW = '2026-11-18';

let fs: FakeFirestore;
let staff: Record<string, string>;
let staff2: Record<string, string>;
let admin: Record<string, string>;
let parent: Record<string, string>;

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

function student(id: string, name: string, grade: string, division: string, rollNo: string, studentCategory: string, extra: Record<string, unknown> = {}) {
  fs.seed('students', id, { id, parentId: 'par_x', name, grade, division, rollNo, studentCategory, isActive: true, ...extra });
}

function order(id: string, lines: Array<{ item: string; studentId: string; date?: string; meal?: string; quantity?: number; allergy?: string }>, fields: Record<string, unknown> = {}) {
  fs.seed('orders', id, { id, parentId: 'par_x', totalAmount: 80 * lines.length, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', ...fields });
  for (const l of lines) {
    fs.seed('orderItems', l.item, {
      id: l.item, orderId: id, studentId: l.studentId, mealId: 'meal_dal', mealName: l.meal || 'Dal Khichdi', date: l.date || TODAY,
      quantity: l.quantity || 1, unitPrice: 80, totalPrice: 80, hasAllergyAlert: Boolean(l.allergy), conflictAllergens: l.allergy || null,
    });
  }
}

beforeEach(async () => {
  fs = useFakeFirestore();
  at(`${TODAY}T11:00`);
  staff = await signedInAs(fs, 'STAFF');
  staff2 = await signedInAs(fs, 'STAFF', 'usr_staff2');
  admin = await signedInAs(fs, 'ADMIN');
  parent = await signedInAs(fs, 'PARENT');
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  student('stu_riya', 'Riya Sharma', '3', 'A', '7', 'Primary');
  student('stu_arjun', 'Arjun Sharma', '8', 'B', '12', 'Secondary');
  student('stu_kabir', 'Kabir Rao', 'Primary', '-', '-', 'Primary');
  student('stu_meera', 'Meera Joshi', 'KG', 'A', '3', 'Pre-primary');
  // Riya and her brother Arjun in ONE paid order; Riya has an allergy alert.
  order('ORD-SIB', [{ item: 'oit_riya', studentId: 'stu_riya', allergy: 'Peanut' }, { item: 'oit_arjun', studentId: 'stu_arjun', quantity: 2 }]);
  order('ORD-MEERA', [{ item: 'oit_meera', studentId: 'stu_meera' }]);
  // Never on the list: unpaid, cancelled, and another date.
  order('ORD-UNPAID', [{ item: 'oit_unpaid', studentId: 'stu_kabir' }], { paymentStatus: 'PENDING' });
  order('ORD-CANCELLED', [{ item: 'oit_cancel', studentId: 'stu_kabir' }], { orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
  order('ORD-TOMORROW', [{ item: 'oit_tomorrow', studentId: 'stu_kabir', date: TOMORROW }]);
});

afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

const list = async (headers = staff, date?: string) => {
  const res = await serveList(jsonRequest(`/api/staff/serve${date ? `?date=${date}` : ''}`, 'GET', undefined, headers));
  return { status: res.status, body: await res.json() };
};
const tick = (orderItemIds: string[], action: 'serve' | 'undo' = 'serve', headers = staff, date = TODAY) =>
  serve(jsonRequest('/api/staff/serve', 'POST', { date, orderItemIds, action }, headers));
const row = async (studentId: string) => (await list()).body.rows.find((r: any) => r.studentId === studentId);
const dateState = (orderId: string, date = TODAY) => fs.getDoc('orders', orderId)?.serviceDates?.[date];

test('the Serve list has one row per child (siblings separate), only paid, active, same-date meals, and no money', async () => {
  const { status, body } = await list();
  assert.equal(status, 200);
  assert.equal(body.date, TODAY);
  assert.equal(body.closedReason, null);
  assert.deepEqual(body.rows.map((r: any) => r.studentName), ['Meera Joshi', 'Riya Sharma', 'Arjun Sharma'], 'by class, then division, then name');
  const riya = body.rows.find((r: any) => r.studentId === 'stu_riya');
  assert.equal(riya.grade, '3');
  assert.equal(riya.division, 'A');
  assert.equal(riya.rollNo, '7');
  assert.equal(riya.studentCategory, 'Primary');
  assert.equal(riya.hasAllergyAlert, true);
  assert.equal(riya.allergens, 'Peanut');
  assert.equal(riya.meals[0].mealName, 'Dal Khichdi');
  assert.equal(body.rows.find((r: any) => r.studentId === 'stu_arjun').meals[0].quantity, 2);
  assert.deepEqual(body.totals, { children: 3, served: 0 });
  const raw = JSON.stringify(body);
  for (const secret of ['totalAmount', 'unitPrice', 'totalPrice', 'parentEmail', 'parentPhone', 'transactionRef', 'payments', 'Kabir']) {
    assert.ok(!raw.includes(secret), `serve list must not contain ${secret}`);
  }
});

test('ticking one sibling serves only that child; the order is collected once every child is served', async () => {
  const res = await tick(['oit_riya']);
  assert.equal(res.status, 200);
  assert.ok((await row('stu_riya')).served);
  assert.ok(!(await row('stu_arjun')).served, 'Arjun is not served');
  assert.equal(dateState('ORD-SIB').status, 'CONFIRMED');
  assert.equal(fs.getDoc('orders', 'ORD-SIB')?.orderStatus, 'CONFIRMED');
  assert.ok(fs.getDoc('orders', 'ORD-SIB')?.collectedAt, 'first handover recorded on the order');
  assert.equal(dateState('ORD-SIB').items.oit_riya.servedBy, 'usr_staff');

  assert.equal((await tick(['oit_arjun'])).status, 200);
  assert.equal(dateState('ORD-SIB').status, 'COLLECTED');
  assert.equal(fs.getDoc('orders', 'ORD-SIB')?.orderStatus, 'COLLECTED');
  assert.deepEqual((await list()).body.totals, { children: 3, served: 2 });
});

test('a double tap or two phones ticking the same child: one success, the other "Already served at HH:MM"', async () => {
  const [a, b] = await Promise.all([tick(['oit_meera']), tick(['oit_meera'], 'serve', staff2)]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 409]);
  const conflict = await (a.status === 409 ? a : b).json();
  assert.equal(conflict.code, 'ALREADY_SERVED');
  assert.equal(conflict.error, 'Already served at 11:00');
  assert.ok(conflict.servedAt);
  // Later tap from a third phone: same answer, nothing changes.
  const again = await tick(['oit_meera'], 'serve', admin);
  assert.equal(again.status, 409);
  assert.equal(dateState('ORD-MEERA').status, 'COLLECTED');
});

test('two staff ticking the two siblings at the same moment both succeed and stay consistent', async () => {
  const [a, b] = await Promise.all([tick(['oit_riya']), tick(['oit_arjun'], 'serve', staff2)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const state = dateState('ORD-SIB');
  assert.ok(state.items.oit_riya.servedAt);
  assert.ok(state.items.oit_arjun.servedAt);
  assert.equal(state.items.oit_arjun.servedBy, 'usr_staff2');
  assert.equal(state.status, 'COLLECTED');
});

test('undo puts only that child back; undoing twice is harmless', async () => {
  await tick(['oit_riya']);
  await tick(['oit_arjun']);
  assert.equal((await tick(['oit_riya'], 'undo')).status, 200);
  assert.ok(!(await row('stu_riya')).served);
  assert.ok((await row('stu_arjun')).served, 'Arjun stays served');
  assert.equal(dateState('ORD-SIB').status, 'CONFIRMED', 'no longer fully collected');
  assert.equal(dateState('ORD-SIB').items.oit_riya.undoneBy, 'usr_staff');
  assert.equal((await tick(['oit_riya'], 'undo')).status, 200);
  assert.equal((await tick(['oit_riya'])).status, 200, 'can be served again');
});

test('orders handed over before per-child tracking read as every child served; undoing one keeps the other', async () => {
  order('ORD-OLD', [{ item: 'oit_old1', studentId: 'stu_kabir' }, { item: 'oit_old2', studentId: 'stu_meera', meal: 'Upma' }], {
    orderStatus: 'COLLECTED', collectedAt: `${TODAY}T05:00:00.000Z`,
  });
  assert.ok((await row('stu_kabir')).served, 'old whole-order handover = served');
  const res = await tick(['oit_old1']);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'Already served at 10:30');
  assert.equal((await tick(['oit_old1'], 'undo')).status, 200);
  assert.ok(!(await row('stu_kabir')).served);
  assert.ok(dateState('ORD-OLD').items.oit_old2.servedAt, 'the other child stays served');
});

test('staff can serve and undo only today; an admin can correct another date', async () => {
  const res = await tick(['oit_tomorrow'], 'serve', staff, TOMORROW);
  assert.equal(res.status, 403);
  assert.equal((await tick(['oit_tomorrow'], 'serve', admin, TOMORROW)).status, 200);
  assert.equal((await tick(['oit_tomorrow'], 'undo', staff, TOMORROW)).status, 403);
  // A meal of another date cannot be ticked under today's date.
  assert.equal((await tick(['oit_tomorrow'])).status, 400);
});

test('unpaid or cancelled meals can never be served, and parents cannot use the serve screen', async () => {
  assert.equal((await tick(['oit_unpaid'])).status, 400);
  assert.equal((await tick(['oit_cancel'])).status, 400);
  assert.equal(fs.getDoc('orders', 'ORD-UNPAID')?.serviceDates, undefined);
  assert.equal((await tick(['oit_riya'], 'serve', parent)).status, 403);
  assert.equal((await list(parent)).status, 403);
  assert.equal((await tick(['missing'])).status, 404);
});

test('a partly served order cannot be cancelled and refunded, not even by an admin', async () => {
  await tick(['oit_riya']);
  const calls: unknown[] = [];
  const refunds: RefundClient = {
    async create(p) { calls.push(p); return { refundId: p.refundId, cfRefundId: 'x', status: 'SUCCESS', amount: p.amount }; },
    async get() { throw Object.assign(new Error('not found'), { status: 404 }); },
  };
  await assert.rejects(
    cancelOrderWithRefund({ orderId: 'ORD-SIB', cancelledBy: 'usr_admin', blockedStatuses: ['COLLECTED'], allowPreviouslyCollected: true }, fs.asFirestore(), refunds),
    (err: unknown) => err instanceof OrderCancellationError && err.status === 409 && /already served/.test(err.message)
  );
  const viaApi = await updateOrder(jsonRequest('/api/admin/orders', 'PATCH', { orderId: 'ORD-SIB', orderStatus: 'CANCELLED' }, admin));
  assert.equal(viaApi.status, 409);
  assert.equal(calls.length, 0);
  assert.equal(fs.getDoc('orders', 'ORD-SIB')?.paymentStatus, 'PAID');
});

test('the admin whole-order buttons still work and keep per-child state in step', async () => {
  await tick(['oit_riya']);
  const give = await updateOrder(jsonRequest('/api/admin/orders', 'PATCH', { orderId: 'ORD-SIB', orderStatus: 'COLLECTED', date: TODAY }, admin));
  assert.equal(give.status, 200);
  assert.ok((await row('stu_arjun')).served, 'giving the whole order serves the remaining child');
  const undo = await updateOrder(jsonRequest('/api/admin/orders', 'PATCH', { orderId: 'ORD-SIB', orderStatus: 'CONFIRMED', date: TODAY }, admin));
  assert.equal(undo.status, 200);
  assert.ok(!(await row('stu_riya')).served);
  assert.ok(!(await row('stu_arjun')).served);
});

test('Sundays and holidays say there is no brunch', async () => {
  assert.equal((await list(staff, '2026-11-22')).body.closedReason, 'No brunch today (Sunday)');
  fs.seed('menus', 'menu_2026-11-19_primary', { id: 'menu_2026-11-19_primary', date: '2026-11-19', isHoliday: true, holidayReason: 'Guru Nanak Jayanti', isActive: false });
  assert.equal((await list(staff, '2026-11-19')).body.closedReason, 'No brunch today (Guru Nanak Jayanti)');
});

test('Serve filters: Not served by default, Served, All, category, and search by name or roll number', async () => {
  await tick(['oit_riya']);
  const { rows } = (await list()).body;
  const names = (f: Partial<typeof DEFAULT_SERVE_FILTER>) => filterServeRows(rows, { ...DEFAULT_SERVE_FILTER, ...f }).map((r: any) => r.studentName);
  assert.deepEqual(names({}), ['Meera Joshi', 'Arjun Sharma']);
  assert.deepEqual(names({ status: 'SERVED' }), ['Riya Sharma']);
  assert.deepEqual(names({ status: 'ALL' }), ['Meera Joshi', 'Riya Sharma', 'Arjun Sharma']);
  assert.deepEqual(names({ status: 'ALL', category: 'Secondary' }), ['Arjun Sharma']);
  assert.deepEqual(names({ status: 'ALL', search: 'sharma' }), ['Riya Sharma', 'Arjun Sharma']);
  assert.deepEqual(names({ status: 'ALL', search: '12' }), ['Arjun Sharma'], 'roll number');
  assert.deepEqual(names({ status: 'ALL', search: '  meera ' }), ['Meera Joshi']);
  assert.deepEqual(serveCounter(rows), { served: 1, total: 3 });
  assert.deepEqual(serveCounter(rows, 'Primary'), { served: 1, total: 1 });
});

test('staff never receive revenue, order totals, payments or parent contact details', async () => {
  assert.equal((await stats(jsonRequest('/api/admin/stats', 'GET', undefined, staff))).status, 403);
  assert.equal((await stats(jsonRequest('/api/admin/stats', 'GET', undefined, admin))).status, 200);

  fs.seed('payments', 'pay_1', { id: 'pay_1', orderId: 'ORD-SIB', amount: 160, transactionRef: 'CF-REF-1', status: 'SUCCESS' });
  const forStaff = JSON.stringify(await (await adminOrders(jsonRequest(`/api/admin/orders?date=${TODAY}`, 'GET', undefined, staff))).json());
  for (const secret of ['totalAmount', 'unitPrice', 'totalPrice', 'parentEmail', 'parentPhone', 'CF-REF-1', '"payments"']) {
    assert.ok(!forStaff.includes(secret), `staff orders must not contain ${secret}`);
  }
  assert.ok(forStaff.includes('Riya Sharma'));
  const forAdmin = JSON.stringify(await (await adminOrders(jsonRequest(`/api/admin/orders?date=${TODAY}`, 'GET', undefined, admin))).json());
  assert.ok(forAdmin.includes('totalAmount'), 'admins still see amounts');

  fs.seed('teacher_orders', 'TCH-1', {
    id: 'TCH-1', teacherName: 'Asha Rao', teacherPhone: '9876543210', date: TODAY, paymentStatus: 'PAID', orderStatus: 'CONFIRMED',
    totalAmount: 120, transactionRef: 'CF-T-1', cashfreeOrderId: 'cf_t1', paymentSessionId: 'sess_t1', items: [{ mealId: 'TM-1', mealName: 'Veg Thali', quantity: 1, price: 120 }],
  });
  const teachers = JSON.stringify(await (await teacherOrders(jsonRequest(`/api/staff/teacher-orders?date=${TODAY}`, 'GET', undefined, staff))).json());
  assert.ok(teachers.includes('Asha Rao') && teachers.includes('9876543210') && teachers.includes('Veg Thali'));
  for (const secret of ['totalAmount', 'CF-T-1', 'cf_t1', 'sess_t1', '"price"']) assert.ok(!teachers.includes(secret), `teacher orders must not contain ${secret}`);
});

test('staff may delete a menu entry only when it has no active orders', async () => {
  fs.seed('menus', `menu_${TODAY}_primary`, { id: `menu_${TODAY}_primary`, date: TODAY, mealId: 'meal_dal', studentCategory: 'Primary', isActive: true });
  fs.seed('menus', 'menu_2026-11-20_primary', { id: 'menu_2026-11-20_primary', date: '2026-11-20', mealId: 'meal_dal', studentCategory: 'Primary', isActive: true });
  const blocked = await deleteMenu(jsonRequest(`/api/admin/menus?id=menu_${TODAY}_primary`, 'DELETE', undefined, staff));
  assert.equal(blocked.status, 409);
  assert.match((await blocked.json()).error, /already has orders/);
  assert.ok(fs.getDoc('menus', `menu_${TODAY}_primary`), 'not deleted');
  assert.equal((await deleteMenu(jsonRequest('/api/admin/menus?id=menu_2026-11-20_primary', 'DELETE', undefined, staff))).status, 200);
  assert.equal(fs.getDoc('menus', 'menu_2026-11-20_primary'), undefined);
});
