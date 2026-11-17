import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { installCashfreeStub } from './helpers/cashfree-stub';
import { november2026Workbook } from './helpers/xlsx-builder';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { dishKey, parseMonthlyMenu } from '../lib/monthly-menu';
import { readFirstSheet } from '../lib/xlsx-reader';
import { menuDays } from '../lib/menu-day';
import { DEFAULT_BRUNCH_PRICES, normalizeBrunchPrices, priceChanges, validateBrunchPrices } from '../lib/brunch-prices';
import { getBrunchPrices } from '../lib/brunch-prices-server';
import { POST as checkout, GET as parentOrders } from '../app/api/parent/orders/route';
import { POST as verify } from '../app/api/parent/orders/verify/route';
import { POST as validateCart } from '../app/api/parent/cart/validate/route';
import { GET as parentMenu } from '../app/api/menu/route';
import { GET as getPrices, PUT as putPrices } from '../app/api/admin/menus/brunch-prices/route';
import { POST as extrasPost } from '../app/api/admin/menus/extras/route';
import { POST as importMenu } from '../app/api/admin/menus/import/route';
import { GET as adminOrders } from '../app/api/admin/orders/route';
import { GET as reports } from '../app/api/admin/reports/route';
import { POST as teacherOrder } from '../app/api/teacher/orders/route';

/**
 * Brunch price by class: Pre-primary ₹60, Primary ₹75, Secondary ₹90 by default, for every main
 * brunch whatever the dish. Extras and the teacher menu keep their own prices. Fake database only.
 */

const DAY = '2026-11-18';
const SLUG: Record<string, string> = { 'Pre-primary': 'pre_primary', Primary: 'primary', Secondary: 'secondary' };
let fs: FakeFirestore;
let parent: Record<string, string>;
let staff: Record<string, string>;
let admin: Record<string, string>;
let cf: ReturnType<typeof installCashfreeStub>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T10:00:00+05:30') });
  cf = installCashfreeStub();
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_pp', { id: 'stu_pp', parentId: 'par_1', name: 'Anaya', grade: 'UKG', division: 'A', studentCategory: 'Pre-primary', isActive: true });
  fs.seed('students', 'stu_pri', { id: 'stu_pri', parentId: 'par_1', name: 'Riya', grade: '3', division: 'A', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_pri2', { id: 'stu_pri2', parentId: 'par_1', name: 'Kabir', grade: '4', division: 'B', studentCategory: 'Primary', isActive: true });
  fs.seed('students', 'stu_sec', { id: 'stu_sec', parentId: 'par_1', name: 'Arjun', grade: '8', division: 'C', studentCategory: 'Secondary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  // The dish's own price (₹50) must never be the brunch price.
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 50, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_banana', { id: 'meal_banana', name: 'Banana', price: 10, category: 'SNACK', isVegetarian: true });
  fs.seed('meals', 'meal_plain', { id: 'meal_plain', name: 'Plain Curd', price: null, category: 'SNACK', isVegetarian: true });
  for (const c of ['Pre-primary', 'Primary', 'Secondary']) {
    fs.seed('menus', `menu_${DAY}_${SLUG[c]}`, {
      id: `menu_${DAY}_${SLUG[c]}`, date: DAY, studentCategory: c, mealId: 'meal_dal', isHoliday: false,
      isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30',
    });
  }
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  cf.restore();
});

const names: Record<string, string> = { stu_pp: 'Anaya', stu_pri: 'Riya', stu_pri2: 'Kabir', stu_sec: 'Arjun' };
/** A cart line with a forged price and class (the server must ignore both). */
const line = (studentId: string, mealId = 'meal_dal', quantity = 1, kind?: 'EXTRA') => ({
  studentId, studentName: names[studentId], mealId, date: DAY, quantity, mealPrice: 1, studentCategory: 'Secondary', ...(kind ? { kind } : {}),
});
let key = 0;
const start = async (items: any[]) => {
  const res = await checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: items, paymentMethod: 'UPI', idempotencyKey: `K${++key}` }, parent));
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body as { orderId: string; totalAmount: number };
};
const pay = async (orderId: string, amount: number) => {
  cf.paid[orderId] = amount;
  return (await verify(jsonRequest('/api/parent/orders/verify', 'POST', { orderId }, parent))).json();
};
const setPrices = (prices: Record<string, unknown>, headers = staff) => putPrices(jsonRequest('/api/admin/menus/brunch-prices', 'PUT', { prices }, headers));
const sentAmount = (orderId: string) => cf.created.find((o) => o.order_id === orderId)?.order_amount;

