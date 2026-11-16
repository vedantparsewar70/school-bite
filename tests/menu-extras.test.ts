import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { POST as checkout, GET as parentOrders } from '../app/api/parent/orders/route';
import { POST as verify } from '../app/api/parent/orders/verify/route';
import { GET as parentMenu } from '../app/api/menu/route';
import { POST as extrasApi } from '../app/api/admin/menus/extras/route';
import { POST as unpublish } from '../app/api/admin/menus/unpublish/route';
import { POST as holiday } from '../app/api/admin/menus/holiday/route';
import { POST as assign } from '../app/api/admin/menus/assign/route';
import { GET as kitchen } from '../app/api/admin/kitchen/route';
import { GET as serveList, POST as serve } from '../app/api/staff/serve/route';
import { GET as menuDays } from '../app/api/staff/menu-days/route';
import { GET as reports } from '../app/api/admin/reports/route';
import { cancelOrderWithRefund, type RefundClient } from '../lib/order-cancellation';
import { applyMonthlyMenu, type MonthlyMenuPlan } from '../lib/monthly-menu';
import { notServedCsv } from '../lib/not-served';

/**
 * EXTRAS (Banana, Buttermilk…) on top of the main brunch: staff rules, parent ordering in the same
 * single payment, server price and stock, max 3 per child per day, main brunch required, allergy
 * warnings, and every screen that lists or counts meals.
 */

const DAY = '2026-11-18'; // Wednesday
const MAIN = `menu_${DAY}_primary`;
const BANANA = `extra_${DAY}_primary_meal_banana`;
const env = process.env as Record<string, string | undefined>;
const blockedFetch = globalThis.fetch;

let fs: FakeFirestore;
let staff: Record<string, string>;
let admin: Record<string, string>;
let parent: Record<string, string>;
let cf: { status: string; amount: number };
let created: any[];

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

const menu = (cat: string, mealId = 'meal_dal', extra: Record<string, unknown> = {}) =>
  fs.seed('menus', `menu_${DAY}_${cat.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, {
    id: `menu_${DAY}_${cat.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, date: DAY, studentCategory: cat, mealId, isHoliday: false,
    isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', ...extra,
  });
const extrasPost = (body: Record<string, unknown>, who = staff) => extrasApi(jsonRequest('/api/admin/menus/extras', 'POST', body, who));
const addBanana = (portions = 10, studentCategory = 'Primary') => extrasPost({ action: 'add', date: DAY, studentCategory, mealId: 'meal_banana', portions });

const line = (mealId: string, quantity = 1, kind?: 'EXTRA', studentId = 'stu_1') => ({
  studentId, studentName: 'Riya', mealId, date: DAY, quantity, mealPrice: 1, studentCategory: 'Primary', ...(kind ? { kind } : {}),
});
const startCheckout = (items: any[], key = `CHK-${Math.random()}`) =>
  checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: items, paymentMethod: 'UPI', idempotencyKey: key }, parent));
async function payFor(items: any[]) {
  const res = await startCheckout(items);
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  cf = { status: 'PAID', amount: created[created.length - 1].order_amount };
  const v = await (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId: body.orderId }, parent))).json();
  assert.equal(v.state, 'PAID', JSON.stringify(v));
  cf = { status: 'ACTIVE', amount: 0 };
  return body.orderId as string;
}

