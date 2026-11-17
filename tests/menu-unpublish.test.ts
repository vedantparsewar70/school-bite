import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { POST as unpublish } from '../app/api/admin/menus/unpublish/route';
import { PUT as updateMenu } from '../app/api/admin/menus/route';
import { GET as parentMenu } from '../app/api/menu/route';
import { POST as checkout } from '../app/api/parent/orders/route';

/**
 * Staff → Student Menu "Unpublish" (and Admin → Menu): takes one category's dish off sale for a date,
 * only while no child has a paid, active order for it.
 */

const DATE = '2026-11-18'; // Wednesday
const PRIMARY = `menu_${DATE}_primary`;
const SECONDARY = `menu_${DATE}_secondary`;

const env = process.env as Record<string, string | undefined>;
const blockedFetch = globalThis.fetch;
let fs: FakeFirestore;
let staff: Record<string, string>;
let admin: Record<string, string>;
let parent: Record<string, string>;
let cashfreeCalls: number;

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

function menu(id: string, studentCategory: string, extra: Record<string, unknown> = {}) {
  fs.seed('menus', id, {
    id, date: DATE, studentCategory, mealId: 'meal_dal', isHoliday: false,
    availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', isActive: true, ...extra,
  });
}

function order(id: string, lines: Array<{ item: string; studentId: string; menuId?: string | null; studentCategory?: string }>, fields: Record<string, unknown> = {}) {
  fs.seed('orders', id, { id, parentId: 'par_x', totalAmount: 80 * lines.length, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', ...fields });
  for (const l of lines) {
    fs.seed('orderItems', l.item, {
      id: l.item, orderId: id, studentId: l.studentId, mealId: 'meal_dal', mealName: 'Dal Khichdi', date: DATE,
      studentCategory: l.studentCategory ?? 'Primary', menuId: l.menuId === undefined ? PRIMARY : l.menuId,
      quantity: 1, unitPrice: 80, totalPrice: 80,
    });
  }
}

const unpublishAs = (who: Record<string, string>, body: Record<string, unknown> = { date: DATE, studentCategory: 'Primary' }) =>
  unpublish(jsonRequest('/api/admin/menus/unpublish', 'POST', body, who));

beforeEach(async () => {
  fs = useFakeFirestore();
  at('2026-11-17T11:00');
  env.CASHFREE_APP_ID = 'test_app_id';
  env.CASHFREE_SECRET_KEY = 'test_secret_key';
  env.CASHFREE_ENV = 'TEST';
  cashfreeCalls = 0;
  globalThis.fetch = (async () => {
    cashfreeCalls += 1;
    return Response.json({ message: 'no payment expected in these tests' }, { status: 500 });
  }) as typeof fetch;

  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya', grade: '3', studentCategory: 'Primary', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };

  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  menu(PRIMARY, 'Primary');
  menu(SECONDARY, 'Secondary');
});

afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
  globalThis.fetch = blockedFetch;
  delete env.CASHFREE_APP_ID;
  delete env.CASHFREE_SECRET_KEY;
  delete env.CASHFREE_ENV;
});

test('staff unpublish with no orders takes only that category off sale, and parents cannot order it', async () => {
  // An unpaid attempt and a cancelled order do not count.
  order('ORD-UNPAID', [{ item: 'oit_unpaid', studentId: 'stu_a' }], { paymentStatus: 'PENDING' });
  order('ORD-CANCELLED', [{ item: 'oit_cancel', studentId: 'stu_b' }], { orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });

  const res = await unpublishAs(staff);
  assert.equal(res.status, 200);
  assert.match((await res.json()).message, /no longer on sale/);
  assert.equal(fs.getDoc('menus', PRIMARY)?.isActive, false, 'switched off, not deleted');
  assert.equal(fs.getDoc('menus', PRIMARY)?.withdrawnBy, 'usr_staff');
  assert.equal(fs.getDoc('menus', SECONDARY)?.isActive, true, 'other categories untouched');

  // The parent menu no longer offers it...
  const menuRes = await parentMenu(jsonRequest(`/api/menu?date=${DATE}&category=Primary`, 'GET', undefined, parent));
  const menus = (await menuRes.json()).menus as any[];
  assert.ok(menus.length > 0);
  assert.ok(menus.every((m) => m.isAvailable === false), 'nothing orderable for Primary');

  // ...and checkout refuses it before any payment is started.
  const cart = [{ studentId: 'stu_1', mealId: 'meal_dal', date: DATE, quantity: 1, mealPrice: 80, studentCategory: 'Primary' }];
  const paid = await checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: cart, paymentMethod: 'UPI', idempotencyKey: 'CHK-1' }, parent));
  const refusal = await paid.json();
  assert.equal(paid.status, 400);
  assert.match(refusal.error, /not available for this date\/category/);
  assert.equal(cashfreeCalls, 0, 'no payment link created');
  assert.equal(fs.list('orders').filter((o) => o.paymentStatus === 'PAID').length, 0);
});