// --- Charging ----------------------------------------------------------------------------------

test('each class is charged its own brunch price, whatever the dish price or what the browser sends', async () => {
  const expected: Record<string, number> = { stu_pp: 60, stu_pri: 75, stu_sec: 90 };
  for (const [studentId, amount] of Object.entries(expected)) {
    const { orderId, totalAmount } = await start([line(studentId)]);
    assert.equal(totalAmount, amount, studentId);
    assert.equal(sentAmount(orderId), amount, `${studentId}: amount sent to Cashfree`);
    assert.equal(fs.getDoc('pending_orders', orderId)?.items?.[0]?.mealPrice ?? fs.getDoc('pending_orders', orderId)?.cartItems?.[0]?.mealPrice, amount);
  }
});

test('one cart with children in two classes: each line at its class price; paid lines keep it', async () => {
  const { orderId, totalAmount } = await start([line('stu_pp'), line('stu_sec')]);
  assert.equal(totalAmount, 60 + 90);
  assert.equal((await pay(orderId, 150)).state, 'PAID');
  const lines = fs.list('orderItems').filter((i) => i.orderId === orderId).map((i) => [i.studentId, i.unitPrice, i.totalPrice]).sort();
  assert.deepEqual(lines, [['stu_pp', 60, 60], ['stu_sec', 90, 90]]);
});

test('extras keep their own dish price; a dish with no price cannot be sold as an extra', async () => {
  const add = await extrasPost(jsonRequest('/api/admin/menus/extras', 'POST', { action: 'add', date: DAY, studentCategory: 'ALL', mealId: 'meal_banana', portions: 20 }, staff));
  assert.equal(add.status, 200);
  const { totalAmount } = await start([line('stu_sec'), line('stu_sec', 'meal_banana', 2, 'EXTRA')]);
  assert.equal(totalAmount, 90 + 2 * 10, 'Secondary brunch + 2 bananas at the banana price');

  const refused = await extrasPost(jsonRequest('/api/admin/menus/extras', 'POST', { action: 'add', date: DAY, studentCategory: 'Primary', mealId: 'meal_plain', portions: 5 }, staff));
  assert.equal(refused.status, 400);
  assert.match((await refused.json()).error, /extra price first/);
  assert.equal(fs.list('menuExtras').filter((e) => e.mealId === 'meal_plain').length, 0);
});

test('the teacher menu keeps its own per-dish prices', async () => {
  fs.seed('teacher_meals', 'TM-001', { id: 'TM-001', name: 'Veg Thali', price: 120, category: 'LUNCH', isAvailable: true, isVegetarian: true });
  assert.equal((await setPrices({ 'Pre-primary': 61, Primary: 76, Secondary: 91 })).status, 200);
  const res = await teacherOrder(
    new Request('http://localhost:3000/api/teacher/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.0.1' },
      body: JSON.stringify({ teacherName: 'Asha Rao', teacherPhone: '9876543210', items: [{ mealId: 'TM-001', quantity: 2, price: 1 }] }),
    })
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).totalAmount, 240);
});

// --- Price changes -----------------------------------------------------------------------------

test('a price change applies to new orders only; paid orders keep their price everywhere', async () => {
  const first = await start([line('stu_pri')]);
  assert.equal((await pay(first.orderId, 75)).state, 'PAID');

  assert.equal((await setPrices({ 'Pre-primary': 60, Primary: 100, Secondary: 90 })).status, 200);

  // The paid order: stored lines, the parent's history/receipt, admin orders and reports.
  assert.deepEqual(fs.list('orderItems').filter((i) => i.orderId === first.orderId).map((i) => [i.unitPrice, i.totalPrice]), [[75, 75]]);
  assert.equal(fs.getDoc('orders', first.orderId)?.totalAmount, 75);
  const history = (await (await parentOrders(jsonRequest('/api/parent/orders', 'GET', undefined, parent))).json()).orders;
  const mine = history.find((o: any) => o.id === first.orderId);
  assert.equal(mine.totalAmount, 75);
  assert.deepEqual(mine.items.map((i: any) => [i.unitPrice, i.totalPrice]), [[75, 75]]);
  const adminList = (await (await adminOrders(jsonRequest('/api/admin/orders', 'GET', undefined, admin))).json()).orders;
  assert.deepEqual(adminList.find((o: any) => o.id === first.orderId).items.map((i: any) => i.unitPrice), [75]);
  const r = await (await reports(jsonRequest('/api/admin/reports', 'GET', undefined, admin))).json();
  assert.equal(r.summary.totalRevenue, 75);

  // A new order uses the new price.
  const next = await start([line('stu_pri2')]);
  assert.equal(next.totalAmount, 100);
  assert.equal(sentAmount(next.orderId), 100);
});