beforeEach(async () => {
  fs = useFakeFirestore();
  at('2026-11-17T10:00');
  env.CASHFREE_APP_ID = 'test_app_id';
  env.CASHFREE_SECRET_KEY = 'test_secret_key';
  env.CASHFREE_ENV = 'TEST';
  cf = { status: 'ACTIVE', amount: 0 };
  created = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    assert.ok(url.startsWith('https://sandbox.cashfree.com/pg/'), `sandbox only (got ${url})`);
    const path = url.replace('https://sandbox.cashfree.com/pg', '');
    if ((init?.method || 'GET') === 'POST' && path === '/orders') {
      const body = JSON.parse(String(init!.body));
      created.push(body);
      return Response.json({ cf_order_id: `cf_${created.length}`, order_id: body.order_id, payment_session_id: `sess_${created.length}`, order_status: 'ACTIVE', order_amount: body.order_amount });
    }
    if (path.endsWith('/payments')) {
      return Response.json(cf.status === 'PAID'
        ? [{ payment_status: 'SUCCESS', payment_amount: cf.amount, payment_currency: 'INR', cf_payment_id: `pay_${created.length}`, payment_completion_time: new Date().toISOString() }]
        : []);
    }
    return Response.json({ cf_order_id: 'cf_1', order_status: cf.status, order_amount: cf.amount, order_currency: 'INR' });
  }) as typeof fetch;

  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya', grade: '3', division: 'A', rollNo: '7', studentCategory: 'Primary', isActive: true, allergies: 'Milk' });
  fs.seed('students', 'stu_2', { id: 'stu_2', parentId: 'par_1', name: 'Arjun', grade: '4', division: 'B', rollNo: '2', studentCategory: 'Primary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };

  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_banana', { id: 'meal_banana', name: 'Banana', price: 10, category: 'SNACK', isVegetarian: true });
  fs.seed('meals', 'meal_buttermilk', { id: 'meal_buttermilk', name: 'Buttermilk', price: 15, category: 'SNACK', isVegetarian: true, allergens: 'Milk' });
  for (const c of ['Pre-primary', 'Primary', 'Secondary']) menu(c);
});

afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  globalThis.fetch = blockedFetch;
  delete env.CASHFREE_APP_ID;
  delete env.CASHFREE_SECRET_KEY;
  delete env.CASHFREE_ENV;
});

// --- Staff ------------------------------------------------------------------------------------

test('staff add an extra for one class or all 3, beside the main dish; the main dish is untouched', async () => {
  assert.equal((await addBanana(10, 'ALL')).status, 200);
  for (const c of ['pre_primary', 'primary', 'secondary']) {
    const e = fs.getDoc('menuExtras', `extra_${DAY}_${c}_meal_banana`);
    assert.deepEqual([e?.isActive, e?.maxQuantity, e?.availableQuantity, e?.orderingDeadline], [true, 10, 10, '08:30']);
  }
  assert.equal(fs.getDoc('meals', 'meal_banana')?.isExtra, true, 'marked as an extra in the dish list');
  assert.equal(fs.getDoc('menus', MAIN)?.mealId, 'meal_dal');
  assert.equal(fs.list('menus').length, 3, 'no menu entry is created for an extra');

  const day = (await (await menuDays(jsonRequest(`/api/staff/menu-days?from=${DAY}&days=1`, 'GET', undefined, staff))).json()).days[0];
  const primary = day.classes.find((c: any) => c.category === 'Primary');
  assert.equal(primary.mealName, 'Dal Khichdi');
  assert.deepEqual(primary.extras.map((x: any) => [x.mealName, x.price, x.maxQuantity, x.ordered]), [['Banana', 10, 10, 0]]);

  assert.equal((await extrasPost({ action: 'add', date: DAY, studentCategory: 'Primary', mealId: 'meal_dal', portions: 5 })).status, 400, 'the main dish cannot also be an extra');
  assert.equal((await extrasPost({ action: 'add', date: DAY, studentCategory: 'Primary', mealId: 'meal_banana', portions: 5 }, parent)).status, 403);
});

