import './helpers/isolate-env';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { getOffsetDateString, getTodayString, nextNonSundayDateString, APP_TIMEZONE } from '../lib/utils';
import { GET as adminOrders } from '../app/api/admin/orders/route';
import { GET as kitchen } from '../app/api/admin/kitchen/route';
import { GET as stats } from '../app/api/admin/stats/route';
import { GET as reports } from '../app/api/admin/reports/route';
import { PUT as editMeal, DELETE as deleteMeal } from '../app/api/admin/meals/route';
import { POST as adminPublish } from '../app/api/admin/menus/publish/route';
import { DELETE as removeChild } from '../app/api/parent/children/route';
import { GET as parentOrders, POST as placeOrder } from '../app/api/parent/orders/route';
import { POST as validateCart } from '../app/api/parent/cart/validate/route';

/**
 * Launch audit: menu/meal/child changes after orders exist, dashboard/kitchen/report counts,
 * and server-side cart re-validation. "BUG:" tests assert today's (wrong) behaviour.
 */
const env = process.env as Record<string, string | undefined>;
const D = '2099-02-02';
const D2 = '2099-02-03';
const PARENT_ID = 'par_usr_parent';

let fs: FakeFirestore;
let admin: Record<string, string>;
let staff: Record<string, string>;
let parent: Record<string, string>;
let ip = 0;

beforeEach(async () => {
  fs = useFakeFirestore();
  admin = await signedInAs(fs, 'ADMIN');
  staff = await signedInAs(fs, 'STAFF');
  parent = await signedInAs(fs, 'PARENT');
  fs.seed('users', 'usr_parent', { id: 'usr_parent', email: 'usr_parent@example.com', name: 'Parent P', role: 'PARENT', phone: '9876543210' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: PARENT_ID, name: 'Riya', studentId: 'S1', grade: '3', division: 'A', rollNo: '7', isActive: true });
  fs.seed('students', 'stu_2', { id: 'stu_2', parentId: PARENT_ID, name: 'Aarav', studentId: 'S2', grade: '4', division: 'B', rollNo: '2', isActive: true });
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true, allergens: null });
  fs.seed('meals', 'meal_pulao', { id: 'meal_pulao', name: 'Veg Pulao', price: 90, category: 'LUNCH', isVegetarian: true, allergens: null });
});

afterEach(() => {
  setFirestoreForTesting(null);
  delete env.ALLOW_MOCK_PAYMENTS;
});

function seedMenu(date: string, mealId = 'meal_dal', fields: Record<string, unknown> = {}) {
  const id = `menu_${date}_primary`;
  fs.seed('menus', id, {
    id, mealId, date, studentCategory: 'Primary', isHoliday: false, isActive: true,
    availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', updatedAt: '2099-01-01T00:00:00Z', ...fields,
  });
  return id;
}

function seedOrder(
  id: string,
  items: Array<{ studentId?: string; mealId?: string; date: string; quantity?: number; unitPrice?: number }>,
  fields: Record<string, unknown> = {}
) {
  let total = 0;
  items.forEach((it, i) => {
    const qty = it.quantity ?? 1;
    const unit = it.unitPrice ?? 80;
    total += qty * unit;
    fs.seed('orderItems', `oit_${id}_${i}`, {
      id: `oit_${id}_${i}`, orderId: id, studentId: it.studentId ?? 'stu_1', mealId: it.mealId ?? 'meal_dal',
      menuId: `menu_${it.date}_primary`, date: it.date, quantity: qty, unitPrice: unit, totalPrice: qty * unit, studentCategory: 'Primary',
    });
  });
  fs.seed('orders', id, {
    id, parentId: PARENT_ID, totalAmount: total, paymentStatus: 'PAID', orderStatus: 'CONFIRMED',
    createdAt: '2099-01-01T10:00:00.000Z', updatedAt: '2099-01-01T10:00:00.000Z', ...fields,
  });
}

