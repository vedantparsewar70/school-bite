import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, useFakeFirestore } from './helpers/session';
import { installCashfreeStub } from './helpers/cashfree-stub';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { POST as checkout } from '../app/api/parent/orders/route';
import { POST as verify } from '../app/api/parent/orders/verify/route';

/** C2: one brunch per child per day across all orders (refused at checkout; refunded if two are paid at once). */

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
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya Sharma', grade: '3', division: 'A', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_2', { id: 'stu_2', parentId: 'par_1', name: 'Arjun Sharma', grade: '4', division: 'B', studentCategory: 'Primary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('menus', `menu_${DAY}_primary`, {
    id: `menu_${DAY}_primary`, date: DAY, studentCategory: 'Primary', mealId: 'meal_dal', isHoliday: false,
    isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30',
  });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  cf.restore();
});

const brunch = (studentId = 'stu_1', studentName = 'Riya Sharma') => ({ studentId, studentName, mealId: 'meal_dal', date: DAY, quantity: 1, mealPrice: 80, studentCategory: 'Primary' });
const start = (items: any[], key: string) => checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: items, paymentMethod: 'UPI', idempotencyKey: key }, parent));
async function payAndVerify(orderId: string, amount: number) {
  cf.paid[orderId] = amount;
  return (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId }, parent))).json();
}

test('a child who already has a paid brunch that day cannot be booked again at checkout; a sibling still can', async () => {
  const first = await (await start([brunch()], 'K1')).json();
  assert.equal((await payAndVerify(first.orderId, 80)).state, 'PAID');

  const again = await start([brunch()], 'K2');
  assert.equal(again.status, 400);
  const body = await again.json();
  assert.equal(body.code, 'ALREADY_ORDERED');
  assert.match(body.error, /Riya already has a paid brunch on 2026-11-18/);
  assert.equal(cf.created.length, 1, 'no second payment link');

  assert.equal((await start([brunch('stu_2', 'Arjun Sharma')], 'K3')).status, 200, 'the sibling can still order');
});

test('two open payments for the same child and day: only one brunch is booked, the other payment is refunded automatically', async () => {
  const a = await (await start([brunch()], 'K1')).json();
  const b = await (await start([brunch(), brunch('stu_2', 'Arjun Sharma')], 'K2')).json();
  assert.equal(cf.created.length, 2);
  assert.equal((await payAndVerify(a.orderId, 80)).state, 'PAID');
  const second = await payAndVerify(b.orderId, 160);
  assert.notEqual(second.state, 'PAID');
  assert.equal(fs.list('orderItems').filter((i) => i.studentId === 'stu_1' && i.date === DAY).length, 1);
  assert.equal(fs.getDoc('payment_exceptions', b.orderId)?.reason, 'ALREADY_ORDERED');
  const refunded = cf.refunds.filter((r) => r.orderId === b.orderId);
  assert.equal(refunded.length, 1, 'refunded once');
  assert.equal(refunded[0].refund_amount, 160, 'in full');
});

test('a cancelled earlier order does not block booking the child again', async () => {
  const first = await (await start([brunch()], 'K1')).json();
  await payAndVerify(first.orderId, 80);
  fs.seed('orders', first.orderId, { ...fs.getDoc('orders', first.orderId), orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
  assert.equal((await start([brunch()], 'K2')).status, 200);
});