test('extras follow the main-dish rules: Sunday, holiday, no main dish, closed after 08:30; portions never below ordered', async () => {
  assert.equal((await extrasPost({ action: 'add', date: '2026-11-22', studentCategory: 'Primary', mealId: 'meal_banana', portions: 5 })).status, 400);
  fs.seed('menus', MAIN, { ...fs.getDoc('menus', MAIN), isActive: false });
  const noMain = await addBanana();
  assert.equal(noMain.status, 400);
  assert.equal((await noMain.json()).code, 'NO_MAIN_DISH');
  fs.seed('menus', MAIN, { ...fs.getDoc('menus', MAIN), isActive: true });

  assert.equal((await addBanana(10)).status, 200);
  await payFor([line('meal_dal'), line('meal_banana', 2, 'EXTRA')]);
  const low = await extrasPost({ action: 'portions', date: DAY, studentCategory: 'Primary', mealId: 'meal_banana', portions: 1 });
  assert.equal(low.status, 409);
  assert.match((await low.json()).error, /2 portions are already ordered/);
  assert.equal((await extrasPost({ action: 'portions', date: DAY, studentCategory: 'Primary', mealId: 'meal_banana', portions: 20 })).status, 200);
  assert.equal(fs.getDoc('menuExtras', BANANA)?.availableQuantity, 18);

  const remove = await extrasPost({ action: 'remove', date: DAY, studentCategory: 'Primary', mealId: 'meal_banana' });
  assert.equal(remove.status, 409);
  assert.equal((await remove.json()).error, '1 child has already ordered this. Ask the admin to cancel and refund those orders first.');

  at(`${DAY}T08:31`);
  assert.equal((await extrasPost({ action: 'portions', date: DAY, studentCategory: 'Primary', mealId: 'meal_banana', portions: 30 })).status, 400);
  assert.equal((await extrasPost({ action: 'add', date: DAY, studentCategory: 'Primary', mealId: 'meal_buttermilk', portions: 5 })).status, 400);
});

test('Holiday or Remove on the main dish is refused while paid extras exist; otherwise the extras switch off', async () => {
  await addBanana(10, 'ALL');
  // Secondary: nobody ordered, so Remove switches its extra off too.
  assert.equal((await unpublish(jsonRequest('/api/admin/menus/unpublish', 'POST', { date: DAY, studentCategory: 'Secondary' }, staff))).status, 200);
  assert.equal(fs.getDoc('menuExtras', `extra_${DAY}_secondary_meal_banana`)?.isActive, false);
  assert.equal((await holiday(jsonRequest('/api/admin/menus/holiday', 'POST', { date: DAY, studentCategory: 'Pre-primary', action: 'mark', reason: 'Sports day' }, staff))).status, 200);
  assert.equal(fs.getDoc('menuExtras', `extra_${DAY}_pre_primary_meal_banana`)?.isActive, false);

  // Primary: a paid extra exists. (Its main-dish line is moved to an unpaid order, so only the extra blocks.)
  const orderId = await payFor([line('meal_dal'), line('meal_banana', 1, 'EXTRA')]);
  // Make the main line itself not count (cancelled order), so only the extra blocks.
  for (const it of fs.list('orderItems').filter((x) => x.orderId === orderId && x.kind !== 'EXTRA')) fs.seed('orderItems', it.id, { ...it, orderId: 'ORD-OTHER' });
  const res = await holiday(jsonRequest('/api/admin/menus/holiday', 'POST', { date: DAY, studentCategory: 'Primary', action: 'mark', reason: 'Rain' }, staff));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, '1 child has already ordered extras for this day. Ask the admin to cancel and refund those orders first.');
  const rm = await unpublish(jsonRequest('/api/admin/menus/unpublish', 'POST', { date: DAY, studentCategory: 'Primary' }, staff));
  assert.equal(rm.status, 409);
  assert.equal(fs.getDoc('menus', MAIN)?.isActive, true);
  assert.equal(fs.getDoc('menuExtras', BANANA)?.isActive, true);
});