const get = (handler: (req: Request) => Promise<Response>, url: string, headers: Record<string, string>) =>
  handler(jsonRequest(url, 'GET', undefined, headers));
const kitchenOn = async (date: string) => (await get(kitchen, `/api/admin/kitchen?date=${date}&refresh=true`, staff)).json();
const staffListOn = async (date: string) => (await (await get(adminOrders, `/api/admin/orders?date=${date}`, staff)).json()).orders;
const parentHistory = async () => (await (await get(parentOrders, '/api/parent/orders', parent)).json()).orders;
const reportSummary = async () => (await (await get(reports, '/api/admin/reports', admin)).json());

// ---------------------------------------------------------------- 5. Menu / dish / child changes

test('FIXED: renaming a dish never changes the meal name on orders that were already paid', async () => {
  seedMenu(D);
  const placed = await checkout([cartLine()]);
  assert.equal(placed.status, 200);
  const line = fs.list('orderItems')[0];
  assert.equal(line.mealName, 'Dal Khichdi', 'the name is saved on the order line when it is paid');

  const res = await editMeal(jsonRequest('/api/admin/meals', 'PUT', { id: 'meal_dal', name: 'Paneer Biryani' }, staff));
  assert.equal(res.status, 200);

  assert.equal((await parentHistory())[0].items[0].mealName, 'Dal Khichdi');
  assert.equal((await staffListOn(D))[0].items[0].mealName, 'Dal Khichdi');
  assert.equal((await kitchenOn(D)).mealCounts[0].mealName, 'Dal Khichdi');
  assert.equal((await reportSummary()).exportRows[0].mealName, 'Dal Khichdi');
});

test('FIXED: older orders saved without a meal name still show the current dish name', async () => {
  seedMenu(D);
  seedOrder('ORD-A', [{ date: D }]);
  assert.equal(fs.getDoc('orderItems', 'oit_ORD-A_0')?.mealName, undefined);
  assert.equal((await parentHistory())[0].items[0].mealName, 'Dal Khichdi');
  assert.equal((await kitchenOn(D)).mealCounts[0].mealName, 'Dal Khichdi');
});

test('OK: a price change does not change what already-paid orders cost or report', async () => {
  seedMenu(D);
  seedOrder('ORD-A', [{ date: D, quantity: 2 }]);
  assert.equal((await editMeal(jsonRequest('/api/admin/meals', 'PUT', { id: 'meal_dal', price: 120 }, staff))).status, 200);

  const item = (await parentHistory())[0].items[0];
  assert.equal(item.unitPrice, 80);
  assert.equal(item.totalPrice, 160);
  assert.equal((await reportSummary()).summary.totalRevenue, 160);
  assert.equal(fs.getDoc('orders', 'ORD-A')?.totalAmount, 160);
});

test('OK: a dish with orders cannot be deleted, so paid orders keep their meal', async () => {
  seedMenu(D);
  seedOrder('ORD-A', [{ date: D }]);
  const res = await deleteMeal(jsonRequest('/api/admin/meals?id=meal_dal', 'DELETE', undefined, admin));
  assert.equal(res.status, 400);
  assert.equal((await kitchenOn(D)).totalMeals, 1);
});

test('BUG (latent): if a meal record is missing, the whole kitchen day and the reports page fail with 500', async () => {
  // Not reachable through the API (delete is blocked), only via a direct database deletion.
  seedMenu(D);
  seedOrder('ORD-A', [{ date: D }]);
  seedOrder('ORD-B', [{ date: D, mealId: 'meal_gone' }]);
  assert.equal((await get(kitchen, `/api/admin/kitchen?date=${D}&refresh=true`, staff)).status, 500);
  assert.equal((await get(reports, '/api/admin/reports', admin)).status, 500);
  // Parent history and staff list fall back to "Meal" instead of crashing.
  assert.equal((await staffListOn(D)).length, 2);
});

