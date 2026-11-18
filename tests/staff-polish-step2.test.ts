import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken, TOKEN_COOKIE_NAME, verifySessionToken } from '../lib/auth';
import { GET as kitchen } from '../app/api/admin/kitchen/route';
import { GET as nextServingDayRoute } from '../app/api/staff/next-serving-day/route';
import { GET as serveList } from '../app/api/staff/serve/route';
import { GET as me } from '../app/api/auth/me/route';
import { cutoffState, dayPlan, nextServingDay } from '../lib/serving-day';
import { csvCell, notServedChildren, notServedCsv } from '../lib/not-served';

/**
 * Staff screens, step 2: next serving day, Prepare counts (per category, Final/Open), per-category
 * "No brunch", the Not served list (CSV), the 30-day sliding staff session, and two display fixes.
 */

const MON = '2026-11-16';
const TUE = '2026-11-17';
const WED = '2026-11-18';
const THU = '2026-11-19';
const FRI = '2026-11-20';
const SAT = '2026-11-21';
const SUN = '2026-11-22';
const NEXT_MON = '2026-11-23';

let fs: FakeFirestore;
let staff: Record<string, string>;
let parent: Record<string, string>;

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

const catId = (c: string) => c.toLowerCase();
function menu(date: string, category: string, extra: Record<string, unknown> = {}) {
  const id = `menu_${date}_${catId(category)}`;
  fs.seed('menus', id, {
    id, date, studentCategory: category, mealId: 'meal_dal', isHoliday: false, isActive: true,
    availableQuantity: 50, orderingDeadline: '08:30', ...extra,
  });
}
const holiday = (date: string, category: string, reason: string) =>
  menu(date, category, { mealId: 'meal_holiday_no_brunch', isHoliday: true, holidayReason: reason });

