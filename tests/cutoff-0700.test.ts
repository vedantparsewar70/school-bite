import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { installCashfreeStub } from './helpers/cashfree-stub';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { cutoffFor, cutoffLabel, DEFAULT_ORDERING_CUTOFF, setLoadedOrderingCutoff, validCutoff } from '../lib/ordering-cutoff';
import { loadOrderingCutoff, policyCutoffTime } from '../lib/ordering-cutoff-server';
import { menuDays } from '../lib/menu-day';
import { POST as checkout } from '../app/api/parent/orders/route';
import { POST as verify } from '../app/api/parent/orders/verify/route';
import { GET as parentMenu } from '../app/api/menu/route';
import { GET as kitchen } from '../app/api/admin/kitchen/route';
import { GET as getSettings, PUT as putSettings } from '../app/api/admin/menus/brunch-prices/route';
import { POST as extrasPost } from '../app/api/admin/menus/extras/route';
import { POST as teacherOrder } from '../app/api/teacher/orders/route';

/**
 * Parents' ordering cutoff: one setting ("Ordering closes at", 07:00 by default) for every class and
 * day, main brunch and extras. Menu entries still storing "08:30" follow the setting. Fake database only.
 */

const DAY = '2026-11-18'; // Wednesday
const SLUG: Record<string, string> = { 'Pre-primary': 'pre_primary', Primary: 'primary', Secondary: 'secondary' };
let fs: FakeFirestore;
let parent: Record<string, string>;
let staff: Record<string, string>;
let admin: Record<string, string>;
let cf: ReturnType<typeof installCashfreeStub>;
let key = 0;

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

beforeEach(async () => {
  fs = useFakeFirestore();
  at('2026-11-17T12:00');
  cf = installCashfreeStub();
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya', grade: 'Primary', division: 'A', studentCategory: 'Primary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: null, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_banana', { id: 'meal_banana', name: 'Banana', price: 10, category: 'SNACK', isVegetarian: true });
  // Existing entries still store the old 08:30 deadline; the setting must override it.
  for (const c of Object.keys(SLUG)) {
    const id = `menu_${DAY}_${SLUG[c]}`;
    fs.seed('menus', id, { id, date: DAY, studentCategory: c, mealId: 'meal_dal', isHoliday: false, isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30' });
  }
  fs.seed('menuExtras', `extra_${DAY}_primary_meal_banana`, {
    id: `extra_${DAY}_primary_meal_banana`, date: DAY, studentCategory: 'Primary', mealId: 'meal_banana', isActive: true, maxQuantity: 20, availableQuantity: 20, orderingDeadline: '08:30',
  });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  cf.restore();
  setLoadedOrderingCutoff(DEFAULT_ORDERING_CUTOFF);
});

const brunch = { studentId: 'stu_1', studentName: 'Riya', mealId: 'meal_dal', date: DAY, quantity: 1, mealPrice: 75, studentCategory: 'Primary' };
const banana = { ...brunch, mealId: 'meal_banana', mealPrice: 10, kind: 'EXTRA' };
const start = (items: any[]) => checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: items, paymentMethod: 'UPI', idempotencyKey: `K${++key}` }, parent));
const setCutoff = (orderingCutoff: unknown, headers = admin) => putSettings(jsonRequest('/api/admin/menus/brunch-prices', 'PUT', { orderingCutoff }, headers));

// --- Ordering: 06:59 accepted, 07:00 refused --------------------------------------------------------

test('main brunch: an order at 06:59 IST is accepted, at 07:00 refused (entry still stores 08:30)', async () => {
  at(`${DAY}T06:59`);
  assert.equal((await start([brunch])).status, 200);
  at(`${DAY}T07:00`);
  const late = await start([brunch]);
  assert.equal(late.status, 400);
  assert.match((await late.json()).error, /deadline \(07:00 AM\) has passed/);
});

test('extras: at 06:59 accepted with the brunch, at 07:00 refused', async () => {
  at(`${DAY}T06:59`);
  assert.equal((await start([brunch, banana])).status, 200);
  at(`${DAY}T07:00`);
  const late = await start([brunch, banana]);
  assert.equal(late.status, 400);
  // An extra alone is refused too (its own check uses the same cutoff).
  const lone = await start([banana]);
  assert.equal(lone.status, 400);
});

