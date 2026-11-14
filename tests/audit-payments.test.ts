import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { POST as checkout, GET as listOrders } from '../app/api/parent/orders/route';
import { POST as verify } from '../app/api/parent/orders/verify/route';
import { POST as webhook } from '../app/api/webhooks/cashfree/route';
import { POST as teacherCheckout } from '../app/api/teacher/orders/route';
import { needsAttention } from '../lib/payment-exceptions';

/**
 * Launch audit of the payment flow. "OK:" tests disprove a suspected bug; "BUG:" tests assert
 * the current (buggy) behaviour so the file passes, and document what should change.
 */

const env = process.env as Record<string, string | undefined>;
const blockedFetch = globalThis.fetch;
let fs: FakeFirestore;
let parentAuth: Record<string, string>;
let parent2Auth: Record<string, string>;
let ip = 0;

/** Per Cashfree-order state, keyed by our order_id. */
type CfOrder = { status: string; amount: number; paidAt?: string; attempts?: Array<{ payment_status: string }> };
let cfOrders: Map<string, CfOrder>;
let createdOrders: any[];
let refundsCreated: any[];
let paymentsDown: boolean;
let refundApiDown: boolean;
/** Simulated Cashfree create-order latency (real networks take hundreds of ms). */
let createDelayMs: number;

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

const pay = (orderId: string, paidAt: string) => {
  const o = cfOrders.get(orderId)!;
  o.status = 'PAID';
  o.paidAt = paidAt;
};

beforeEach(async () => {
  fs = useFakeFirestore();
  env.CASHFREE_APP_ID = 'test_app_id';
  env.CASHFREE_SECRET_KEY = 'test_secret_key';
  env.CASHFREE_ENV = 'TEST';

  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya', grade: '3', studentCategory: 'Primary', isActive: true });
  fs.seed('users', 'usr_p2', { id: 'usr_p2', email: 'p2@example.com', name: 'Parent Two', role: 'PARENT', phone: '9876543211' });
  fs.seed('parents', 'par_2', { id: 'par_2', userId: 'usr_p2' });
  fs.seed('students', 'stu_2', { id: 'stu_2', parentId: 'par_2', name: 'Aarav', grade: '3', studentCategory: 'Primary', isActive: true });
  fs.seed('meals', 'meal_soya', { id: 'meal_soya', name: 'Soya Masala', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('menus', 'menu_2026-11-02_primary', {
    id: 'menu_2026-11-02_primary', date: '2026-11-02', studentCategory: 'Primary', mealId: 'meal_soya',
    isHoliday: false, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', isActive: true,
  });
  fs.seed('menus', 'menu_2026-11-03_primary', {
    id: 'menu_2026-11-03_primary', date: '2026-11-03', studentCategory: 'Primary', mealId: 'meal_soya',
    isHoliday: false, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', isActive: true,
  });
  fs.seed('teacher_meals', 'TM-001', { id: 'TM-001', name: 'Veg Thali', price: 120, category: 'LUNCH', isAvailable: true, isVegetarian: true });

  parentAuth = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  parent2Auth = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p2', email: 'p2@example.com', name: 'P2', role: 'PARENT', parentId: 'par_2' })}` };

  cfOrders = new Map();
  createdOrders = [];
  refundsCreated = [];
  paymentsDown = false;
  refundApiDown = false;
  createDelayMs = 0;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    assert.ok(url.startsWith('https://sandbox.cashfree.com/pg/'), `sandbox only (got ${url})`);
    const path = url.replace('https://sandbox.cashfree.com/pg', '');
    if (method === 'POST' && path === '/orders') {
      if (createDelayMs) await new Promise((r) => setTimeout(r, createDelayMs));
      const body = JSON.parse(String(init!.body));
      if (cfOrders.has(body.order_id)) return Response.json({ message: 'order_id already present' }, { status: 409 });
      createdOrders.push(body);
      cfOrders.set(body.order_id, { status: 'ACTIVE', amount: body.order_amount });
      return Response.json({ cf_order_id: `cf_${createdOrders.length}`, order_id: body.order_id, payment_session_id: `sess_${createdOrders.length}`, order_status: 'ACTIVE', order_amount: body.order_amount });
    }
    const orderId = decodeURIComponent(path.split('/')[2] || '');
    const o = cfOrders.get(orderId);
    if (/\/refunds\/[^/]+$/.test(path)) {
      if (refundApiDown) return Response.json({ message: 'internal error' }, { status: 500 });
      const refundId = path.split('/').pop();
      const hit = refundsCreated.find((r) => r.refund_id === refundId);
      return hit ? Response.json({ ...hit, cf_refund_id: 'cfr_1', refund_status: 'PENDING' }) : Response.json({ message: 'not found' }, { status: 404 });
    }
    if (method === 'POST' && path.endsWith('/refunds')) {
      if (refundApiDown) return Response.json({ message: 'internal error' }, { status: 500 });
      const body = JSON.parse(String(init!.body));
      refundsCreated.push({ ...body, orderId });
      return Response.json({ refund_id: body.refund_id, cf_refund_id: 'cfr_1', refund_status: 'PENDING', refund_amount: body.refund_amount });
    }
    if (!o) return Response.json({ message: 'order not found' }, { status: 404 });
    if (path.endsWith('/payments')) {
      if (paymentsDown) return Response.json({ message: 'internal error' }, { status: 500 });
      if (o.status === 'PAID') {
        return Response.json([{ payment_status: 'SUCCESS', payment_amount: o.amount, payment_currency: 'INR', cf_payment_id: `pay_${orderId}`, payment_completion_time: o.paidAt }]);
      }
      return Response.json(o.attempts || []);
    }
    return Response.json({ cf_order_id: `cf_${orderId}`, order_id: orderId, order_status: o.status, order_amount: o.amount, order_currency: 'INR', payment_session_id: 'sess_existing' });
  }) as typeof fetch;
});

afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  globalThis.fetch = blockedFetch;
  delete env.CASHFREE_APP_ID;
  delete env.CASHFREE_SECRET_KEY;
  delete env.CASHFREE_ENV;
});

const line = (overrides: Record<string, unknown> = {}) => ({ studentId: 'stu_1', mealId: 'meal_soya', date: '2026-11-02', quantity: 1, mealPrice: 80, studentCategory: 'Primary', ...overrides });
const withIp = (h: Record<string, string>) => ({ ...h, 'x-forwarded-for': `10.9.0.${++ip}` });
const startCheckout = (key: string, cartItems: any[] = [line()], auth = parentAuth) =>
  checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems, paymentMethod: 'UPI', idempotencyKey: key }, withIp(auth)));
const verifyOrder = async (orderId: string, auth = parentAuth) => (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId }, auth))).json();
const parentIssues = async (auth = parentAuth) => (await (await listOrders(jsonRequest('/api/parent/orders', 'GET', undefined, auth))).json()).paymentIssues;
const stock = (id = 'menu_2026-11-02_primary') => fs.getDoc('menus', id)?.availableQuantity;

const deliverWebhook = async (payload: unknown) => {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = crypto.createHmac('sha256', 'test_secret_key').update(timestamp + body).digest('base64');
  return webhook(new Request('http://localhost:3000/api/webhooks/cashfree', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-signature': signature, 'x-webhook-timestamp': timestamp },
    body,
  }));
};
const paymentWebhook = (orderId: string) =>
  deliverWebhook({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: orderId }, payment: { payment_status: 'SUCCESS' } } });

// ---------------------------------------------------------------- 4a
test('OK 4a: closing the popup without paying reserves nothing; Pay again reopens the same payment; another cart is not blocked', async () => {
  at('2026-11-01T10:00');
  const first = await (await startCheckout('CHK-A')).json();
  assert.equal(first.paymentSessionId, 'sess_1');
  // popup closed: no payment. Nothing is reserved or recorded as an order.
  assert.equal(stock(), 50);
  assert.equal(fs.list('orders').length, 0);
  assert.equal(fs.getDoc('pending_orders', first.orderId)?.status, 'PENDING_PAYMENT');

  const again = await (await startCheckout('CHK-A')).json();
  assert.equal(again.orderId, first.orderId);
  assert.equal(again.paymentSessionId, first.paymentSessionId);
  assert.equal(createdOrders.length, 1);

  const other = await startCheckout('CHK-B', [line({ date: '2026-11-03' })]);
  assert.equal(other.status, 200, 'a different cart can still be paid');
});