test('the main-dish rules ignore extra lines, and the monthly import never changes or removes extras', async () => {
  await addBanana(10);
  // An extra order line alone does not count as an order of the main dish.
  fs.seed('orders', 'ORD-X', { id: 'ORD-X', parentId: 'par_1', paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
  fs.seed('orderItems', 'oit_x', { id: 'oit_x', orderId: 'ORD-X', studentId: 'stu_9', mealId: 'meal_dal', kind: 'EXTRA', menuExtraId: BANANA, menuId: null, date: DAY, quantity: 1, studentCategory: 'Primary' });
  const change = await assign(jsonRequest('/api/admin/menus/assign', 'POST', { date: DAY, studentCategory: 'Secondary', mealId: 'meal_buttermilk', replace: true }, staff));
  assert.equal(change.status, 200);

  const plan: MonthlyMenuPlan = {
    title: null, month: '2026-11', issues: [],
    days: [{ row: 0, date: DAY, dayLabel: DAY, weekday: null, errors: [], cells: {
      'Pre-primary': { kind: 'MEAL', dish: 'Banana', merged: false },
      Primary: { kind: 'MEAL', dish: 'Banana', merged: false },
      Secondary: { kind: 'MEAL', dish: 'Banana', merged: false },
    } as any }],
  };
  const before = fs.list('menuExtras');
  const result = await applyMonthlyMenu(plan, { replaceUnordered: true, actorId: 'usr_staff', fileName: 'nov.xlsx' });
  assert.equal(result.written, true);
  assert.deepEqual(fs.list('menuExtras'), before, 'extras untouched by the import');
});

// --- Parents ----------------------------------------------------------------------------------

test('parents see extras under the main brunch with price, stock, max 3 and an allergy warning', async () => {
  await addBanana(10);
  await extrasPost({ action: 'add', date: DAY, studentCategory: 'Primary', mealId: 'meal_buttermilk', portions: 5 });
  const body = await (await parentMenu(jsonRequest(`/api/menu?date=${DAY}&childId=stu_1`, 'GET', undefined, parent))).json();
  assert.deepEqual(body.menus.map((m: any) => m.mealId), ['meal_dal'], 'one main brunch');
  assert.deepEqual(body.extras.map((e: any) => [e.meal.name, e.meal.price, e.availableQuantity, e.maxPerChild, e.isAvailable]), [
    ['Banana', 10, 10, 3, true],
    ['Buttermilk', 15, 5, 3, true],
  ]);
  const butter = body.extras.find((e: any) => e.meal.name === 'Buttermilk');
  assert.equal(butter.allergyEvaluation.hasConflict, true);
  assert.deepEqual(butter.allergyEvaluation.matchingAllergens.map((a: string) => a.toLowerCase()), ['milk']);
  const secondary = await (await parentMenu(jsonRequest(`/api/menu?date=${DAY}&category=Secondary`, 'GET'))).json();
  assert.deepEqual(secondary.extras, [], 'extras are per class');
});

test('one payment for brunch + extras: server prices, stock taken from the extra, lines marked EXTRA, allergy flagged', async () => {
  await addBanana(10);
  await extrasPost({ action: 'add', date: DAY, studentCategory: 'Primary', mealId: 'meal_buttermilk', portions: 5 });
  const orderId = await payFor([line('meal_dal'), line('meal_banana', 2, 'EXTRA'), line('meal_buttermilk', 1, 'EXTRA')]);

  assert.equal(created.length, 1, 'one Cashfree order');
  assert.equal(created[0].order_amount, 80 + 2 * 10 + 15, 'server prices, not the cart price of ₹1');
  const items = fs.list('orderItems').filter((it) => it.orderId === orderId);
  const banana = items.find((it) => it.mealId === 'meal_banana')!;
  assert.deepEqual([banana.kind, banana.menuExtraId, banana.menuId, banana.unitPrice, banana.quantity], ['EXTRA', BANANA, null, 10, 2]);
  const main = items.find((it) => it.mealId === 'meal_dal')!;
  assert.equal(main.kind, undefined, 'main lines are as before');
  assert.equal(main.menuId, MAIN);
  assert.equal(items.find((it) => it.mealId === 'meal_buttermilk')!.hasAllergyAlert, true);
  assert.equal(fs.getDoc('menuExtras', BANANA)?.availableQuantity, 8);
  assert.equal(fs.getDoc('menus', MAIN)?.availableQuantity, 49);

  const history = (await (await parentOrders(jsonRequest('/api/parent/orders', 'GET', undefined, parent))).json()).orders;
  assert.deepEqual(
    history[0].items.map((i: any) => [i.mealName, i.isExtra]).sort(),
    [['Banana', true], ['Buttermilk', true], ['Dal Khichdi', false]]
  );
});

test('extras need that day\'s brunch for the child (same cart or an earlier paid order), and at most 3 per child per day', async () => {
  await addBanana(20);
  const alone = await startCheckout([line('meal_banana', 1, 'EXTRA')]);
  assert.equal(alone.status, 400);
  assert.match((await alone.json()).error, /Banana is an extra: add that day's brunch for this child too/);
  const otherChild = await startCheckout([line('meal_dal', 1, undefined, 'stu_2'), line('meal_banana', 1, 'EXTRA')]);
  assert.equal(otherChild.status, 400, "a sibling's brunch does not count");

  const four = await startCheckout([line('meal_dal'), line('meal_banana', 4, 'EXTRA')]);
  assert.equal(four.status, 400);
  assert.match((await four.json()).error, /At most 3 Banana per child per day/);

  await payFor([line('meal_dal'), line('meal_banana', 2, 'EXTRA')]);
  // Later: the brunch is already paid, so an extra alone is fine, but only 1 more banana.
  const two = await startCheckout([line('meal_banana', 2, 'EXTRA')]);
  assert.equal(two.status, 400);
  assert.match((await two.json()).error, /\(2 already ordered\)/);
  await payFor([line('meal_banana', 1, 'EXTRA')]);
  assert.equal(fs.getDoc('menuExtras', BANANA)?.availableQuantity, 17);
});

test('sold-out, switched-off and late extras are refused before any payment', async () => {
  await addBanana(1);
  const many = await startCheckout([line('meal_dal'), line('meal_banana', 2, 'EXTRA')]);
  assert.equal(many.status, 400);
  assert.match((await many.json()).error, /Only 1 portions remaining/);
  await extrasPost({ action: 'remove', date: DAY, studentCategory: 'Primary', mealId: 'meal_banana' });
  const off = await startCheckout([line('meal_dal'), line('meal_banana', 1, 'EXTRA')]);
  assert.equal(off.status, 400);
  assert.match((await off.json()).error, /not available for this date\/category/);
  assert.equal(created.length, 0, 'no payment link was created');

  // A checkout without extras is exactly as before.
  const plain = await startCheckout([line('meal_dal')]);
  assert.equal(plain.status, 200);
  assert.equal(created[0].order_amount, 80);
});

test('an extra cannot be added after the main-dish deadline of the class, even with the brunch already paid', async () => {
  await addBanana(5);
  await payFor([line('meal_dal')]);
  at(`${DAY}T08:31`);
  const late = await startCheckout([line('meal_banana', 1, 'EXTRA')]);
  assert.equal(late.status, 400);
  assert.match((await late.json()).error, /Ordering deadline \(08:30 AM\) has passed/);
});

test('an extra switched off after payment started becomes a payment exception, as for the main dish', async () => {
  await addBanana(5);
  const res = await startCheckout([line('meal_dal'), line('meal_banana', 1, 'EXTRA')]);
  const { orderId } = await res.json();
  fs.seed('menuExtras', BANANA, { ...fs.getDoc('menuExtras', BANANA), isActive: false });
  cf = { status: 'PAID', amount: 90 };
  const v = await (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId }, parent))).json();
  assert.notEqual(v.state, 'PAID');
  assert.equal(fs.list('orders').length, 0, 'no order is created');
  assert.ok(fs.list('payment_exceptions').length === 1 || fs.getDoc('pending_orders', orderId)?.status === 'PAYMENT_EXCEPTION');
});