test('a payment completing after 07:00 becomes a PAID_AFTER_CUTOFF exception; one at 06:59 is confirmed', async () => {
  at(`${DAY}T06:50`);
  const late = await (await start([brunch])).json();
  cf.paid[late.orderId] = 75;
  // Cashfree's payment record says 07:00:30.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const res = await originalFetch(input as any, init);
    if (String(input).endsWith('/payments')) {
      const body = await res.json();
      return Response.json(body.map((p: any) => ({ ...p, payment_completion_time: `${DAY}T07:00:30+05:30` })));
    }
    return res;
  }) as typeof fetch;
  at(`${DAY}T07:05`);
  const v = await (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId: late.orderId }, parent))).json();
  assert.notEqual(v.state, 'PAID');
  assert.equal(fs.getDoc('payment_exceptions', late.orderId)?.reason, 'PAID_AFTER_CUTOFF');
  assert.equal(fs.getDoc('orders', late.orderId), undefined, 'no order created');
  globalThis.fetch = originalFetch;
});

test('a payment completing at 06:59 is confirmed even when verified after 07:00', async () => {
  at(`${DAY}T06:50`);
  const { orderId } = await (await start([brunch])).json();
  cf.paid[orderId] = 75;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const res = await originalFetch(input as any, init);
    if (String(input).endsWith('/payments')) {
      const body = await res.json();
      return Response.json(body.map((p: any) => ({ ...p, payment_completion_time: `${DAY}T06:59:00+05:30` })));
    }
    return res;
  }) as typeof fetch;
  at(`${DAY}T07:20`);
  const v = await (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId }, parent))).json();
  globalThis.fetch = originalFetch;
  assert.equal(v.state, 'PAID');
  assert.equal(fs.getDoc('payment_exceptions', orderId), undefined);
});

// --- The setting overrides stored entries everywhere ---------------------------------------------------

test('the setting overrides stored "08:30" on entries and extras: parent menu, Student Menu, Prepare', async () => {
  at(`${DAY}T07:30`);
  const menu = await (await parentMenu(jsonRequest(`/api/menu?date=${DAY}&childId=stu_1`, 'GET', undefined, parent))).json();
  assert.equal(menu.orderingCutoff, '07:00');
  assert.deepEqual(menu.menus.map((m: any) => [m.orderingDeadline, m.isDeadlinePassed, m.isAvailable]), [['07:00', true, false]]);
  assert.deepEqual(menu.extras.map((e: any) => [e.orderingDeadline, e.isAvailable]), [['07:00', false]]);

  const [d] = await menuDays(DAY, 1);
  assert.deepEqual(d.classes.map((c) => [c.deadline, c.editable]), [['07:00', false], ['07:00', false], ['07:00', false]], 'view only after the cutoff');

  const k = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${DAY}&refresh=true`, 'GET', undefined, staff))).json();
  assert.deepEqual([k.deadline, k.cutoff], ['07:00', 'FINAL']);
  at(`${DAY}T06:30`);
  const open = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${DAY}`, 'GET', undefined, staff))).json();
  assert.deepEqual([open.deadline, open.cutoff], ['07:00', 'OPEN']);
});

test('a saved cutoff applies at once everywhere (07:30): 07:15 accepted, 07:30 refused', async () => {
  assert.equal((await setCutoff('07:30')).status, 200);
  at(`${DAY}T07:15`);
  assert.equal((await start([brunch])).status, 200);
  const menu = await (await parentMenu(jsonRequest(`/api/menu?date=${DAY}&childId=stu_1`, 'GET', undefined, parent))).json();
  assert.equal(menu.orderingCutoff, '07:30');
  at(`${DAY}T07:30`);
  assert.equal((await start([brunch])).status, 400);
  assert.equal((await menuDays(DAY, 1))[0].classes[0].deadline, '07:30');
});

test('only if the setting cannot be read does the stored per-entry time apply', async () => {
  const broken = { collection: () => { throw new Error('unavailable'); } } as any;
  assert.equal(await loadOrderingCutoff(broken), null);
  assert.equal(cutoffFor('08:30'), '08:30', 'fallback to the stored time');
  assert.equal(cutoffFor(null), '07:00');
  assert.equal(await loadOrderingCutoff(), '07:00', 'readable again: the setting (07:00 by default)');
  assert.equal(cutoffFor('08:30'), '07:00');
  assert.equal(await policyCutoffTime(broken), '07:00', 'policy pages fall back to 07:00');
});

// --- Who can change it ------------------------------------------------------------------------------