function order(id: string, date: string, lines: Array<{ item: string; studentId: string; category: string; meal?: string; quantity?: number }>, fields: Record<string, unknown> = {}) {
  fs.seed('orders', id, { id, parentId: 'par_x', totalAmount: 80, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', ...fields });
  for (const l of lines) {
    fs.seed('orderItems', l.item, {
      id: l.item, orderId: id, studentId: l.studentId, studentCategory: l.category, mealId: l.meal === 'Poha' ? 'meal_poha' : 'meal_dal',
      mealName: l.meal || 'Dal Khichdi', date, quantity: l.quantity || 1, unitPrice: 80, totalPrice: 80 * (l.quantity || 1),
    });
  }
}

beforeEach(async () => {
  fs = useFakeFirestore();
  at(`${TUE}T07:00`);
  staff = await signedInAs(fs, 'STAFF');
  await signedInAs(fs, 'ADMIN');
  parent = await signedInAs(fs, 'PARENT');
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_poha', { id: 'meal_poha', name: 'Poha', price: 60, category: 'BREAKFAST', isVegetarian: true });
  fs.seed('students', 'stu_a', { id: 'stu_a', parentId: 'par_x', name: 'Asha', grade: 'KG', division: 'A', rollNo: '4', studentCategory: 'Pre-primary', isActive: true });
  fs.seed('students', 'stu_b', { id: 'stu_b', parentId: 'par_x', name: 'Bilal', grade: '3', division: 'B', rollNo: '11', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_c', { id: 'stu_c', parentId: 'par_x', name: 'Chitra', grade: '3', division: 'B', rollNo: '2', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_d', { id: 'stu_d', parentId: 'par_x', name: 'Dev', grade: '8', division: 'A', rollNo: '9', studentCategory: 'Secondary', isActive: true });
});

afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

// --- Next serving day -------------------------------------------------------------------------

test('next serving day skips Sundays, whole-day holidays and unpublished dates; one open category is enough', async () => {
  at(`${FRI}T15:00`);
  // Saturday: a holiday for every category. Sunday: a dish (never served). Monday: Primary only.
  for (const c of ['Pre-primary', 'Primary', 'Secondary']) holiday(SAT, c, 'Diwali');
  menu(SUN, 'Primary');
  holiday(NEXT_MON, 'Pre-primary', 'Sports day');
  menu(NEXT_MON, 'Primary');
  assert.equal(await nextServingDay(), NEXT_MON);

  const res = await nextServingDayRoute(jsonRequest('/api/staff/next-serving-day', 'GET', undefined, staff));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).date, NEXT_MON);
  assert.equal((await nextServingDayRoute(jsonRequest('/api/staff/next-serving-day', 'GET', undefined, parent))).status, 403);
});

test('a switched-off (unpublished) dish does not make a serving day', async () => {
  at(`${TUE}T15:00`);
  menu(WED, 'Primary', { isActive: false });
  menu(THU, 'Secondary');
  assert.equal(await nextServingDay(), THU);
});

test('dayPlan reports each category, the latest deadline, and cutoffState flips to FINAL at the deadline', () => {
  const entries = [
    { id: 'a', date: WED, studentCategory: 'Pre-primary', mealId: 'meal_dal', isActive: true, orderingDeadline: '08:00' },
    { id: 'b', date: WED, studentCategory: 'Primary', mealId: 'meal_dal', isActive: true, orderingDeadline: '09:15' },
    { id: 'c', date: WED, studentCategory: 'Secondary', isHoliday: true, holidayReason: 'Exam', mealId: 'meal_holiday_no_brunch' },
  ];
  const plan = dayPlan(entries, WED);
  assert.deepEqual(plan.categories.map((c) => c.state), ['OPEN', 'OPEN', 'HOLIDAY']);
  assert.equal(plan.categories[2].holidayReason, 'Exam');
  assert.equal(plan.deadline, '09:15');
  assert.equal(dayPlan([], WED).deadline, '08:30', 'fallback');
  assert.equal(dayPlan([{ id: 'x', date: SUN, studentCategory: 'Primary', mealId: 'meal_dal' }], SUN).isServingDay, false);

  assert.equal(cutoffState(WED, '09:15', new Date(`${WED}T09:14:00+05:30`)), 'OPEN');
  assert.equal(cutoffState(WED, '09:15', new Date(`${WED}T09:16:00+05:30`)), 'FINAL');
  assert.equal(cutoffState(TUE, '09:15', new Date(`${WED}T07:00:00+05:30`)), 'FINAL', 'past dates are final');
  assert.equal(cutoffState(THU, '08:30', new Date(`${WED}T23:00:00+05:30`)), 'OPEN');
});

// --- Prepare (kitchen API) --------------------------------------------------------------------

test('Prepare counts: per-category dishes, teacher meals separate, Final/Open, and no money for staff', async () => {
  menu(TUE, 'Pre-primary');
  menu(TUE, 'Primary');
  holiday(TUE, 'Secondary', 'Exam');
  order('ORD-1', TUE, [
    { item: 'oit_a', studentId: 'stu_a', category: 'Pre-primary' },
    { item: 'oit_b', studentId: 'stu_b', category: 'Primary', quantity: 2 },
  ]);
  order('ORD-2', TUE, [{ item: 'oit_c', studentId: 'stu_c', category: 'Primary', meal: 'Poha' }]);
  order('ORD-X', TUE, [{ item: 'oit_x', studentId: 'stu_d', category: 'Secondary' }], { orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
  fs.seed('teacher_orders', 'TCH-1', {
    id: 'TCH-1', date: TUE, teacherName: 'Ms Rao', paymentStatus: 'PAID', orderStatus: 'CONFIRMED',
    items: [{ mealId: 'tm_thali', mealName: 'Teacher Thali', quantity: 2 }],
  });

  const open = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${TUE}&refresh=true`, 'GET', undefined, staff))).json();
  assert.equal(open.totalMeals, 4, 'students only');
  assert.equal(open.cutoff, 'OPEN');
  assert.equal(open.deadline, '08:30');
  assert.deepEqual(open.byCategory, [
    { category: 'Pre-primary', total: 1, dishes: [{ mealName: 'Dal Khichdi', quantity: 1 }] },
    { category: 'Primary', total: 3, dishes: [{ mealName: 'Dal Khichdi', quantity: 2 }, { mealName: 'Poha', quantity: 1 }] },
  ]);
  assert.equal(open.studentCategoryBreakdown['Primary'], 3);
  assert.equal(open.teacherMealsTotal, 2);
  assert.deepEqual(open.teacherMeals, [{ mealName: 'Teacher Thali', quantity: 2 }]);
  assert.deepEqual(open.plan.categories.find((c: any) => c.category === 'Secondary'), {
    category: 'Secondary', state: 'HOLIDAY', holidayReason: 'Exam', deadline: null,
  });
  assert.doesNotMatch(JSON.stringify(open), /unitPrice|totalPrice|totalAmount|"price"/, 'no money on the Prepare data');

  // After 08:30 the same (cached) numbers are labelled Final.
  at(`${TUE}T08:31`);
  const final = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${TUE}`, 'GET', undefined, staff))).json();
  assert.equal(final.cutoff, 'FINAL');
});

