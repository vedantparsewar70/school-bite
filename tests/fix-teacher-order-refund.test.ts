import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { GET as list, PATCH as update } from '../app/api/staff/teacher-orders/route';
import { applyRefundStatus, cancelTeacherOrderWithRefund, type RefundClient } from '../lib/order-cancellation';

/** HIGH 17 follow-up: an admin can cancel a paid teacher order and refund it in full, exactly once. */

let fs: FakeFirestore;
let admin: Record<string, string>;
let staff: Record<string, string>;
const TODAY = '2026-11-17';

/** Refund client that records calls; get() returns what was created (like Cashfree). */
function refundClient(failCreate = false) {
  const created: any[] = [];
  const client: RefundClient = {
    async create(p) {
      if (failCreate) throw Object.assign(new Error('rejected'), { status: 400 });
      created.push(p);
      return { refundId: p.refundId, cfRefundId: 'cfr_1', status: 'PENDING', amount: p.amount } as any;
    },
    async get(_orderId, refundId) {
      const hit = created.find((c) => c.refundId === refundId);
      if (!hit) throw Object.assign(new Error('not found'), { status: 404 });
      return { refundId, cfRefundId: 'cfr_1', status: 'PENDING', amount: hit.amount } as any;
    },
  };
  return { client, created };
}

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${TODAY}T10:00:00+05:30`) });
  admin = await signedInAs(fs, 'ADMIN');
  staff = await signedInAs(fs, 'STAFF');
  fs.seed('teacher_orders', 'TCH-1', {
    id: 'TCH-1', teacherName: 'Asha Rao', teacherPhone: '9876543210', date: TODAY, totalAmount: 120,
    paymentStatus: 'PAID', orderStatus: 'CONFIRMED', cashfreeOrderId: 'TCH-1', items: [{ mealId: 'tm_1', mealName: 'Thali', quantity: 1 }],
  });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

test('admin cancel refunds the full amount once, however often it is repeated', async () => {
  const { client, created } = refundClient();
  const first = await cancelTeacherOrderWithRefund({ orderId: 'TCH-1', cancelledBy: 'usr_admin' }, fs.asFirestore(), client);
  assert.equal(first.refundAmount, 120);
  assert.equal(created.length, 1);
  assert.equal(created[0].amount, 120);
  const again = await cancelTeacherOrderWithRefund({ orderId: 'TCH-1', cancelledBy: 'usr_admin' }, fs.asFirestore(), client);
  assert.equal(again.alreadyCancelled, true);
  assert.equal(created.length, 1, 'never a second refund');
  const order = fs.getDoc('teacher_orders', 'TCH-1')!;
  assert.deepEqual([order.orderStatus, order.paymentStatus, order.refundAmount], ['CANCELLED', 'REFUND_PENDING', 120]);
});

test('a refund confirmed by the gateway webhook is recorded on the teacher order', async () => {
  const { client } = refundClient();
  await cancelTeacherOrderWithRefund({ orderId: 'TCH-1', cancelledBy: 'usr_admin' }, fs.asFirestore(), client);
  const refundId = fs.getDoc('teacher_orders', 'TCH-1')!.refundId;
  await applyRefundStatus('TCH-1', { refundId, cfRefundId: 'cfr_1', status: 'SUCCESS', amount: 120 } as any, fs.asFirestore());
  assert.equal(fs.getDoc('teacher_orders', 'TCH-1')!.paymentStatus, 'REFUNDED');
});

test('a failed refund can be retried (same refund ID), not duplicated', async () => {
  const failing = refundClient(true);
  const first = await cancelTeacherOrderWithRefund({ orderId: 'TCH-1', cancelledBy: 'usr_admin' }, fs.asFirestore(), failing.client);
  assert.notEqual(first.paymentStatus, 'REFUNDED');
  const refundId = fs.getDoc('teacher_orders', 'TCH-1')!.refundId;
  const ok = refundClient();
  const retry = await cancelTeacherOrderWithRefund({ orderId: 'TCH-1', cancelledBy: 'usr_admin' }, fs.asFirestore(), ok.client);
  assert.equal(retry.alreadyCancelled, true);
  assert.equal(ok.created.length, 1);
  assert.equal(ok.created[0].refundId, refundId, 'same refund ID');
});

test('only an admin can cancel; a handed-over teacher meal cannot be cancelled', async () => {
  const byStaff = await update(jsonRequest('/api/staff/teacher-orders', 'PATCH', { orderId: 'TCH-1', orderStatus: 'CANCELLED' }, staff));
  assert.equal(byStaff.status, 403);
  assert.equal(fs.getDoc('teacher_orders', 'TCH-1')!.orderStatus, 'CONFIRMED');

  fs.seed('teacher_orders', 'TCH-1', { ...fs.getDoc('teacher_orders', 'TCH-1'), orderStatus: 'GIVEN' });
  const { client, created } = refundClient();
  await assert.rejects(cancelTeacherOrderWithRefund({ orderId: 'TCH-1', cancelledBy: 'usr_admin' }, fs.asFirestore(), client), /already handed over/);
  assert.equal(created.length, 0);
});

test('admins see cancelled teacher orders on their page; staff still see paid ones only', async () => {
  fs.seed('teacher_orders', 'TCH-2', { id: 'TCH-2', teacherName: 'B', date: TODAY, totalAmount: 80, paymentStatus: 'REFUNDED', orderStatus: 'CANCELLED', items: [] });
  const forAdmin = (await (await list(jsonRequest(`/api/staff/teacher-orders?date=${TODAY}&withCancelled=1`, 'GET', undefined, admin))).json()).orders;
  assert.deepEqual(forAdmin.map((o: any) => o.id).sort(), ['TCH-1', 'TCH-2']);
  const forStaff = (await (await list(jsonRequest(`/api/staff/teacher-orders?date=${TODAY}&withCancelled=1`, 'GET', undefined, staff))).json()).orders;
  assert.deepEqual(forStaff.map((o: any) => o.id), ['TCH-1']);
});

test('the admin page asks for confirmation with the amount and links from Admin → Orders', () => {
  const page = readFileSync('app/admin/teacher-orders/page.tsx', 'utf-8');
  assert.match(page, /window\.confirm\(/);
  assert.match(page, /and refund \$\{formatINR\(o\.totalAmount\)\} to the original payment method/);
  assert.match(page, /orderStatus: 'CANCELLED'/);
  assert.match(readFileSync('app/admin/orders/page.tsx', 'utf-8'), /href="\/admin\/teacher-orders"/);
});