test('only the admin can change "Ordering closes at"; staff see it; a real time is required', async () => {
  assert.equal((await (await getSettings(jsonRequest('/api/admin/menus/brunch-prices', 'GET', undefined, staff))).json()).orderingCutoff, '07:00');
  const byStaff = await setCutoff('07:30', staff);
  assert.equal(byStaff.status, 403);
  assert.match((await byStaff.json()).error, /Only the admin/);
  assert.equal((await setCutoff('07:30', parent)).status, 403);
  assert.equal((await setCutoff('07:30', {})).status, 403);
  for (const bad of ['7:60', '24:00', 'abc', '', '0700', 7, null]) assert.equal((await setCutoff(bad)).status, 400, String(bad));
  assert.equal(fs.getDoc('systemSettings', 'BRUNCH_PRICES'), undefined, 'nothing saved');

  // Saving the cutoff keeps the prices (same settings document) and vice versa.
  await putSettings(jsonRequest('/api/admin/menus/brunch-prices', 'PUT', { prices: { 'Pre-primary': 61, Primary: 76, Secondary: 91 } }, staff));
  const ok = await setCutoff('7:30');
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).message, /closes at 07:30/);
  const s = await (await getSettings(jsonRequest('/api/admin/menus/brunch-prices', 'GET', undefined, staff))).json();
  assert.deepEqual([s.orderingCutoff, s.prices.Primary], ['07:30', 76]);
  assert.equal(fs.getDoc('systemSettings', 'BRUNCH_PRICES')?.cutoffUpdatedBy, 'usr_admin');
});

// --- Wording ----------------------------------------------------------------------------------------

test('wording shows the setting time (07:00) everywhere 08:30 was shown', async () => {
  assert.equal(cutoffLabel('07:00'), '07:00 AM');
  assert.equal(cutoffLabel('13:15'), '1:15 PM');
  assert.equal(validCutoff('7:05'), '07:05');
  const menuPage = readFileSync('app/parent/menu/page.tsx', 'utf-8');
  assert.match(menuPage, /Order before \{cutoffLabel\(orderingCutoff\)\} on the meal day\./);
  const editor = readFileSync('components/StudentMenuEditor.tsx', 'utf-8');
  for (const t of ['Ordering closes at', 'Ordering closes: ${saved.orderingCutoff} → ${t}', 'Only the admin can change this.']) assert.ok(editor.includes(t), t);
  for (const f of ['app/refund-policy/page.tsx', 'app/terms-and-conditions/page.tsx', 'app/delivery-policy/page.tsx', 'app/about/page.tsx']) {
    const src = readFileSync(f, 'utf-8');
    assert.match(src, /await policyCutoffTime\(\)/, f);
    assert.ok(!src.includes('08:30') && !src.includes('BUSINESS_CONFIG.cancellationCutoffTime'), `${f}: no fixed 08:30`);
  }
  // No screen or library code shows a fixed 08:30 any more.
  for (const f of ['app/staff/prepare/page.tsx', 'app/admin/kitchen/page.tsx', 'components/StudentMenuEditor.tsx', 'app/parent/menu/page.tsx', 'lib/business-config.ts', 'lib/menu-orders.ts', 'lib/serving-day.ts', 'lib/availability.ts', 'lib/order-fulfillment.ts', 'app/api/menu/route.ts']) {
    assert.ok(!readFileSync(f, 'utf-8').includes("'08:30'"), `${f}: no '08:30'`);
  }
  assert.equal(await policyCutoffTime(), '07:00');
  await setCutoff('07:30');
  assert.equal(await policyCutoffTime(), '07:30', 'policy pages show the saved time');
});

// --- Teachers -----------------------------------------------------------------------------------------

test('teachers are unaffected: a teacher can order after the parents\' cutoff', async () => {
  fs.seed('teacher_meals', 'TM-001', { id: 'TM-001', name: 'Veg Thali', price: 120, category: 'LUNCH', isAvailable: true, isVegetarian: true });
  at(`${DAY}T11:30`);
  const res = await teacherOrder(new Request('http://localhost:3000/api/teacher/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.7.0.1' },
    body: JSON.stringify({ teacherName: 'Asha Rao', teacherPhone: '9876543210', items: [{ mealId: 'TM-001', quantity: 1 }] }),
  }));
  assert.equal(res.status, 200);
  for (const f of ['app/api/teacher/orders/route.ts', 'lib/teacher-orders.ts']) assert.ok(!readFileSync(f, 'utf-8').includes('ordering-cutoff'), f);
});