test('Serve shows "No brunch" for a category with a holiday while others are served', async () => {
  at(`${TUE}T11:00`);
  holiday(TUE, 'Pre-primary', 'Annual day rehearsal');
  menu(TUE, 'Primary');
  menu(TUE, 'Secondary');
  order('ORD-1', TUE, [{ item: 'oit_b', studentId: 'stu_b', category: 'Primary' }]);
  const body = await (await serveList(jsonRequest(`/api/staff/serve?date=${TUE}`, 'GET', undefined, staff))).json();
  assert.equal(body.closedReason, null);
  assert.deepEqual(body.closedCategories, [{ category: 'Pre-primary', reason: 'Annual day rehearsal' }]);

  for (const c of ['Primary', 'Secondary']) holiday(TUE, c, 'Annual day');
  const closed = await (await serveList(jsonRequest(`/api/staff/serve?date=${TUE}`, 'GET', undefined, staff))).json();
  assert.match(closed.closedReason, /^No brunch today/);
  assert.deepEqual(closed.closedCategories, [], 'whole day closed: one message only');
});

// --- Not served list ------------------------------------------------------------------------

test('Not served list: unserved children in class order, teachers in their own section, safe CSV', () => {
  const rows = [
    { studentName: 'Bilal', grade: '3', division: 'B', rollNo: '11', studentCategory: 'Primary', served: false, meals: [{ mealName: 'Dal Khichdi', quantity: 2 }] },
    { studentName: 'Chitra', grade: '3', division: 'B', rollNo: '2', studentCategory: 'Primary', served: false, meals: [{ mealName: 'Poha', quantity: 1 }] },
    { studentName: 'Asha', grade: 'KG', division: 'A', rollNo: '4', studentCategory: 'Pre-primary', served: true, meals: [{ mealName: 'Dal Khichdi', quantity: 1 }] },
    { studentName: '=HYPERLINK("http://x")', grade: '8', division: 'A', rollNo: '', studentCategory: 'Secondary', served: false, meals: [{ mealName: 'Dal "special"', quantity: 1 }] },
  ];
  const teachers = [
    { teacherName: 'Ms Rao', teacherPhone: '9876543210', orderStatus: 'CONFIRMED', items: [{ mealName: 'Teacher Thali', quantity: 1 }] },
    { teacherName: 'Mr Iyer', teacherPhone: '9000000000', orderStatus: 'GIVEN', items: [{ mealName: 'Teacher Thali', quantity: 1 }] },
  ];

  assert.deepEqual(notServedChildren(rows).map((r) => r.studentName), ['Bilal', 'Chitra', '=HYPERLINK("http://x")'], 'by class, then division, then name');

  const csv = notServedCsv(TUE, rows, teachers);
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines[1], '"Name","Class","Division","Dish"');
  assert.equal(lines[2], '"Bilal","Primary","B","Dal Khichdi x 2"');
  assert.equal(lines[3], '"Chitra","Primary","B","Poha"');
  assert.equal(lines[4], `"'=HYPERLINK(""http://x"")","Secondary","A","Dal ""special"""`, 'formula neutralised, quotes escaped');
  assert.ok(!/Roll|"11"|"2"/.test(csv), 'no roll numbers');
  assert.ok(!csv.includes('Asha'), 'served children are not listed');
  assert.ok(lines.includes('"Teachers"'));
  assert.ok(csv.includes('"Ms Rao","9876543210","Teacher Thali"'));
  assert.ok(!csv.includes('Mr Iyer'), 'served teachers are not listed');
  assert.equal(csvCell('+91 98765'), `"'+91 98765"`);
  assert.equal(csvCell(null), '""');
});