test('unpublish is refused while children have paid orders for that dish, date and category', async () => {
  order('ORD-1', [{ item: 'oit_1', studentId: 'stu_a' }]);
  const one = await unpublishAs(staff);
  assert.equal(one.status, 409);
  const body = await one.json();
  assert.equal(body.code, 'HAS_ORDERS');
  assert.equal(body.error, '1 child has already ordered this. Ask the admin to cancel and refund those orders first.');

  // Siblings in one order, plus an older line with no menu ID for the same dish and category.
  order('ORD-2', [{ item: 'oit_2', studentId: 'stu_b' }, { item: 'oit_3', studentId: 'stu_c', menuId: null }]);
  const three = await unpublishAs(admin);
  assert.equal(three.status, 409);
  assert.equal((await three.json()).error, '3 children have already ordered this. Ask the admin to cancel and refund those orders first.');
  assert.equal(fs.getDoc('menus', PRIMARY)?.isActive, true, 'still on sale');

  // Primary's orders for the same dish do not block Secondary.
  assert.equal((await unpublishAs(staff, { date: DATE, studentCategory: 'Secondary' })).status, 200);
  assert.equal(fs.getDoc('menus', SECONDARY)?.isActive, false);
});

test('after the admin cancels the orders, unpublish works', async () => {
  order('ORD-1', [{ item: 'oit_1', studentId: 'stu_a' }]);
  assert.equal((await unpublishAs(staff)).status, 409);
  fs.seed('orders', 'ORD-1', { ...fs.getDoc('orders', 'ORD-1'), orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
  assert.equal((await unpublishAs(staff)).status, 200);
  assert.equal(fs.getDoc('menus', PRIMARY)?.isActive, false);
});

test('Admin → Menu: saving with no dish and switching an entry off follow the same rule', async () => {
  order('ORD-1', [{ item: 'oit_1', studentId: 'stu_a' }]);
  const save = await unpublish(jsonRequest('/api/admin/menus/unpublish', 'POST', { date: DATE, studentCategory: 'Primary' }, admin));
  assert.equal(save.status, 409);
  assert.match((await save.json()).error, /1 child has already ordered this/);

  const off = await updateMenu(jsonRequest('/api/admin/menus', 'PUT', { id: PRIMARY, isActive: false }, staff));
  assert.equal(off.status, 409);
  assert.equal(fs.getDoc('menus', PRIMARY)?.isActive, true);

  // A category without orders can be unpublished from Admin → Menu.
  const ok = await unpublish(jsonRequest('/api/admin/menus/unpublish', 'POST', { date: DATE, studentCategory: 'Secondary' }, admin));
  assert.equal(ok.status, 200);
  assert.equal(fs.getDoc('menus', SECONDARY)?.isActive, false);
  assert.equal(fs.getDoc('menus', PRIMARY)?.isActive, true);
});

test('only staff and admin can unpublish, for one valid category', async () => {
  assert.equal((await unpublishAs(parent)).status, 403);
  assert.equal((await unpublish(jsonRequest('/api/admin/menus/unpublish', 'POST', { date: DATE, studentCategory: 'Primary' }))).status, 403);
  assert.equal((await unpublishAs(staff, { date: DATE, studentCategory: 'ALL' })).status, 400);
  assert.equal((await unpublishAs(staff, { date: DATE, studentCategory: 'Nursery-ish typo' })).status, 400);
  assert.equal((await unpublishAs(staff, { date: 'tomorrow', studentCategory: 'Primary' })).status, 400);
  assert.equal(fs.getDoc('menus', PRIMARY)?.isActive, true);
});

test('CHANGED: a dish shared by all categories is split per class, then one class is unpublished; refused if anyone ordered it', async () => {
  fs.seed('menus', PRIMARY, { ...fs.getDoc('menus', PRIMARY), isActive: false });
  fs.seed('menus', SECONDARY, { ...fs.getDoc('menus', SECONDARY), isActive: false });
  const SHARED = `meal_dal_${DATE}`;
  fs.seed('menus', SHARED, {
    id: SHARED, date: DATE, studentCategory: 'ALL', mealId: 'meal_dal', isHoliday: false,
    availableQuantity: 40, maxQuantity: 40, orderingDeadline: '08:30', isActive: true,
  });

  // Someone (any class) ordered from the shared entry: nothing changes.
  order('ORD-S', [{ item: 'oit_s', studentId: 'stu_s', menuId: SHARED, studentCategory: 'Secondary' }]);
  const refused = await unpublishAs(staff);
  assert.equal(refused.status, 409);
  assert.match((await refused.json()).error, /shared by all 3 classes\. 1 child has already ordered this/);
  assert.equal(fs.getDoc('menus', SHARED)?.isActive, true);

  fs.seed('orders', 'ORD-S', { ...fs.getDoc('orders', 'ORD-S'), orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
  const res = await unpublishAs(staff);
  assert.equal(res.status, 200);
  assert.equal(fs.getDoc('menus', SHARED)?.isActive, false);
  assert.equal(fs.getDoc('menus', PRIMARY)?.isActive, false, 'Primary is off sale');
  assert.equal(fs.getDoc('menus', SECONDARY)?.isActive, true, 'Secondary keeps the dish on its own entry');
  assert.equal(fs.getDoc('menus', SECONDARY)?.maxQuantity, 40);
  assert.equal(fs.getDoc('menus', `menu_${DATE}_pre_primary`)?.mealId, 'meal_dal');
});
