import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { dishSplit, dishSplitLabel } from '../lib/prepare-split';
import { GET as kitchen } from '../app/api/admin/kitchen/route';

/** Staff Prepare: each dish in "All dishes" shows its per-class split, from the API's byCategory. */

const DAY = '2026-11-18';
const CUTLET = 'Veg Cutlet + Mint Chutney + Banana';
const BIRYANI = 'Veg Biryani + Raita + Papad';
const SLUG: Record<string, string> = { 'Pre-primary': 'pre_primary', Primary: 'primary', Secondary: 'secondary' };
let fs: FakeFirestore;
let staff: Record<string, string>;
let n = 0;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${DAY}T11:00:00+05:30`) });
  staff = await signedInAs(fs, 'STAFF');
  fs.seed('meals', 'meal_cutlet', { id: 'meal_cutlet', name: CUTLET, price: null, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_biryani', { id: 'meal_biryani', name: BIRYANI, price: null, category: 'LUNCH', isVegetarian: true });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

function day(dishOf: Record<string, string>) {
  for (const cat of Object.keys(dishOf)) {
    const id = `menu_${DAY}_${SLUG[cat]}`;
    fs.seed('menus', id, { id, date: DAY, studentCategory: cat, mealId: dishOf[cat], isHoliday: false, isActive: true, availableQuantity: 400, maxQuantity: 500, orderingDeadline: '08:30' });
  }
}
function orders(cat: string, mealId: string, count: number, status = { paymentStatus: 'PAID', orderStatus: 'CONFIRMED' }) {
  for (let i = 0; i < count; i++) {
    n++;
    fs.seed('students', `stu_${n}`, { id: `stu_${n}`, parentId: 'par_p', name: `Child ${n}`, grade: cat, division: 'A', studentCategory: cat, isActive: true });
    fs.seed('orders', `ORD-${n}`, { id: `ORD-${n}`, parentId: 'par_p', totalAmount: 75, ...status, createdAt: '2026-11-17T10:00:00.000Z' });
    fs.seed('orderItems', `oit_${n}`, {
      id: `oit_${n}`, orderId: `ORD-${n}`, studentId: `stu_${n}`, studentCategory: cat, mealId, mealName: mealId === 'meal_cutlet' ? CUTLET : BIRYANI,
      menuId: `menu_${DAY}_${SLUG[cat]}`, date: DAY, quantity: 1, unitPrice: 75, totalPrice: 75,
    });
  }
}
const load = async () => (await kitchen(jsonRequest(`/api/admin/kitchen?date=${DAY}&refresh=true`, 'GET', undefined, staff))).json();

test('the split under each dish matches the API numbers (Cutlet 12: Pre-primary 12; Biryani 60: Primary 35 · Secondary 25; total 72)', async () => {
  day({ 'Pre-primary': 'meal_cutlet', Primary: 'meal_biryani', Secondary: 'meal_biryani' });
  orders('Pre-primary', 'meal_cutlet', 12);
  orders('Primary', 'meal_biryani', 35);
  orders('Secondary', 'meal_biryani', 25);
  orders('Primary', 'meal_biryani', 1, { paymentStatus: 'REFUNDED', orderStatus: 'CANCELLED' }); // not counted

  const data = await load();
  assert.equal(data.totalMeals, 72);
  const rows = data.mealCounts.map((m: any) => [m.mealName, m.quantityToPrepare, dishSplitLabel(dishSplit(m.mealName, data.byCategory))]);
  assert.deepEqual(rows, [
    [BIRYANI, 60, 'Primary 35 · Secondary 25'],
    [CUTLET, 12, 'Pre-primary 12'],
  ]);
  // Each dish's split adds up to its total, and the class cards' numbers are the same ones.
  for (const m of data.mealCounts) {
    const split = dishSplit(m.mealName, data.byCategory);
    assert.equal(split.reduce((s, x) => s + x.quantity, 0), m.quantityToPrepare, m.mealName);
    for (const s of split) {
      const card = data.byCategory.find((c: any) => c.category === s.category);
      assert.equal(card.dishes.find((d: any) => d.mealName === m.mealName).quantity, s.quantity);
    }
  }
});

test('one dish in all three classes: split in class order; a class with none is left out', async () => {
  day({ 'Pre-primary': 'meal_biryani', Primary: 'meal_biryani', Secondary: 'meal_biryani' });
  orders('Secondary', 'meal_biryani', 4);
  orders('Pre-primary', 'meal_biryani', 2);
  orders('Primary', 'meal_biryani', 3);
  const data = await load();
  assert.equal(dishSplitLabel(dishSplit(BIRYANI, data.byCategory)), 'Pre-primary 2 · Primary 3 · Secondary 4');
  assert.equal(data.mealCounts[0].quantityToPrepare, 9);
  assert.deepEqual(dishSplit(CUTLET, data.byCategory), []);
  assert.equal(dishSplitLabel([]), '');
  assert.deepEqual(dishSplit(BIRYANI, undefined), []);
});

test('Prepare page: the split is shown under each dish in "All dishes" (screen and print); the class cards stay', () => {
  const src = readFileSync('app/staff/prepare/page.tsx', 'utf-8');
  const allDishes = src.slice(src.indexOf('All dishes'), src.indexOf('CATEGORIES.map'));
  assert.match(allDishes, /dishSplitLabel\(dishSplit\(m\.mealName, data\.byCategory\)\)/);
  assert.match(allDishes, /data-testid="dish-split"/);
  assert.ok(!/print:hidden/.test(allDishes), 'also printed');
  assert.match(src, /CATEGORIES\.map\(\(c\) => \{\s*const group = byCategory\.get\(c\);/, 'class cards unchanged');
  assert.ok(!readFileSync('app/api/admin/kitchen/route.ts', 'utf-8').includes('prepare-split'), 'no API change');
});
