import './helpers/isolate-env';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { refundIdForOrder } from '../lib/order-cancellation';
import { PATCH as cancelOwnOrder } from '../app/api/parent/orders/route';
import { PATCH as updateOrder } from '../app/api/admin/orders/route';

const env = process.env as Record<string, string | undefined>;
const blockedFetch = globalThis.fetch;
const DATE = '2099-01-05';
const MENU_ID = `menu_${DATE}_primary`;

let fs: FakeFirestore;
let parent: Record<string, string>;
let staff: Record<string, string>;
let admin: Record<string, string>;
/** Every call made to the Cashfree sandbox stub. */
let cashfreeCalls: string[];
let refundsCreated: Array<{ refund_id: string; refund_amount: number }>;
let refundStatus: string;

function seedOrder(fields: Record<string, unknown> = {}) {
  fs.seed('menus', MENU_ID, { id: MENU_ID, mealId: 'meal_soya', date: DATE, studentCategory: 'Primary', availableQuantity: 10 });
  fs.seed('orders', 'ORD-1', {
    id: 'ORD-1', parentId: 'par_usr_parent', totalAmount: 80, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', cashfreeOrderId: 'cf_1', ...fields,
  });
  fs.seed('orderItems', 'oit_1', { id: 'oit_1', orderId: 'ORD-1', mealId: 'meal_soya', menuId: MENU_ID, date: DATE, quantity: 1, studentCategory: 'Primary' });
}

beforeEach(async () => {
  fs = useFakeFirestore();
  parent = await signedInAs(fs, 'PARENT');
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  env.CASHFREE_APP_ID = 'test_app_id';
  env.CASHFREE_SECRET_KEY = 'test_secret_key';
  env.CASHFREE_ENV = 'TEST';
  cashfreeCalls = [];
  refundsCreated = [];
  refundStatus = 'PENDING';
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    assert.ok(url.startsWith('https://sandbox.cashfree.com/pg/'), `sandbox only (got ${url})`);
    cashfreeCalls.push(`${method} ${url}`);
    if (method === 'POST' && url.endsWith('/refunds')) {
      const body = JSON.parse(String(init!.body));
      refundsCreated.push(body);
      return Response.json({ refund_id: body.refund_id, cf_refund_id: 'cfr_1', refund_status: refundStatus, refund_amount: body.refund_amount });
    }
    const refundId = url.split('/refunds/')[1];
    const hit = refundId && refundsCreated.find((r) => r.refund_id === refundId);
    return hit
      ? Response.json({ ...hit, cf_refund_id: 'cfr_1', refund_status: refundStatus })
      : Response.json({ message: 'refund not found' }, { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  setFirestoreForTesting(null);
  globalThis.fetch = blockedFetch;
  delete env.CASHFREE_APP_ID;
  delete env.CASHFREE_SECRET_KEY;
  delete env.CASHFREE_ENV;
});

const patch = (handler: (req: Request) => Promise<Response>, url: string, body: unknown, headers: Record<string, string>) =>
  handler(jsonRequest(url, 'PATCH', body, headers));
const parentCancel = (headers = parent) => patch(cancelOwnOrder, '/api/parent/orders', { orderId: 'ORD-1' }, headers);
const adminCancel = (headers = admin) => patch(updateOrder, '/api/admin/orders', { orderId: 'ORD-1', orderStatus: 'CANCELLED' }, headers);

test('a parent can no longer cancel an order: 403 with the canteen number, and nothing changes', async () => {
  seedOrder();
  const res = await parentCancel();
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /contact the canteen at 9028977988/);

  const order = fs.getDoc('orders', 'ORD-1')!;
  assert.equal(order.orderStatus, 'CONFIRMED');
  assert.equal(order.paymentStatus, 'PAID');
  assert.equal(order.refundId, undefined);
  assert.equal(fs.getDoc('menus', MENU_ID)?.availableQuantity, 10, 'stock untouched');
  assert.deepEqual(cashfreeCalls, [], 'Cashfree never called');

  assert.equal((await parentCancel({})).status, 401, 'signed out');
  assert.equal((await parentCancel(admin)).status, 401, 'the parent route is for parents only');
});

test('a parent cannot retry a failed refund either; only an admin can', async () => {
  seedOrder({ orderStatus: 'CANCELLED', paymentStatus: 'REFUND_FAILED', refundId: refundIdForOrder('ORD-1'), refundAmount: 80 });
  assert.equal((await parentCancel()).status, 403);
  assert.deepEqual(cashfreeCalls, []);
  assert.equal(fs.getDoc('orders', 'ORD-1')?.paymentStatus, 'REFUND_FAILED');
});

test('staff cannot cancel or refund an order, but can still update its preparation status', async () => {
  seedOrder();
  const res = await adminCancel(staff);
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /Only an administrator/);
  assert.equal(fs.getDoc('orders', 'ORD-1')?.orderStatus, 'CONFIRMED');
  assert.deepEqual(cashfreeCalls, []);

  const preparing = await patch(updateOrder, '/api/admin/orders', { orderId: 'ORD-1', orderStatus: 'PREPARING' }, staff);
  assert.equal(preparing.status, 200);
});

test('an admin cancel refunds the full amount through Cashfree exactly once, however often it is repeated', async () => {
  seedOrder();
  const first = await adminCancel();
  assert.equal(first.status, 200);
  const body = await first.json();
  assert.equal(body.order.orderStatus, 'CANCELLED');
  assert.equal(body.order.paymentStatus, 'REFUND_PENDING');
  assert.equal(body.refundAmount, 80, 'amount shown in the admin toast');
  assert.equal(refundsCreated.length, 1);
  assert.equal(refundsCreated[0].refund_amount, 80, 'full amount');
  assert.equal(refundsCreated[0].refund_id, refundIdForOrder('ORD-1'));
  assert.equal(fs.getDoc('menus', MENU_ID)?.availableQuantity, 11, 'stock restored');

  // Pressing it again while the refund is pending only re-reads the same refund.
  refundStatus = 'SUCCESS';
  const retry = await adminCancel();
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).order.paymentStatus, 'REFUNDED');

  // Once refunded, a further cancel is refused and nothing is sent to Cashfree.
  const callsBefore = cashfreeCalls.length;
  assert.equal((await adminCancel()).status, 400);
  assert.equal(cashfreeCalls.length, callsBefore);

  assert.equal(refundsCreated.length, 1, 'never refunded twice');
  assert.equal(fs.getDoc('menus', MENU_ID)?.availableQuantity, 11, 'stock restored only once');
  const order = fs.getDoc('orders', 'ORD-1')!;
  assert.equal(order.paymentStatus, 'REFUNDED');
  assert.equal(order.cancelledBy, 'usr_admin');
});

test('an admin cannot cancel an order that was already collected', async () => {
  seedOrder({ orderStatus: 'COLLECTED', collectedAt: '2099-01-05T07:00:00.000Z' });
  const res = await adminCancel();
  assert.equal(res.status, 400);
  assert.equal(fs.getDoc('orders', 'ORD-1')?.paymentStatus, 'PAID');
  assert.deepEqual(cashfreeCalls, []);
});