// --- Staff session: 30 days, sliding ----------------------------------------------------------

const setCookie = (res: Response) => res.headers.get('set-cookie') || '';
const tokenFrom = (res: Response) => setCookie(res).match(new RegExp(`${TOKEN_COOKIE_NAME}=([^;]+)`))?.[1];

test('a staff session lasts 30 days and is renewed while in use; parents keep 7 days without renewal', async () => {
  at(`${MON}T09:00`);
  const staffToken = await createSessionToken({ userId: 'usr_staff', email: 'usr_staff@example.com', name: 'STAFF', role: 'STAFF' });
  const parentToken = await createSessionToken({ userId: 'usr_parent', email: 'usr_parent@example.com', name: 'PARENT', role: 'PARENT' });
  const claims = await verifySessionToken(staffToken);
  assert.equal((claims!.exp as number) - (claims!.iat as number), 30 * 24 * 3600);
  const parentClaims = await verifySessionToken(parentToken);
  assert.equal((parentClaims!.exp as number) - (parentClaims!.iat as number), 7 * 24 * 3600);

  // An hour later: valid, nothing re-issued.
  at(`${MON}T10:00`);
  const fresh = await me(jsonRequest('/api/auth/me', 'GET', undefined, { authorization: `Bearer ${staffToken}` }));
  assert.equal((await fresh.json()).user.role, 'STAFF');
  assert.equal(tokenFrom(fresh), undefined);

  // Two days later: renewed for another 30 days.
  at(`${WED}T09:00`);
  const renewed = await me(jsonRequest('/api/auth/me', 'GET', undefined, { authorization: `Bearer ${staffToken}` }));
  assert.equal((await renewed.json()).user.role, 'STAFF');
  const next = tokenFrom(renewed);
  assert.ok(next, 'a new session cookie is set');
  assert.match(setCookie(renewed), /Max-Age=2592000/);
  assert.match(setCookie(renewed), /HttpOnly/i);
  const nextClaims = await verifySessionToken(decodeURIComponent(next!));
  assert.equal(nextClaims!.iat, Math.floor(Date.now() / 1000));
  assert.equal(nextClaims!.role, 'STAFF');

  const parentMe = await me(jsonRequest('/api/auth/me', 'GET', undefined, { authorization: `Bearer ${parentToken}` }));
  assert.equal((await parentMe.json()).user.role, 'PARENT');
  assert.equal(tokenFrom(parentMe), undefined, 'parents are not renewed');

  // Demoted in the database: no renewal, and the session is not a staff session any more.
  fs.seed('users', 'usr_staff', { ...fs.getDoc('users', 'usr_staff'), role: 'PARENT' });
  const demoted = await me(jsonRequest('/api/auth/me', 'GET', undefined, { authorization: `Bearer ${staffToken}` }));
  assert.notEqual((await demoted.json()).user?.role, 'STAFF');
  assert.equal(tokenFrom(demoted), undefined);
});

// --- Display fixes (source checks) -------------------------------------------------------------

test('display fixes: no "₹₹" on the Student Menu, no phone-local midnight timers, no calendar "Tomorrow"', () => {
  const kitchenPage = readFileSync('app/staff/kitchen/page.tsx', 'utf-8');
  assert.ok(!kitchenPage.includes('₹{formatINR'), 'formatINR already adds ₹');
  for (const p of ['app/staff/kitchen/page.tsx', 'app/admin/menu/page.tsx', 'app/admin/kitchen/page.tsx', 'app/admin/orders/page.tsx']) {
    const src = readFileSync(p, 'utf-8');
    assert.ok(!src.includes('now.getFullYear(), now.getMonth(), now.getDate() + 1'), `${p}: IST, not the phone's midnight`);
    assert.ok(!/>\s*Tomorrow\b/.test(src) && !src.includes('Tomorrow ('), `${p}: "Next serving day" replaces "Tomorrow"`);
  }
  const adminKitchen = readFileSync('app/admin/kitchen/page.tsx', 'utf-8');
  assert.ok(!/studentCategoryBreakdown\.(PRE_PRIMARY|PRIMARY|SECONDARY)/.test(adminKitchen), 'badge reads the real keys');
});