test('a checkout started before a price change is completed at its original amount', async () => {
  const { orderId, totalAmount } = await start([line('stu_pri')]);
  assert.equal(totalAmount, 75);
  assert.equal((await setPrices({ 'Pre-primary': 60, Primary: 100, Secondary: 90 })).status, 200);
  const v = await pay(orderId, 75);
  assert.equal(v.state, 'PAID', 'the amount check uses the saved checkout amount');
  assert.equal(fs.getDoc('orders', orderId)?.totalAmount, 75);
  assert.deepEqual(fs.list('orderItems').filter((i) => i.orderId === orderId).map((i) => i.unitPrice), [75]);
  assert.equal(fs.list('payment_exceptions').length, 0);
});

// --- What is shown matches what is charged -------------------------------------------------------

test('parent menu, cart check, Student Menu cards and Month view all show the class price', async () => {
  for (const [studentId, price] of [['stu_pp', 60], ['stu_pri', 75], ['stu_sec', 90]] as const) {
    const menu = await (await parentMenu(jsonRequest(`/api/menu?date=${DAY}&childId=${studentId}`, 'GET', undefined, parent))).json();
    assert.deepEqual(menu.menus.map((m: any) => m.meal.price), [price], `${studentId} menu`);
  }

  // Cart check: per child, from the child's record (a forged class is ignored).
  const v = await (await validateCart(jsonRequest('/api/parent/cart/validate', 'POST', { cartItems: [line('stu_pp'), line('stu_pri'), line('stu_sec')] }, parent))).json();
  assert.deepEqual(v.items.map((i: any) => [i.studentId, i.serverPrice]), [['stu_pp', 60], ['stu_pri', 75], ['stu_sec', 90]]);

  const [day] = await menuDays(DAY, 1);
  assert.deepEqual(day.classes.map((c) => [c.category, c.price]), [['Pre-primary', 60], ['Primary', 75], ['Secondary', 90]]);

  // And checkout charges exactly what the cart showed.
  const { totalAmount } = await start([line('stu_pp'), line('stu_pri'), line('stu_sec')]);
  assert.equal(totalAmount, v.items.reduce((s: number, i: any) => s + i.serverPrice, 0));
});

test('the cart keeps a separate price for each child (same dish, same day, different classes)', async () => {
  const { serverPricesFrom, displayCartTotal } = await import('../lib/cart-pricing');
  const cart = [line('stu_pp'), line('stu_sec')];
  const v = await (await validateCart(jsonRequest('/api/parent/cart/validate', 'POST', { cartItems: cart }, parent))).json();
  assert.equal(displayCartTotal(cart as any, serverPricesFrom(v.items)), 150);
});

// --- Settings ------------------------------------------------------------------------------------

test('defaults 60 / 75 / 90 apply until someone saves; a broken stored value falls back per class', async () => {
  assert.deepEqual(DEFAULT_BRUNCH_PRICES, { 'Pre-primary': 60, Primary: 75, Secondary: 90 });
  assert.deepEqual((await (await getPrices(jsonRequest('/api/admin/menus/brunch-prices', 'GET', undefined, staff))).json()).prices, DEFAULT_BRUNCH_PRICES);
  assert.equal(fs.getDoc('systemSettings', 'BRUNCH_PRICES'), undefined, 'nothing is written by reading');

  fs.seed('systemSettings', 'BRUNCH_PRICES', { key: 'BRUNCH_PRICES', prices: { 'Pre-primary': 65, Primary: 'x', Secondary: 0 } });
  assert.deepEqual(await getBrunchPrices(), { 'Pre-primary': 65, Primary: 75, Secondary: 90 });
  assert.deepEqual(normalizeBrunchPrices({ Primary: 1.5, Secondary: 501 }), DEFAULT_BRUNCH_PRICES);
});

