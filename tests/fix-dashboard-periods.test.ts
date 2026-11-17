import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { GET as stats } from '../app/api/admin/stats/route';
import { GET as kitchen } from '../app/api/admin/kitchen/route';

/** HIGH 9: each dashboard card says which period it covers, and today's number matches Prepare. */

const TUE = '2026-11-17';
const WED = '2026-11-18';
let fs: FakeFirestore;
let admin: Record<string, string>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${TUE}T10:00:00+05:30`) });
  admin = await signedInAs(fs, 'ADMIN');
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal', price: 80, category: 'LUNCH', isVegetarian: true });
  for (const d of [TUE, WED]) {
    fs.seed('menus', `menu_${d}_primary`, { id: `menu_${d}_primary`, date: d, studentCategory: 'Primary', mealId: 'meal_dal', isActive: true, availableQuantity: 50, orderingDeadline: '08:30' });
  }
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_x', name: 'Riya', grade: '3', division: 'A', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_2', { id: 'stu_2', parentId: 'par_x', name: 'Arjun', grade: '4', division: 'B', studentCategory: 'Primary', isActive: true });
  const order = (id: string, lines: Array<[string, string, number]>) => {
    fs.seed('orders', id, { id, parentId: 'par_x', totalAmount: 80 * lines.length, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', createdAt: '2026-11-10T10:00:00.000Z' });
    lines.forEach(([studentId, date, quantity], i) =>
      fs.seed('orderItems', `${id}_${i}`, { id: `${id}_${i}`, orderId: id, studentId, studentCategory: 'Primary', mealId: 'meal_dal', date, quantity, unitPrice: 80, totalPrice: 80 * quantity })
    );
  };
  order('ORD-1', [['stu_1', TUE, 1], ['stu_2', TUE, 2]]);
  order('ORD-2', [['stu_1', WED, 1]]);
  order('ORD-OLD', [['stu_2', '2026-11-10', 1]]);
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

test('today + next serving day numbers add up and today matches Prepare', async () => {
  const s = (await (await stats(jsonRequest('/api/admin/stats', 'GET', undefined, admin))).json()).stats;
  assert.equal(s.nextMealDate, WED);
  assert.equal(s.todayTotalMeals, 3);
  assert.equal(s.tomorrowTotalMeals, 1);
  assert.equal(s.totalItems, s.todayTotalMeals + s.tomorrowTotalMeals);
  assert.equal(s.studentsOrdered, 2, 'different children across today and the next serving day');
  assert.equal(s.totalOrders, 3, 'all time: includes the older order');
  const prepare = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${TUE}&refresh=true`, 'GET', undefined, admin))).json();
  assert.equal(prepare.totalMeals, s.todayTotalMeals);
});

test('every card names its period', () => {
  const src = readFileSync('app/admin/dashboard/page.tsx', 'utf-8');
  assert.equal(src.split('All time · paid, not cancelled').length - 1, 2, 'Total Orders and Total Order Value');
  assert.match(src, /Today \+ \{formatDatePretty\(tomorrowStr\)\} · different children/);
  assert.match(src, /Today \{stats\?\.todayTotalMeals \|\| 0\} \+ \{formatDatePretty\(tomorrowStr\)\} \{stats\?\.tomorrowTotalMeals \|\| 0\}/);
});
