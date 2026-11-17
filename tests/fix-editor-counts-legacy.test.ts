import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { GET as menuDays } from '../app/api/staff/menu-days/route';
import { GET as kitchen } from '../app/api/admin/kitchen/route';
import { POST as assign } from '../app/api/admin/menus/assign/route';
import { POST as portions } from '../app/api/admin/menus/portions/route';
import { applyMonthlyMenu, type MonthlyMenuPlan } from '../lib/monthly-menu';

/**
 * HIGH 7: the Student Menu counts an older order line (saved without a class) for its child's class
 * only, and counts orders bought from an older duplicate entry, the same as Prepare.
 */

const WED = '2026-11-18';
let fs: FakeFirestore;
let staff: Record<string, string>;
const entry = (c: string) => `menu_${WED}_${c.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T10:00:00+05:30') });
  staff = await signedInAs(fs, 'STAFF');
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_poha', { id: 'meal_poha', name: 'Poha', price: 60, category: 'LUNCH', isVegetarian: true });
  for (const c of ['Pre-primary', 'Primary', 'Secondary']) {
    fs.seed('menus', entry(c), { id: entry(c), date: WED, studentCategory: c, mealId: 'meal_dal', isHoliday: false, isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30' });
  }
  // An older duplicate entry for Secondary (switched-on, same dish), from an older tool.
  fs.seed('menus', `meal_dal_${WED}`, { id: `meal_dal_${WED}`, date: WED, studentCategory: 'Secondary', mealId: 'meal_dal', isActive: true, availableQuantity: 10, updatedAt: '2020-01-01' });
  fs.seed('students', 'stu_p', { id: 'stu_p', parentId: 'par_x', name: 'Riya', grade: '3', division: 'A', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_s', { id: 'stu_s', parentId: 'par_x', name: 'Dev', grade: '8', division: 'A', studentCategory: 'Secondary', isActive: true });
  fs.seed('orders', 'ORD-OLD', { id: 'ORD-OLD', parentId: 'par_x', paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
  // Older line: no class and no menu entry recorded.
  fs.seed('orderItems', 'oit_old', { id: 'oit_old', orderId: 'ORD-OLD', studentId: 'stu_p', mealId: 'meal_dal', date: WED, quantity: 1 });
  fs.seed('orders', 'ORD-DUP', { id: 'ORD-DUP', parentId: 'par_x', paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
  fs.seed('orderItems', 'oit_dup', { id: 'oit_dup', orderId: 'ORD-DUP', studentId: 'stu_s', studentCategory: 'Secondary', mealId: 'meal_dal', menuId: `meal_dal_${WED}`, date: WED, quantity: 1 });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

const cards = async () =>
  Object.fromEntries(
    (await (await menuDays(jsonRequest(`/api/staff/menu-days?from=${WED}&days=1`, 'GET', undefined, staff))).json()).days[0].classes.map((c: any) => [c.category, c])
  );

test('the editor counts each order once, in the right class, like Prepare', async () => {
  const c = await cards();
  assert.equal(c['Pre-primary'].ordered, 0, 'the older Primary line is not counted for Pre-primary');
  assert.equal(c['Primary'].ordered, 1);
  assert.equal(c['Secondary'].ordered, 1, 'the order on the older duplicate entry is counted');
  const prepare = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${WED}&refresh=true`, 'GET', undefined, staff))).json();
  const byCat = Object.fromEntries(prepare.byCategory.map((g: any) => [g.category, g.total]));
  assert.deepEqual([byCat['Primary'] || 0, byCat['Secondary'] || 0, byCat['Pre-primary'] || 0], [c['Primary'].ordered, c['Secondary'].ordered, c['Pre-primary'].ordered]);
});

test('Pre-primary can be changed and set to 0 portions: nobody in Pre-primary ordered', async () => {
  const change = await assign(jsonRequest('/api/admin/menus/assign', 'POST', { date: WED, studentCategory: 'Pre-primary', mealId: 'meal_poha', replace: true }, staff));
  assert.equal(change.status, 200, JSON.stringify(await change.clone().json()));
  const zero = await portions(jsonRequest('/api/admin/menus/portions', 'POST', { date: WED, studentCategory: 'Pre-primary', portions: 0 }, staff));
  assert.equal(zero.status, 200);
});

test('Primary is still protected by its older order', async () => {
  const change = await assign(jsonRequest('/api/admin/menus/assign', 'POST', { date: WED, studentCategory: 'Primary', mealId: 'meal_poha', replace: true }, staff));
  assert.equal(change.status, 409);
  assert.match((await change.json()).error, /1 child has already ordered this/);
});

test('the monthly import treats the older line as Primary only', async () => {
  const plan: MonthlyMenuPlan = {
    title: null, month: '2026-11', issues: [],
    days: [{ row: 0, date: WED, dayLabel: WED, weekday: null, errors: [], cells: {
      'Pre-primary': { kind: 'MEAL', dish: 'Poha', merged: false },
      Primary: { kind: 'MEAL', dish: 'Dal Khichdi', merged: false },
      Secondary: { kind: 'MEAL', dish: 'Dal Khichdi', merged: false },
    } as any }],
  };
  const result = await applyMonthlyMenu(plan, { replaceUnordered: true, actorId: 'usr_staff', fileName: 'nov.xlsx', dryRun: true });
  assert.equal(result.days[0].cells['Pre-primary'].outcome, 'replace', 'Pre-primary is not blocked by the Primary order');
});