// --- After payment ----------------------------------------------------------------------------

test('Prepare lists extras separately; Serve shows them and one tick serves everything; Not served and Reports include them', async () => {
  at(`${DAY}T07:00`);
  await addBanana(10);
  at('2026-11-17T10:00');
  const orderId = await payFor([line('meal_dal'), line('meal_banana', 2, 'EXTRA')]);
  await payFor([line('meal_dal', 1, undefined, 'stu_2')]);
  at(`${DAY}T11:00`);

  const k = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${DAY}&refresh=true`, 'GET', undefined, staff))).json();
  assert.equal(k.totalMeals, 2, 'meal totals are the main brunch only');
  assert.deepEqual(k.mealCounts.map((m: any) => [m.mealName, m.count]), [['Dal Khichdi', 2]]);
  assert.deepEqual(k.extrasByCategory, [{ category: 'Primary', total: 2, extras: [{ mealName: 'Banana', quantity: 2 }] }]);
  assert.equal(k.extraList[0].studentName, 'Riya');

  const rows = (await (await serveList(jsonRequest(`/api/staff/serve?date=${DAY}`, 'GET', undefined, staff))).json()).rows;
  const riya = rows.find((r: any) => r.studentName === 'Riya');
  assert.deepEqual(riya.meals.map((m: any) => [m.mealName, m.quantity, m.isExtra]), [['Dal Khichdi', 1, false], ['Banana', 2, true]]);
  assert.match(notServedCsv(DAY, rows, []), /"Riya","3-A","7","Primary","Dal Khichdi; Banana x 2 \(extra\)"/);

  const tick = await serve(jsonRequest('/api/staff/serve', 'POST', { date: DAY, orderItemIds: riya.meals.map((m: any) => m.orderItemId), action: 'serve' }, staff));
  assert.equal(tick.status, 200);
  const after = (await (await serveList(jsonRequest(`/api/staff/serve?date=${DAY}`, 'GET', undefined, staff))).json()).rows.find((r: any) => r.studentName === 'Riya');
  assert.equal(after.served, true);
  assert.ok(after.meals.every((m: any) => m.servedAt));
  assert.equal(fs.getDoc('orders', orderId)?.serviceDates?.[DAY]?.status, 'COLLECTED');

  const r = await (await reports(jsonRequest('/api/admin/reports', 'GET', undefined, admin))).json();
  assert.equal(r.summary.totalRevenue, 80 + 20 + 80, 'revenue includes extras');
  assert.equal(r.summary.totalMealsSold, 2);
  assert.equal(r.summary.totalExtrasSold, 2);
  assert.deepEqual(r.mostOrderedExtras.map((e: any) => [e.mealName, e.count]), [['Banana', 2]]);
});

test('cancelling an order with extras refunds the whole amount and puts both stocks back', async () => {
  await addBanana(10);
  const orderId = await payFor([line('meal_dal'), line('meal_banana', 3, 'EXTRA')]);
  assert.equal(fs.getDoc('menuExtras', BANANA)?.availableQuantity, 7);
  const calls: any[] = [];
  const refunds: RefundClient = {
    async create(p) { calls.push(p); return { refundId: p.refundId, cfRefundId: 'cfr', status: 'SUCCESS', amount: p.amount } as any; },
    async get() { throw Object.assign(new Error('not found'), { status: 404 }); },
  };
  await cancelOrderWithRefund({ orderId, cancelledBy: 'usr_admin', blockedStatuses: ['COLLECTED'] }, fs.asFirestore(), refunds);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, 80 + 30, 'the whole order, extras included');
  assert.equal(fs.getDoc('orders', orderId)?.orderStatus, 'CANCELLED');
  assert.equal(fs.getDoc('menuExtras', BANANA)?.availableQuantity, 10);
  assert.equal(fs.getDoc('menus', MAIN)?.availableQuantity, 50);
  // After the cancel, the extra can be removed.
  assert.equal((await extrasPost({ action: 'remove', date: DAY, studentCategory: 'Primary', mealId: 'meal_banana' })).status, 200);
});
