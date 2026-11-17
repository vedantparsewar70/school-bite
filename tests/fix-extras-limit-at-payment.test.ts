import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { installCashfreeStub } from './helpers/cashfree-stub';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { POST as checkout } from '../app/api/parent/orders/route';
import { POST as verify } from '../app/api/parent/orders/verify/route';
import { POST as extras } from '../app/api/admin/menus/extras/route';

/** HIGH 2: "max 3 of each extra per child per day" is enforced again when the payment completes. */

const DAY = '2026-11-18';
const BANANA = `extra_${DAY}_primary_meal_banana`;
let fs: FakeFirestore;
let parent: Record<string, string>;
let cf: ReturnType<typeof installCashfreeStub>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T10:00:00+05:30') });
  cf = installCashfreeStub();
  const staff = await signedInAs(fs, 'STAFF');
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya Sharma', grade: '3', division: 'A', studentCategory: 'Primary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_banana', { id: 'meal_banana', name: 'Banana', price: 10, category: 'SNACK', isVegetarian: true });
  fs.seed('menus', `menu_${DAY}_primary`, {
    id: `menu_${DAY}_primary`, date: DAY, studentCategory: 'Primary', mealId: 'meal_dal', isHoliday: false,
    isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30',
  });
  const added = await extras(jsonRequest('/api/admin/menus/extras', 'POST', { action: 'add', date: DAY, studentCategory: 'Primary', mealId: 'meal_banana', portions: 30 }, staff));
  assert.equal(added.status, 200);
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  cf.restore();
});

const line = (mealId: string, quantity = 1, kind?: 'EXTRA') => ({
  studentId: 'stu_1', studentName: 'Riya Sharma', mealId, date: DAY, quantity, mealPrice: 1, studentCategory: 'Primary', ...(kind ? { kind } : {}),
});
const start = (items: any[], key: string) => checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: items, paymentMethod: 'UPI', idempotencyKey: key }, parent));

test('two open checkouts (3 and 2 bananas): only the first is booked, the second payment is refunded automatically', async () => {
  // The child's brunch is already paid. Then two extras-only checkouts start before either is paid,
  // so each passes the checkout check on its own.
  const brunch = await (await start([line('meal_dal')], 'K0')).json();
  cf.paid[brunch.orderId] = 80;
  assert.equal((await (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId: brunch.orderId }, parent))).json()).state, 'PAID');
  const a = await (await start([line('meal_banana', 3, 'EXTRA')], 'K1')).json();
  // (A different cart, so it is a separate payment; an identical cart would reuse the open one.)
  const b = await (await start([line('meal_banana', 2, 'EXTRA')], 'K2')).json();
  assert.equal(cf.created.length, 3);

  cf.paid[a.orderId] = 30;
  assert.equal((await (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId: a.orderId }, parent))).json()).state, 'PAID');
  cf.paid[b.orderId] = 20;
  const second = await (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId: b.orderId }, parent))).json();
  assert.notEqual(second.state, 'PAID');

  const bananas = fs.list('orderItems').filter((i) => i.kind === 'EXTRA' && i.studentId === 'stu_1');
  assert.equal(bananas.reduce((n, i) => n + i.quantity, 0), 3, 'never more than 3 per child per day');
  assert.equal(fs.getDoc('payment_exceptions', b.orderId)?.reason, 'ALREADY_ORDERED');
  assert.equal(cf.refunds.filter((r) => r.orderId === b.orderId).length, 1, 'refunded automatically, once');
  assert.equal(fs.getDoc('menuExtras', BANANA)?.availableQuantity, 27, 'stock taken only for the booked bananas');
});

test('checkout still refuses a 4th banana once 3 are paid', async () => {
  const a = await (await start([line('meal_dal'), line('meal_banana', 3, 'EXTRA')], 'K1')).json();
  cf.paid[a.orderId] = 110;
  await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId: a.orderId }, parent));
  const more = await start([line('meal_banana', 1, 'EXTRA')], 'K2');
  assert.equal(more.status, 400);
  assert.match((await more.json()).error, /At most 3 Banana per child per day/);
});
