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
import { POST as review } from '../app/api/admin/payment-exceptions/route';

/** HIGH 1: a late payment can only be accepted as an order while its meal day can still be served. */

const TUE = '2026-11-17';
let fs: FakeFirestore;
let parent: Record<string, string>;
let admin: Record<string, string>;
let cf: ReturnType<typeof installCashfreeStub>;
const at = (t: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${t}:00+05:30`) });
};

beforeEach(async () => {
  fs = useFakeFirestore();
  at(`${TUE}T08:00`);
  cf = installCashfreeStub();
  admin = await signedInAs(fs, 'ADMIN');
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya', grade: '3', division: 'A', studentCategory: 'Primary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('menus', `menu_${TUE}_primary`, {
    id: `menu_${TUE}_primary`, date: TUE, studentCategory: 'Primary', mealId: 'meal_dal', isHoliday: false,
    isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30',
  });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  cf.restore();
});

/** Checkout before 08:30, payment completes at 08:40: a PAID_AFTER_CUTOFF exception for Tuesday. */
async function latePayment(): Promise<string> {
  const res = await checkout(jsonRequest('/api/parent/orders', 'POST', {
    cartItems: [{ studentId: 'stu_1', studentName: 'Riya', mealId: 'meal_dal', date: TUE, quantity: 1, mealPrice: 80, studentCategory: 'Primary' }],
    paymentMethod: 'UPI', idempotencyKey: 'K1',
  }, parent));
  const { orderId } = await res.json();
  at(`${TUE}T08:40`);
  cf.paid[orderId] = 75;
  await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId }, parent));
  assert.equal(fs.getDoc('payment_exceptions', orderId)?.reason, 'PAID_AFTER_CUTOFF');
  return orderId;
}
const accept = (orderId: string) => review(jsonRequest('/api/admin/payment-exceptions', 'POST', { orderId, action: 'accept' }, admin));

test('accepted on the same day: the order is created', async () => {
  const orderId = await latePayment();
  at(`${TUE}T09:00`);
  assert.equal((await accept(orderId)).status, 200);
  assert.equal(fs.getDoc('orders', orderId)?.paymentStatus, 'PAID');
});

test('refused once the meal day has passed (refund instead); nothing is created', async () => {
  const orderId = await latePayment();
  at('2026-11-18T09:00');
  const res = await accept(orderId);
  assert.notEqual(res.status, 200);
  assert.match((await res.json()).error, /2026-11-17 has passed; refund it instead/);
  assert.equal(fs.getDoc('orders', orderId), undefined);
  assert.equal(fs.getDoc('payment_exceptions', orderId)?.refundState, 'MANUAL_REVIEW', 'still waiting for a decision');
});

test('refused when that day became a holiday for the child\'s class', async () => {
  const orderId = await latePayment();
  fs.seed('menus', `menu_${TUE}_primary`, { ...fs.getDoc('menus', `menu_${TUE}_primary`), isHoliday: true, holidayReason: 'Rain', isActive: false });
  at(`${TUE}T09:00`);
  const res = await accept(orderId);
  assert.notEqual(res.status, 200);
  assert.match((await res.json()).error, /holiday for Primary/);
  assert.equal(fs.getDoc('orders', orderId), undefined);
});
