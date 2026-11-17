import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, useFakeFirestore } from './helpers/session';
import { installCashfreeStub } from './helpers/cashfree-stub';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { POST as checkout } from '../app/api/parent/orders/route';
import { POST as verify } from '../app/api/parent/orders/verify/route';

/** HIGH 4: after a payment ended as an exception, the same cart can be paid again (with a new checkout). */

const DAY = '2026-11-18';
const MENU = `menu_${DAY}_primary`;
let fs: FakeFirestore;
let parent: Record<string, string>;
let cf: ReturnType<typeof installCashfreeStub>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T10:00:00+05:30') });
  cf = installCashfreeStub();
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya', grade: '3', studentCategory: 'Primary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('menus', MENU, { id: MENU, date: DAY, studentCategory: 'Primary', mealId: 'meal_dal', isHoliday: false, isActive: true, availableQuantity: 1, maxQuantity: 50, orderingDeadline: '08:30' });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  cf.restore();
});

const items = [{ studentId: 'stu_1', studentName: 'Riya', mealId: 'meal_dal', date: DAY, quantity: 1, mealPrice: 80, studentCategory: 'Primary' }];
const pay = (key: string) => checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: items, paymentMethod: 'UPI', idempotencyKey: key }, parent));

test('the old key answers PAYMENT_EXCEPTION; a new key opens a fresh, fully checked payment', async () => {
  const first = await (await pay('K1')).json();
  fs.seed('menus', MENU, { ...fs.getDoc('menus', MENU), availableQuantity: 0 }); // sold out meanwhile
  cf.paid[first.orderId] = 80;
  await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId: first.orderId }, parent));
  assert.equal(fs.getDoc('payment_exceptions', first.orderId)?.reason, 'STOCK_UNAVAILABLE');

  fs.seed('menus', MENU, { ...fs.getDoc('menus', MENU), availableQuantity: 5 }); // back in stock
  const old = await pay('K1');
  assert.equal(old.status, 409);
  assert.equal((await old.json()).code, 'PAYMENT_EXCEPTION');

  const fresh = await pay('K2');
  assert.equal(fresh.status, 200);
  assert.notEqual((await fresh.json()).orderId, first.orderId);
});

test('the cart retries with a new key on PAYMENT_EXCEPTION (as on CHECKOUT_EXPIRED)', () => {
  const src = readFileSync('app/parent/cart/page.tsx', 'utf-8');
  assert.match(src, /data\.code === 'CHECKOUT_EXPIRED' \|\| data\.code === 'PAYMENT_EXCEPTION'/);
  assert.match(src, /submit\(checkoutKeyFor\(signature, true\)\)/);
});
