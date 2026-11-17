import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, useFakeFirestore } from './helpers/session';
import { installCashfreeStub } from './helpers/cashfree-stub';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { POST as validate } from '../app/api/parent/cart/validate/route';
import { POST as checkout } from '../app/api/parent/orders/route';

/** HIGH 3: "Remove unavailable" removes only the unavailable child's line, never a sibling's valid meal. */

const DAY = '2026-11-18';
let fs: FakeFirestore;
let parent: Record<string, string>;
let cf: ReturnType<typeof installCashfreeStub>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T10:00:00+05:30') });
  cf = installCashfreeStub();
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_p', { id: 'stu_p', parentId: 'par_1', name: 'Riya', grade: '3', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_s', { id: 'stu_s', parentId: 'par_1', name: 'Arjun', grade: '8', studentCategory: 'Secondary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  for (const [cat, left] of [['Primary', 50], ['Secondary', 0]] as const) {
    const id = `menu_${DAY}_${cat.toLowerCase()}`;
    fs.seed('menus', id, { id, date: DAY, studentCategory: cat, mealId: 'meal_dal', isHoliday: false, isActive: true, availableQuantity: left, maxQuantity: 50, orderingDeadline: '08:30' });
  }
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  cf.restore();
});

const cart = [
  { cartItemId: 'stu_p-meal_dal-' + DAY, studentId: 'stu_p', studentName: 'Riya', mealId: 'meal_dal', date: DAY, quantity: 1, mealPrice: 80, studentCategory: 'Primary' },
  { cartItemId: 'stu_s-meal_dal-' + DAY, studentId: 'stu_s', studentName: 'Arjun', mealId: 'meal_dal', date: DAY, quantity: 1, mealPrice: 80, studentCategory: 'Secondary' },
];

test('the server answers per line, in cart order, so the cart can mark only the sold-out child', async () => {
  const body = await (await validate(jsonRequest('/api/parent/cart/validate', 'POST', { cartItems: cart }, parent))).json();
  assert.deepEqual(body.items.map((i: any) => i.isAvailable), [true, false]);
});

test('the checkout error names the child whose line is unavailable', async () => {
  const res = await checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: cart, paymentMethod: 'UPI', idempotencyKey: 'K1' }, parent));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).unavailableItem.studentId, 'stu_s');
});

test('the cart marks and removes lines by cartItemId (not by dish and date)', () => {
  const src = readFileSync('app/parent/cart/page.tsx', 'utf-8');
  assert.ok(!src.includes('`${it.mealId}__${it.date}`') && !src.includes('`${item.mealId}__${item.date}`'), 'no dish+date keys');
  assert.match(src, /map\[line\.cartItemId\]/);
  assert.match(src, /unavailableItemsMap\[item\.cartItemId\]/);
});
