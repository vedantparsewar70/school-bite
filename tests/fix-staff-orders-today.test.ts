import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { PATCH as updateOrder } from '../app/api/admin/orders/route';
import { POST as serve } from '../app/api/staff/serve/route';

/** HIGH 8: through the admin orders API, staff change only today's orders and never hand over a whole order. */

const TUE = '2026-11-17';
const WED = '2026-11-18';
let fs: FakeFirestore;
let staff: Record<string, string>;
let admin: Record<string, string>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${TUE}T11:00:00+05:30`) });
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  for (const [id, date] of [['ORD-TUE', TUE], ['ORD-WED', WED]]) {
    fs.seed('orders', id, { id, parentId: 'par_x', totalAmount: 160, paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
    for (const s of ['stu_a', 'stu_b']) {
      fs.seed('orderItems', `${id}_${s}`, { id: `${id}_${s}`, orderId: id, studentId: s, studentCategory: 'Primary', mealId: 'meal_dal', date, quantity: 1 });
    }
  }
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

const patch = (orderId: string, orderStatus: string, date: string, who = staff) =>
  updateOrder(jsonRequest('/api/admin/orders', 'PATCH', { orderId, orderStatus, date }, who));

test('staff cannot give a whole order (siblings together) here; they serve one child at a time', async () => {
  const res = await patch('ORD-TUE', 'COLLECTED', TUE);
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /Serve screen, one child at a time/);
  assert.equal(fs.getDoc('orders', 'ORD-TUE')?.serviceDates, undefined, 'nothing marked');
  const one = await serve(jsonRequest('/api/staff/serve', 'POST', { date: TUE, orderItemIds: ['ORD-TUE_stu_a'], action: 'serve' }, staff));
  assert.equal(one.status, 200, 'per-child Serve still works');
});

test("staff cannot change another day's order here (so nothing can block a later refund)", async () => {
  for (const status of ['COLLECTED', 'PREPARING', 'READY']) {
    assert.equal((await patch('ORD-WED', status, WED)).status, 403, status);
  }
  assert.equal(fs.getDoc('orders', 'ORD-WED')?.collectedAt, undefined);
});

test("staff can still update today's preparation, and admin can do everything", async () => {
  assert.equal((await patch('ORD-TUE', 'PREPARING', TUE)).status, 200);
  assert.equal((await patch('ORD-TUE', 'READY', TUE)).status, 200);
  assert.equal((await patch('ORD-WED', 'COLLECTED', WED, admin)).status, 200);
  assert.equal((await patch('ORD-WED', 'CONFIRMED', WED, admin)).status, 200);
});