test('OK: switching a dish off (publish with nothing selected) keeps paid orders everywhere, and the dish cannot then be swapped', async () => {
  seedMenu(D);
  seedOrder('ORD-A', [{ date: D }]);

  const off = await adminPublish(jsonRequest('/api/admin/menus/publish', 'POST', { date: D, studentCategory: 'Primary', selectedMealIds: [] }, admin));
  assert.equal(off.status, 200);
  assert.equal(fs.getDoc('menus', `menu_${D}_primary`)?.isActive, false);
  assert.equal((await kitchenOn(D)).totalMeals, 1);
  assert.equal((await staffListOn(D)).length, 1);
  assert.equal((await parentHistory()).length, 1);

  const swap = await adminPublish(
    jsonRequest('/api/admin/menus/publish', 'POST', { date: D, studentCategory: 'Primary', selectedMealIds: ['meal_pulao'], replace: true }, admin)
  );
  assert.equal(swap.status, 409);
  assert.equal((await swap.json()).code, 'HAS_ORDERS');
  assert.equal(fs.getDoc('menus', `menu_${D}_primary`)?.mealId, 'meal_dal');
});

test('OK: changing the dish of a date that already has orders is refused', async () => {
  seedMenu(D);
  seedOrder('ORD-A', [{ date: D }]);
  const res = await adminPublish(
    jsonRequest('/api/admin/menus/publish', 'POST', { date: D, studentCategory: 'Primary', selectedMealIds: ['meal_pulao'], replace: true }, admin)
  );
  assert.equal(res.status, 409);
  assert.equal((await kitchenOn(D)).mealCounts[0].mealName, 'Dal Khichdi');
});

test('BUG: removing a child with upcoming paid meals succeeds silently; meals stay on the kitchen list, no refund or warning', async () => {
  seedMenu(D);
  seedOrder('ORD-A', [{ date: D }]);
  const res = await removeChild(jsonRequest('/api/parent/children?id=stu_1', 'DELETE', undefined, parent));
  assert.equal(res.status, 200);
  assert.equal(fs.getDoc('students', 'stu_1')?.isActive, false, 'soft delete only');

  // Order and history survive (good) ...
  assert.equal((await parentHistory())[0].items[0].studentName, 'Riya');
  assert.equal((await staffListOn(D))[0].items[0].studentName, 'Riya');
  const k = await kitchenOn(D);
  assert.equal(k.totalMeals, 1);
  assert.equal(k.studentList[0].studentName, 'Riya');
  // ... but the paid future meal is neither cancelled nor refunded, and the response says nothing about it.
  assert.equal(fs.getDoc('orders', 'ORD-A')?.paymentStatus, 'PAID');
});

// ---------------------------------------------------------------- 6. Counts and money