// ---------------------------------------------------------------- 4b
test('OK 4b: parent pays and closes the browser: the webhook alone creates the order (no verify call)', async () => {
  at('2026-11-01T10:00');
  const { orderId } = await (await startCheckout('CHK-WH')).json();
  pay(orderId, '2026-11-01T10:02:00+05:30');
  at('2026-11-01T10:03');
  const res = await paymentWebhook(orderId);
  assert.equal(res.status, 200);
  assert.equal(fs.getDoc('orders', orderId)?.paymentStatus, 'PAID');
  assert.equal(fs.list('orderItems').length, 1);
  assert.equal(fs.list('payments').length, 1);
  assert.equal(stock(), 49);
  assert.equal(fs.getDoc('pending_orders', orderId), undefined);
  // Duplicate delivery is a no-op.
  await paymentWebhook(orderId);
  assert.equal(fs.list('orders').length, 1);
  assert.equal(stock(), 49);
});

test('OK 4b: teacher pays and closes the browser: the webhook alone creates the teacher order', async () => {
  at('2026-11-01T10:00');
  const res = await teacherCheckout(jsonRequest('/api/teacher/orders', 'POST', {
    teacherName: 'Asha Rao', teacherPhone: '9876543210', items: [{ mealId: 'TM-001', quantity: 1 }],
  }, withIp({})));
  assert.equal(res.status, 200);
  const { orderId } = await res.json();
  assert.match(orderId, /^TCH-/);
  pay(orderId, '2026-11-01T10:01:00+05:30');
  assert.equal((await paymentWebhook(orderId)).status, 200);
  assert.equal(fs.getDoc('teacher_orders', orderId)?.paymentStatus, 'PAID');
  assert.equal(fs.getDoc('pending_teacher_orders', orderId), undefined);
});

// ---------------------------------------------------------------- 4c
test('OK 4c: payment started 08:25 but completed 08:31 (webhook only): exception for admin review, no order, no auto refund, parent told', async () => {
  at('2026-11-02T08:25');
  const { orderId } = await (await startCheckout('CHK-LATE')).json();
  pay(orderId, '2026-11-02T08:31:00+05:30');
  at('2026-11-02T08:32');
  assert.equal((await paymentWebhook(orderId)).status, 200);
  assert.equal(fs.list('orders').length, 0);
  const ex = fs.getDoc('payment_exceptions', orderId)!;
  assert.equal(ex.reason, 'PAID_AFTER_CUTOFF');
  assert.equal(ex.refundState, 'MANUAL_REVIEW', 'refund is MANUAL (admin), not automatic');
  assert.equal(refundsCreated.length, 0);
  assert.equal(stock(), 50);
  const issues = await parentIssues();
  assert.equal(issues[0].state, 'PENDING_REVIEW');
});

test('OK 4c: paid 08:29 but webhook and verify only arrive at 08:45: order confirmed', async () => {
  at('2026-11-02T08:20');
  const { orderId } = await (await startCheckout('CHK-ONTIME')).json();
  pay(orderId, '2026-11-02T08:29:00+05:30');
  at('2026-11-02T08:45');
  assert.equal((await paymentWebhook(orderId)).status, 200);
  assert.equal(fs.getDoc('orders', orderId)?.paymentStatus, 'PAID');
  assert.equal((await verifyOrder(orderId)).state, 'PAID');
});

test('FIXED 4c: pressing Pay again after the cutoff while Cashfree payments lookup fails waits (503) and never marks an on-time payment late', async () => {
  at('2026-11-02T08:20');
  const { orderId } = await (await startCheckout('CHK-RETRY-LATE')).json();
  pay(orderId, '2026-11-02T08:25:00+05:30');
  at('2026-11-02T08:40');
  paymentsDown = true; // verify and webhook answer 503 in this situation; the checkout retry does not
  const retry = await startCheckout('CHK-RETRY-LATE');
  assert.equal(retry.status, 503);
  assert.equal((await retry.json()).code, 'PAYMENT_CHECK_FAILED');
  assert.equal(fs.list('orders').length, 0);
  assert.equal(fs.getDoc('payment_exceptions', orderId), undefined, 'not judged against "now"');
  assert.equal(createdOrders.length, 1, 'no second payment opened');
  // Once Cashfree recovers, the webhook confirms the 08:25 payment as an order.
  paymentsDown = false;
  assert.equal((await paymentWebhook(orderId)).status, 200);
  assert.equal(fs.list('orders').length, 1);
  assert.equal(fs.getDoc('payment_exceptions', orderId), undefined);
});

