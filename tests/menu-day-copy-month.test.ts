import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { POST as dayCopy } from '../app/api/admin/meals/day-copy/route';
import { GET as menuMonth } from '../app/api/staff/menu-month/route';
import { GET as parentMenu } from '../app/api/menu/route';
import { applyMonthlyMenu, type MonthlyMenuPlan } from '../lib/monthly-menu';

/** "Edit for this day" (a day-only copy of the dish) and the Month view of the Student Menu. */

const WED = '2026-11-18';
const THU = '2026-11-19';
let fs: FakeFirestore;
let staff: Record<string, string>;
let parent: Record<string, string>;

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};
const id = (date: string, c: string) => `menu_${date}_${c.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
function menu(date: string, c: string, mealId = 'meal_soya', extra: Record<string, unknown> = {}) {
  fs.seed('menus', id(date, c), { id: id(date, c), date, studentCategory: c, mealId, isHoliday: false, isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', ...extra });
}
const copy = (body: Record<string, unknown>, who = staff) => dayCopy(jsonRequest('/api/admin/meals/day-copy', 'POST', body, who));
const parentSees = async (date: string, c: string) =>
  ((await (await parentMenu(jsonRequest(`/api/menu?date=${date}&category=${c}`, 'GET'))).json()).menus as any[]).map((m) => [m.meal?.name, m.meal?.price]);

beforeEach(async () => {
  fs = useFakeFirestore();
  at('2026-11-17T10:00');
  staff = await signedInAs(fs, 'STAFF');
  parent = await signedInAs(fs, 'PARENT');
  fs.seed('meals', 'meal_soya', { id: 'meal_soya', name: 'Soyabean Masala + Dal + Chapati + Salad', price: 80, category: 'LUNCH', isVegetarian: true, allergens: 'Soy' });
  for (const date of [WED, THU]) for (const c of ['Pre-primary', 'Primary', 'Secondary']) menu(date, c);
});

afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

test('Edit for this day: a copy is used on that day and class only; other days and the original stay', async () => {
  const res = await copy({ date: WED, studentCategory: 'Primary', mealId: 'meal_soya', name: 'Soyabean Masala + Chapati + Salad', price: 70, isVegetarian: true });
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  const { mealId } = await res.json();
  const copied = fs.getDoc('meals', mealId)!;
  assert.deepEqual([copied.dayOnly, copied.dayOnlyDate, copied.copyOf, copied.allergens], [true, WED, 'meal_soya', 'Soy'], 'allergens are kept');

  // The brunch price is the class price (Primary ₹75, Secondary ₹90), whatever the dish.
  assert.deepEqual(await parentSees(WED, 'Primary'), [['Soyabean Masala + Chapati + Salad', 75]]);
  assert.deepEqual(await parentSees(WED, 'Secondary'), [['Soyabean Masala + Dal + Chapati + Salad', 90]], 'other class unchanged');
  assert.deepEqual(await parentSees(THU, 'Primary'), [['Soyabean Masala + Dal + Chapati + Salad', 75]], 'other day unchanged');
  assert.equal(fs.getDoc('meals', 'meal_soya')?.price, 80, 'the original dish is unchanged');

  // Editing the copy again changes it in place (no second copy).
  const again = await copy({ date: WED, studentCategory: 'Primary', mealId, name: 'Soyabean Masala + Chapati', isVegetarian: true });
  assert.equal((await again.json()).mealId, mealId);
  assert.equal(fs.list('meals').filter((m) => m.dayOnly).length, 1);
  assert.deepEqual(await parentSees(WED, 'Primary'), [['Soyabean Masala + Chapati', 75]]);
});

test('a same-name copy (no price: set by class) is allowed, and the monthly import never matches day-only copies', async () => {
  const res = await copy({ date: WED, studentCategory: 'ALL', mealId: 'meal_soya', name: 'Soyabean Masala + Dal + Chapati + Salad', isVegetarian: false });
  assert.equal(res.status, 200);
  const prices: Record<string, number> = { 'Pre-primary': 60, Primary: 75, Secondary: 90 };
  for (const c of ['Pre-primary', 'Primary', 'Secondary']) assert.deepEqual(await parentSees(WED, c), [['Soyabean Masala + Dal + Chapati + Salad', prices[c]]]);

  const plan: MonthlyMenuPlan = {
    title: null, month: '2026-11', issues: [],
    days: [{ row: 0, date: THU, dayLabel: THU, weekday: null, errors: [], cells: {
      'Pre-primary': { kind: 'MEAL', dish: 'Soyabean Masala + Dal + Chapati + Salad', merged: false },
      Primary: { kind: 'MEAL', dish: 'Soyabean Masala + Dal + Chapati + Salad', merged: false },
      Secondary: { kind: 'MEAL', dish: 'Soyabean Masala + Dal + Chapati + Salad', merged: false },
    } as any }],
  };
  const result = await applyMonthlyMenu(plan, { replaceUnordered: true, actorId: 'usr_staff', fileName: 'nov.xlsx', dryRun: true });
  assert.equal(result.dishes[0].mealId, 'meal_soya', 'the import uses the original, never the copy');
});

test('Edit for this day follows Change dish: refused with paid orders (no copy left behind), from 07:00, and for parents', async () => {
  fs.seed('orders', 'ORD-1', { id: 'ORD-1', parentId: 'par_x', paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
  fs.seed('orderItems', 'oit_1', { id: 'oit_1', orderId: 'ORD-1', studentId: 'stu_1', mealId: 'meal_soya', menuId: id(WED, 'Primary'), date: WED, quantity: 1, studentCategory: 'Primary' });
  const one = await copy({ date: WED, studentCategory: 'Primary', mealId: 'meal_soya', name: 'Light Soya', price: 60, isVegetarian: true });
  assert.equal(one.status, 409);
  assert.equal((await one.json()).error, '1 child has already ordered this. Ask the admin to cancel and refund those orders first.');
  const all = await copy({ date: WED, studentCategory: 'ALL', mealId: 'meal_soya', name: 'Light Soya', price: 60, isVegetarian: true });
  assert.equal(all.status, 409);
  assert.deepEqual((await all.json()).blockedCategories, ['Primary']);
  assert.equal(fs.list('meals').filter((m) => m.dayOnly).length, 0, 'no stray copy');

  at(`${WED}T07:01`);
  assert.equal((await copy({ date: WED, studentCategory: 'Secondary', mealId: 'meal_soya', name: 'Light Soya', price: 60, isVegetarian: true })).status, 400);
  assert.equal((await copy({ date: THU, studentCategory: 'Secondary', mealId: 'meal_soya', name: 'Light Soya', price: 60, isVegetarian: true }, parent)).status, 403);
});

test('Month view: every date of the month (31 days within the 30-value query limit), statuses, and a 6-month range', async () => {
  for (const c of ['Pre-primary', 'Primary', 'Secondary']) menu('2026-12-31', c);
  menu('2026-12-01', 'Primary');
  fs.seed('menus', id('2026-12-02', 'Primary'), { id: id('2026-12-02', 'Primary'), date: '2026-12-02', studentCategory: 'ALL', isHoliday: true, holidayReason: 'Founders day', mealId: '' });
  const res = await menuMonth(jsonRequest('/api/staff/menu-month?month=2026-12', 'GET', undefined, staff));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.days.length, 31);
  assert.equal(body.days[0].date, '2026-12-01');
  assert.equal(body.days[30].date, '2026-12-31');
  const status = Object.fromEntries(body.days.map((d: any) => [d.date, d.status]));
  assert.equal(status['2026-12-31'], 'ALL');
  assert.equal(status['2026-12-01'], 'SOME');
  assert.equal(status['2026-12-02'], 'HOLIDAY');
  assert.equal(status['2026-12-06'], 'SUNDAY');
  assert.equal(status['2026-12-07'], 'NONE');
  assert.equal(body.days[30].classes[1].mealName, 'Soyabean Masala + Dal + Chapati + Salad');

  assert.equal((await menuMonth(jsonRequest('/api/staff/menu-month?month=2027-05', 'GET', undefined, staff))).status, 200);
  assert.equal((await menuMonth(jsonRequest('/api/staff/menu-month?month=2027-06', 'GET', undefined, staff))).status, 400, 'more than 6 months ahead');
  assert.equal((await menuMonth(jsonRequest('/api/staff/menu-month?month=2026-05', 'GET', undefined, staff))).status, 200);
  assert.equal((await menuMonth(jsonRequest('/api/staff/menu-month?month=2026-04', 'GET', undefined, staff))).status, 400, 'more than 6 months back');
  assert.equal((await menuMonth(jsonRequest('/api/staff/menu-month?month=2026-12', 'GET', undefined, parent))).status, 403);
});