function seedMix(day: string, next: string) {
  seedMenu(day);
  seedMenu(next);
  // Paid: two children, one with quantity 2 (80 + 160 = 240, 3 meals on `day`).
  seedOrder('ORD-PAID', [{ date: day, studentId: 'stu_1' }, { date: day, studentId: 'stu_2', quantity: 2 }]);
  // Paid multi-date: one meal on `day`, one on `next` (160).
  seedOrder('ORD-MULTI', [{ date: day }, { date: next }]);
  // Legacy unpaid order left in `orders` (lib/order-fulfillment.ts still handles "legacy PENDING" orders).
  seedOrder('ORD-UNPAID', [{ date: day }], { paymentStatus: 'PENDING' });
  // Cancelled orders in each refund state.
  seedOrder('ORD-REFUNDED', [{ date: day }], { orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
  seedOrder('ORD-REFPEND', [{ date: day }], { orderStatus: 'CANCELLED', paymentStatus: 'REFUND_PENDING' });
  seedOrder('ORD-REFFAIL', [{ date: day }], { orderStatus: 'CANCELLED', paymentStatus: 'REFUND_FAILED' });
  // Teacher order: 2 x 120.
  fs.seed('teacher_orders', 'TO-1', {
    id: 'TO-1', date: day, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', totalAmount: 240,
    items: [{ mealId: 'TM-1', mealName: 'Veg Thali', quantity: 2, price: 120 }], createdAt: '2099-01-01T10:00:00.000Z',
  });
  fs.seed('teacher_orders', 'TO-2', {
    id: 'TO-2', date: day, paymentStatus: 'REFUNDED', orderStatus: 'CANCELLED', totalAmount: 120,
    items: [{ mealId: 'TM-1', mealName: 'Veg Thali', quantity: 1, price: 120 }], createdAt: '2099-01-01T10:00:00.000Z',
  });
}

test('OK: kitchen summary counts only paid, active meals per item and quantity; teacher meals reported separately', async () => {
  seedMix(D, D2);
  const k = await kitchenOn(D);
  assert.equal(k.totalMeals, 4, '1 + 2 (ORD-PAID) + 1 (ORD-MULTI)');
  assert.equal(k.totalOrders, 2);
  assert.equal(k.studentList.length, 3);
  assert.equal(k.teacherOrderCount, 1);
  assert.equal(k.teacherMealsTotal, 2);
  assert.equal((await kitchenOn(D2)).totalMeals, 1);
});

test('OK: staff order list shows only paid, active orders; refunds only when asked for', async () => {
  seedMix(D, D2);
  const list = await staffListOn(D);
  assert.deepEqual(list.map((o: any) => o.id).sort(), ['ORD-MULTI', 'ORD-PAID']);
  const cancelled = (await (await get(adminOrders, `/api/admin/orders?date=${D}&orderStatus=CANCELLED`, staff)).json()).orders;
  assert.deepEqual(cancelled.map((o: any) => o.id).sort(), ['ORD-REFFAIL', 'ORD-REFPEND', 'ORD-REFUNDED']);
});

test('FIXED: admin reports count only paid orders as revenue (teacher sales are still reported separately elsewhere)', async () => {
  seedMix(D, D2);
  const r = await reportSummary();
  // Paid student revenue is 240 + 160 = 400 over 5 meals in 2 orders.
  assert.equal(r.summary.totalRevenue, 400);
  assert.equal(r.summary.totalMealsSold, 5);
  assert.equal(r.summary.totalOrders, 2);
  assert.ok(!r.exportRows.some((row: any) => row.orderId === 'ORD-UNPAID'), 'unpaid order is not in the CSV export');
  assert.ok(!r.exportRows.some((row: any) => String(row.orderId).startsWith('ORD-REF')), 'cancelled/refunded are excluded');
  assert.ok(!r.exportRows.some((row: any) => String(row.orderId).startsWith('TO-')), 'teacher orders (240 paid) are not in reports at all');
});

test('FIXED: admin dashboard stats count only paid orders in orders/value/meal totals', async () => {
  // The dashboard's "tomorrow" is the next meal date (never a Sunday).
  const tomorrow = nextNonSundayDateString(APP_TIMEZONE);
  seedMix(tomorrow, getOffsetDateString(tomorrow === getOffsetDateString(1, APP_TIMEZONE) ? 2 : 3, APP_TIMEZONE));
  const s = await (await get(stats, '/api/admin/stats', admin)).json();
  // Correct: 2 paid orders worth 400, 4 student meals tomorrow.
  assert.equal(s.stats.totalOrders, 2);
  assert.equal(s.stats.totalOrderValue, 400);
  assert.equal(s.stats.tomorrowTotalMeals, 4);
  assert.equal(s.tomorrowProduction[0].count, 4, 'production list matches the kitchen');
  assert.ok(getTodayString(APP_TIMEZONE) < tomorrow);
});

// ---------------------------------------------------------------- 8. Cart re-validation at checkout

const cartLine = (fields: Record<string, unknown> = {}) => ({
  cartItemId: 'x', studentId: 'stu_1', studentName: 'Riya', mealId: 'meal_dal', mealName: 'Dal Khichdi', mealPrice: 80, date: D, quantity: 1, ...fields,
});
const checkout = (cartItems: unknown[]) => {
  env.ALLOW_MOCK_PAYMENTS = 'true'; // test-only auto-fulfil path; Cashfree stays unreachable
  return placeOrder(
    jsonRequest('/api/parent/orders', 'POST', { cartItems, paymentMethod: 'UPI', idempotencyKey: `k${++ip}` }, { ...parent, 'x-forwarded-for': `10.9.0.${ip}` })
  );
};

test('OK: checkout re-validates sold-out, switched-off and past-cutoff meals on the server and names the item', async () => {
  seedMenu(D, 'meal_dal', { availableQuantity: 0 });
  let res = await checkout([cartLine()]);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).unavailableItem.mealId, 'meal_dal');

  seedMenu(D, 'meal_dal', { isActive: false });
  res = await checkout([cartLine()]);
  assert.equal(res.status, 400);

  const today = getTodayString(APP_TIMEZONE);
  seedMenu(today, 'meal_dal', { orderingDeadline: '00:00' });
  res = await checkout([cartLine({ date: today })]);
  assert.equal(res.status, 400);
  assert.match((await res.json()).unavailableItem.reason, /deadline|cut|closed|passed/i);

  assert.equal(fs.list('orders').length, 0);
  assert.equal(fs.list('pending_orders').length, 0);

  // The cart page's own check also flags it.
  seedMenu(D, 'meal_dal', { availableQuantity: 0 });
  const v = await (await validateCart(jsonRequest('/api/parent/cart/validate', 'POST', { cartItems: [cartLine()] }, parent))).json();
  assert.equal(v.valid, false);
  assert.equal(v.items[0].isAvailable, false);
});