// ---------------------------------------------------------------- 4d
test('OK 4d: double-click Pay (same key, concurrent requests) creates one Cashfree order', async () => {
  at('2026-11-01T10:00');
  const [a, b] = await Promise.all([startCheckout('CHK-DBL'), startCheckout('CHK-DBL')]);
  const [ja, jb] = [await a.json(), await b.json()];
  assert.equal(createdOrders.length, 1);
  assert.equal(ja.orderId, jb.orderId);
});

test('FIXED 4d: two tabs with different checkout keys pressing Pay at the same moment share ONE Cashfree order', async () => {
  at('2026-11-01T10:00');
  createDelayMs = 50; // the gateway call takes time; the per-parent lock makes the second tab wait
  const [a, b] = await Promise.all([startCheckout('CHK-TAB-1'), startCheckout('CHK-TAB-2')]);
  const [ja, jb] = [await a.json(), await b.json()];
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(createdOrders.length, 1, 'one Cashfree order');
  assert.equal(ja.orderId, jb.orderId, 'the second tab reopens the first payment');
  pay(ja.orderId, '2026-11-01T10:01:00+05:30');
  await paymentWebhook(ja.orderId);
  assert.equal(fs.list('orders').length, 1);
  assert.equal(stock(), 49);
  assert.equal(fs.getDoc('idempotency_locks', 'gateway_par_1'), undefined, 'lock released');
});

