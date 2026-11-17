import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { POST as serve } from '../app/api/staff/serve/route';
import { cancelOrderWithRefund, OrderCancellationError, type RefundClient } from '../lib/order-cancellation';

/** C1: a mistaken "served" tap that was undone must not block cancelling and refunding a multi-day order. */

const TUE = '2026-11-17';
const WED = '2026-11-18';
let fs: FakeFirestore;
let staff: Record<string, string>;
const calls: any[] = [];
const refunds: RefundClient = {
  async create(p) { calls.push(p); return { refundId: p.refundId, cfRefundId: 'cfr', status: 'SUCCESS', amount: p.amount } as any; },
  async get() { throw Object.assign(new Error('not found'), { status: 404 }); },
};

beforeEach(async () => {
  fs = useFakeFirestore();
  calls.length = 0;
  mock.timers.enable({ apis: ['Date'], now: new Date(`${TUE}T11:00:00+05:30`) });
  staff = await signedInAs(fs, 'STAFF');
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_x', name: 'Riya', grade: '3', division: 'A', rollNo: '7', studentCategory: 'Primary', isActive: true });
  fs.seed('orders', 'ORD-2D', { id: 'ORD-2D', parentId: 'par_x', totalAmount: 160, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', cashfreeOrderId: 'ORD-2D' });
  for (const [id, date] of [['oit_tue', TUE], ['oit_wed', WED]]) {
    fs.seed('orderItems', id, { id, orderId: 'ORD-2D', studentId: 'stu_1', studentCategory: 'Primary', mealId: 'meal_dal', mealName: 'Dal', date, quantity: 1, unitPrice: 80, totalPrice: 80 });
  }
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

const tick = (action: 'serve' | 'undo') => serve(jsonRequest('/api/staff/serve', 'POST', { date: TUE, orderItemIds: ['oit_tue'], action }, staff));

test('served then undone: the two-day order can be cancelled and fully refunded', async () => {
  assert.equal((await tick('serve')).status, 200);
  assert.equal((await tick('undo')).status, 200);
  assert.ok(fs.getDoc('orders', 'ORD-2D')?.serviceDates?.[TUE]?.collectedAt, 'the old handover time is still stored');

  await cancelOrderWithRefund({ orderId: 'ORD-2D', cancelledBy: 'usr_admin', blockedStatuses: ['COLLECTED'], allowPreviouslyCollected: true }, fs.asFirestore(), refunds);
  assert.equal(fs.getDoc('orders', 'ORD-2D')?.orderStatus, 'CANCELLED');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, 160);
});

test('still refused while one day is really handed over', async () => {
  assert.equal((await tick('serve')).status, 200);
  await assert.rejects(
    cancelOrderWithRefund({ orderId: 'ORD-2D', cancelledBy: 'usr_admin', blockedStatuses: ['COLLECTED'], allowPreviouslyCollected: true }, fs.asFirestore(), refunds),
    (e: unknown) => e instanceof OrderCancellationError
  );
  assert.equal(calls.length, 0);
  assert.equal(fs.getDoc('orders', 'ORD-2D')?.paymentStatus, 'PAID');
});