test('only staff and admin can change prices; whole rupees from ₹1 to ₹500 for all three classes', async () => {
  const parentRes = await setPrices({ 'Pre-primary': 1, Primary: 1, Secondary: 1 }, parent);
  assert.equal(parentRes.status, 403);
  assert.equal((await setPrices({ 'Pre-primary': 1, Primary: 1, Secondary: 1 }, {})).status, 403);
  assert.equal((await getPrices(jsonRequest('/api/admin/menus/brunch-prices', 'GET', undefined, parent))).status, 403);

  const bad: Array<Record<string, unknown>> = [
    { 'Pre-primary': 60, Primary: 75.5, Secondary: 90 },
    { 'Pre-primary': 0, Primary: 75, Secondary: 90 },
    { 'Pre-primary': 60, Primary: -5, Secondary: 90 },
    { 'Pre-primary': 60, Primary: 'abc', Secondary: 90 },
    { 'Pre-primary': 60, Primary: 75, Secondary: 501 },
    { 'Pre-primary': 60, Primary: 75 },
    { 'Pre-primary': 60, Primary: 75, Secondary: '' },
  ];
  for (const prices of bad) {
    const res = await setPrices(prices);
    assert.equal(res.status, 400, JSON.stringify(prices));
    assert.match((await res.json()).error, /whole number of rupees from ₹1 to ₹500/);
  }
  assert.equal(fs.getDoc('systemSettings', 'BRUNCH_PRICES'), undefined, 'nothing saved');

  const ok = await setPrices({ 'Pre-primary': '65', Primary: 80, Secondary: 500 });
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).message, /apply to new orders only/);
  const doc = fs.getDoc('systemSettings', 'BRUNCH_PRICES')!;
  assert.deepEqual(doc.prices, { 'Pre-primary': 65, Primary: 80, Secondary: 500 });
  assert.equal(doc.updatedBy, 'usr_staff');
  assert.equal((await setPrices({ 'Pre-primary': 60, Primary: 75, Secondary: 90 }, admin)).status, 200, 'admin too');
});

test('the confirmation lists old → new for each class that changes', () => {
  const v = validateBrunchPrices({ 'Pre-primary': 60, Primary: 75, Secondary: 900 });
  assert.equal(v.ok, false, '₹900 is over the ₹500 cap');
  assert.deepEqual(priceChanges(DEFAULT_BRUNCH_PRICES, { 'Pre-primary': 60, Primary: 80, Secondary: 450 }), ['Primary: ₹75 → ₹80', 'Secondary: ₹90 → ₹450']);
  assert.deepEqual(priceChanges(DEFAULT_BRUNCH_PRICES, DEFAULT_BRUNCH_PRICES), []);
});

// --- Monthly import --------------------------------------------------------------------------------

test('the monthly import works without prices; its dishes sell at the class price', async () => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-25T10:00:00+05:30') });
  const plan = parseMonthlyMenu(readFirstSheet(november2026Workbook()));
  const decisions = Object.fromEntries(
    Array.from(new Set(plan.days.flatMap((d) => Object.values(d.cells)).filter((c: any) => c.kind === 'MEAL').map((c: any) => dishKey(c.dish)))).map((k) => [k, { isVegetarian: true, noAllergens: true }])
  );
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(november2026Workbook())]), 'November_2026_Menu.xlsx');
  form.set('action', 'publish');
  form.set('options', JSON.stringify({ dishes: decisions }));
  const res = await importMenu(new Request('http://localhost:3000/api/admin/menus/import', { method: 'POST', body: form, headers: staff }));
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body.dishes?.find((d: any) => d.problems.length)));
  assert.equal(body.written, true);
  assert.ok(body.dishes.every((d: any) => !d.problems.includes('Price needed')));
  const imported = fs.list('meals').filter((m) => m.source === 'monthly-import');
  assert.ok(imported.length > 0 && imported.every((m) => m.price === null), 'new dishes have no price');

  const [monday] = await menuDays('2026-11-02', 1);
  assert.deepEqual(monday.classes.map((c) => c.price), [60, 75, 90]);
});

// --- Screens -------------------------------------------------------------------------------------

test('Student Menu and import screens: class prices card, labels, and no price asked for main brunches', () => {
  const editor = readFileSync('components/StudentMenuEditor.tsx', 'utf-8');
  for (const text of [
    'Brunch prices by class',
    'Changes apply to new orders only.',
    'Extra price (₹), used only when this dish is sold as an extra. Brunch price is set by class.',
    "'Brunch price is set by class.'",
    'Change brunch prices?',
    'priceMode="none"',
    'showPrice={false}',
  ]) {
    assert.ok(editor.includes(text), `editor shows: ${text}`);
  }
  // "Edit for this day" sends no price; "Edit everywhere" and "New dish" keep an optional extra price.
  assert.match(editor, /<DishFields initial=\{initial\} priceMode="none" submitLabel="Save for this day"/);
  assert.equal((editor.match(/priceMode="extra-optional"/g) || []).length, 2);

  const importPage = readFileSync('app/staff/menu-import/page.tsx', 'utf-8');
  assert.ok(!importPage.includes('Price (₹)'), 'the import asks no price');
  assert.match(importPage, /No price is needed: the brunch price is set by class/);
});