test('FIXED 4d: two different parents are never blocked by each other', async () => {
  at('2026-11-01T10:00');
  createDelayMs = 50;
  const [a, b] = await Promise.all([startCheckout('CHK-A'), startCheckout('CHK-B', [line({ studentId: 'stu_2' })], parent2Auth)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(createdOrders.length, 2);
});

// ---------------------------------------------------------------- 4e
test('4e: two parents buy the LAST portion: no reservation at checkout; second payer gets STOCK_UNAVAILABLE + automatic refund and is told', async () => {
  fs.seed('menus', 'menu_2026-11-02_primary', { ...fs.getDoc('menus', 'menu_2026-11-02_primary'), availableQuantity: 1 });
  at('2026-11-01T10:00');
  const p1 = await (await startCheckout('CHK-P1')).json();
  const p2 = await (await startCheckout('CHK-P2', [line({ studentId: 'stu_2' })], parent2Auth)).json();
  assert.ok(p1.paymentSessionId && p2.paymentSessionId, 'both allowed to pay for the single portion (no hold)');
  assert.equal(stock(), 1);

  pay(p1.orderId, '2026-11-01T10:01:00+05:30');
  pay(p2.orderId, '2026-11-01T10:01:05+05:30');
  await Promise.all([paymentWebhook(p1.orderId), paymentWebhook(p2.orderId)]);
  assert.equal(fs.list('orders').length, 1);
  assert.equal(stock(), 0, 'never negative');
  const loser = fs.getDoc('orders', p1.orderId) ? p2.orderId : p1.orderId;
  const loserAuth = loser === p2.orderId ? parent2Auth : parentAuth;
  const ex = fs.getDoc('payment_exceptions', loser)!;
  assert.equal(ex.reason, 'STOCK_UNAVAILABLE');
  assert.equal(ex.refundState, 'REFUND_PENDING', 'refund requested automatically');
  assert.equal(refundsCreated.length, 1);
  assert.equal(refundsCreated[0].refund_amount, 80);
  const v = await verifyOrder(loser, loserAuth);
  assert.equal(v.state, 'EXCEPTION');
  assert.match(v.message, /sold out/);
  assert.match(v.message, /refund of ₹80 has been started/);
  assert.equal((await parentIssues(loserAuth))[0].state, 'REFUND_PENDING');
});

test('FIXED 4e: after a sold-out payment is refunded, the parent can buy the same cart again once it is restocked', async () => {
  fs.seed('menus', 'menu_2026-11-02_primary', { ...fs.getDoc('menus', 'menu_2026-11-02_primary'), availableQuantity: 1 });
  at('2026-11-01T10:00');
  const first = await (await startCheckout('CHK-SOLD')).json();
  // Someone else takes the last portion.
  fs.seed('menus', 'menu_2026-11-02_primary', { ...fs.getDoc('menus', 'menu_2026-11-02_primary'), availableQuantity: 0 });
  pay(first.orderId, '2026-11-01T10:01:00+05:30');
  await paymentWebhook(first.orderId);
  assert.equal(fs.getDoc('payment_exceptions', first.orderId)?.reason, 'STOCK_UNAVAILABLE');

  // Canteen restocks; parent tries again with a fresh checkout key (as the cart page would after clearing storage).
  fs.seed('menus', 'menu_2026-11-02_primary', { ...fs.getDoc('menus', 'menu_2026-11-02_primary'), availableQuantity: 10 });
  const retry = await startCheckout('CHK-SOLD-FRESH');
  assert.equal(retry.status, 200);
  const body = await retry.json();
  assert.ok(body.paymentSessionId, 'a new payment is opened');
  assert.notEqual(body.orderId, first.orderId);
  assert.equal(createdOrders.length, 2);
  // The original key still reports the review, so the refunded payment is never reopened.
  const same = await startCheckout('CHK-SOLD');
  assert.equal((await same.json()).code, 'PAYMENT_EXCEPTION');
});

// ---------------------------------------------------------------- 4f
test('OK 4f: Cashfree expiry is 30 min from checkout; pay at minute 29, webhook at minute 31 still creates the order (no local expiry)', async () => {
  at('2026-11-01T10:00');
  const { orderId } = await (await startCheckout('CHK-EXP')).json();
  assert.equal(createdOrders[0].order_expiry_time, '2026-11-01T10:30:00+05:30');
  pay(orderId, '2026-11-01T10:29:00+05:30');
  at('2026-11-01T10:31');
  assert.equal((await paymentWebhook(orderId)).status, 200);
  assert.equal(fs.getDoc('orders', orderId)?.paymentStatus, 'PAID');
});

test('4f note: a reused session keeps its ORIGINAL expiry (Pay again at minute 25 gets a session with 5 minutes left)', async () => {
  at('2026-11-01T10:00');
  const first = await (await startCheckout('CHK-EXP2')).json();
  at('2026-11-01T10:25');
  const again = await (await startCheckout('CHK-EXP2')).json();
  assert.equal(again.paymentSessionId, first.paymentSessionId);
  assert.equal(createdOrders.length, 1, 'expiry not extended; Cashfree will expire it at 10:30');
});

// ---------------------------------------------------------------- 4g
test('OK 4g: failed attempt then retry reuses the same Cashfree order; after expiry a new one is created and the old cannot be paid', async () => {
  at('2026-11-01T10:00');
  const first = await (await startCheckout('CHK-FAIL')).json();
  cfOrders.get(first.orderId)!.attempts = [{ payment_status: 'FAILED' }];
  const v = await verifyOrder(first.orderId);
  assert.equal(v.state, 'NOT_PAID');
  assert.equal(v.retryable, true);
  const retry = await (await startCheckout('CHK-FAIL')).json();
  assert.equal(retry.orderId, first.orderId);
  assert.equal(createdOrders.length, 1);

  cfOrders.get(first.orderId)!.status = 'EXPIRED';
  const expired = await startCheckout('CHK-FAIL');
  assert.equal((await expired.json()).code, 'CHECKOUT_EXPIRED');
  const fresh = await (await startCheckout('CHK-FAIL-2')).json();
  assert.notEqual(fresh.orderId, first.orderId);
  assert.equal(createdOrders.length, 2);
});

test('BUG 4g: changing the cart after a failed/abandoned attempt opens a second Cashfree order while the first is still payable; paying both double-books the shared meal', async () => {
  at('2026-11-01T10:00');
  const first = await (await startCheckout('CHK-X1')).json();
  // Parent closes popup (a UPI collect request may still be pending on the phone), adds another day.
  const second = await (await startCheckout('CHK-X2', [line(), line({ date: '2026-11-03' })])).json();
  assert.equal(createdOrders.length, 2);
  pay(first.orderId, '2026-11-01T10:03:00+05:30'); // late approval of the first UPI request
  pay(second.orderId, '2026-11-01T10:04:00+05:30');
  await paymentWebhook(first.orderId);
  await paymentWebhook(second.orderId);
  const nov2Items = fs.list('orderItems').filter((i) => i.date === '2026-11-02' && i.studentId === 'stu_1');
  assert.equal(nov2Items.length, 2, 'same child, same meal, same day booked and charged twice');
});

const teacherOrder = (headers: Record<string, string> = {}, items = [{ mealId: 'TM-001', quantity: 1 }], teacherPhone = '9876543210') =>
  teacherCheckout(jsonRequest('/api/teacher/orders', 'POST', { teacherName: 'Asha Rao', teacherPhone, items }, { 'x-forwarded-for': '10.8.0.1', ...headers }));
const guestCookie = (res: Response) => (res.headers.get('set-cookie') || '').split(';')[0];

test('FIXED 4g (teacher): retrying in the same browser reuses the open payment, so the teacher can never be charged twice', async () => {
  at('2026-11-01T10:00');
  const first = await teacherOrder();
  const a = await first.json();
  const cookie = guestCookie(first);
  const b = await (await teacherOrder({ cookie })).json();
  assert.equal(createdOrders.length, 1, 'one Cashfree order');
  assert.equal(b.orderId, a.orderId);
  assert.equal(b.paymentSessionId, a.paymentSessionId);

  // Paid but not yet confirmed: Pay again opens nothing new and points to the confirmation.
  pay(a.orderId, '2026-11-01T10:01:00+05:30');
  const c = await (await teacherOrder({ cookie })).json();
  assert.equal(c.alreadyPaid, true);
  assert.equal(c.paymentSessionId, undefined);
  assert.equal(createdOrders.length, 1);
  await paymentWebhook(a.orderId);
  assert.equal(fs.list('teacher_orders').length, 1);
});

test('FIXED 4g (teacher): a different order, a different browser, or an expired payment still gets a new payment', async () => {
  at('2026-11-01T10:00');
  const first = await teacherOrder();
  const a = await first.json();
  const cookie = guestCookie(first);
  // Another browser (no cookie for that order) never receives someone else's payment session.
  assert.notEqual((await (await teacherOrder()).json()).orderId, a.orderId);
  // Different items from the same browser: a new payment.
  assert.notEqual((await (await teacherOrder({ cookie }, [{ mealId: 'TM-001', quantity: 2 }])).json()).orderId, a.orderId);
  // The earlier payment window expired: a new payment.
  cfOrders.get(a.orderId)!.status = 'EXPIRED';
  assert.notEqual((await (await teacherOrder({ cookie })).json()).orderId, a.orderId);
  assert.equal(createdOrders.length, 4);
});

// ---------------------------------------------------------------- 11
test('11: refund API down during an automatic sold-out refund: webhook returns 200, refund left REFUND_PENDING/UNKNOWN; only a later verify/admin retries it', async () => {
  at('2026-11-01T10:00');
  const { orderId } = await (await startCheckout('CHK-RF')).json();
  // The meal sells out while this parent is paying.
  fs.seed('menus', 'menu_2026-11-02_primary', { ...fs.getDoc('menus', 'menu_2026-11-02_primary'), availableQuantity: 0 });
  pay(orderId, '2026-11-01T10:01:00+05:30');
  refundApiDown = true;
  const res = await paymentWebhook(orderId);
  assert.equal(res.status, 200, 'Cashfree will not redeliver this payment webhook');
  const ex = fs.getDoc('payment_exceptions', orderId)!;
  assert.equal(ex.refundState, 'REFUND_PENDING');
  assert.equal(ex.gatewayRefundStatus, 'UNKNOWN');
  assert.equal(refundsCreated.length, 0, 'no refund exists at Cashfree');
  // Admin list does not flag it until 15 minutes pass.
  assert.equal(needsAttention(ex, Date.now()), false);
  assert.equal(needsAttention(ex, Date.now() + 16 * 60 * 1000), true);
  // Parent is told the refund "has been started", although none exists at the gateway yet.
  const v = await verifyOrder(orderId);
  assert.match(v.message, /refund of ₹80 has been started/);

  // Recovery: a verify after the 2-minute lease retries it (no scheduler does this by itself).
  refundApiDown = false;
  at('2026-11-01T10:05');
  await verifyOrder(orderId);
  assert.equal(refundsCreated.length, 1);
});

test('OK 11: webhook returns 500 (Cashfree retries) when fulfilment throws, e.g. pending checkout missing', async () => {
  at('2026-11-01T10:00');
  cfOrders.set('ORD-UNKNOWN', { status: 'PAID', amount: 80, paidAt: '2026-11-01T10:00:00+05:30' });
  const res = await paymentWebhook('ORD-UNKNOWN');
  assert.equal(res.status, 500);
});

test('OK 11: verify while payment pending never reports success and never creates an order', async () => {
  at('2026-11-01T10:00');
  const { orderId } = await (await startCheckout('CHK-PEND')).json();
  cfOrders.get(orderId)!.attempts = [{ payment_status: 'PENDING' }];
  const v = await verifyOrder(orderId);
  assert.equal(v.state, 'PENDING');
  assert.equal(v.success, false);
  assert.equal(fs.list('orders').length, 0);
});