test("OK: a cart line for another parent's child is refused at checkout", async () => {
  seedMenu(D);
  fs.seed('students', 'stu_other', { id: 'stu_other', parentId: 'par_someone_else', name: 'X', grade: '3', division: 'A', isActive: true });
  const res = await checkout([cartLine({ studentId: 'stu_other' })]);
  assert.equal(res.status, 403);
});

test('BUG (minor): a removed child still in the cart gives "Unauthorized child selection" instead of a clear message', async () => {
  seedMenu(D);
  fs.seed('students', 'stu_1', { ...fs.getDoc('students', 'stu_1'), isActive: false });
  const res = await checkout([cartLine()]);
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /Unauthorized child selection/);
});

test('BUG: a price change after the meal was put in the cart charges the new price while the cart showed the old one', async () => {
  seedMenu(D);
  fs.seed('meals', 'meal_dal', { ...fs.getDoc('meals', 'meal_dal'), price: 100 });
  const res = await checkout([cartLine({ mealPrice: 80, quantity: 2 })]); // cart subtotal shown: 160
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.totalAmount, 200, 'server charges the current price (correct), but the cart page never shows it');
  // The cart validate endpoint does return serverPrice, but app/parent/cart/page.tsx ignores it.
  const v = await (await validateCart(jsonRequest('/api/parent/cart/validate', 'POST', { cartItems: [cartLine()] }, parent))).json();
  assert.equal(v.items[0].serverPrice, 100);
});

test('FIXED: parent pages no longer reload on every order; staff pages refresh quietly at most every 30 seconds', async () => {
  const { readFileSync } = await import('node:fs');
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const page of ['app/parent/dashboard/page.tsx', 'app/parent/orders/page.tsx']) {
    assert.ok(!src(page).includes('onOrdersUpdate'), `${page} must not reload on other parents' orders`);
  }
  for (const page of ['app/staff/orders/page.tsx', 'app/staff/history/page.tsx']) {
    assert.match(src(page), /pollIntervalMs: 30000/, `${page} polls every 30 s`);
  }
  assert.match(src('app/staff/orders/page.tsx'), /onOrdersUpdate: \(\) => \{\s*fetchOrders\(true\)/, 'background refresh is silent');
});
