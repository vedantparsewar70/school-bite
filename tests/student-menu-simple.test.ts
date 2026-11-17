import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { GET as menuDaysRoute } from '../app/api/staff/menu-days/route';
import { POST as assign } from '../app/api/admin/menus/assign/route';
import { POST as unpublish } from '../app/api/admin/menus/unpublish/route';
import { POST as holiday } from '../app/api/admin/menus/holiday/route';
import { POST as portions } from '../app/api/admin/menus/portions/route';
import { PUT as updateMenu } from '../app/api/admin/menus/route';
import { GET as parentMenu } from '../app/api/menu/route';
import { GET as kitchen } from '../app/api/admin/kitchen/route';
import { applyMonthlyMenu, type MonthlyMenuPlan } from '../lib/monthly-menu';
import { nextServingDay } from '../lib/serving-day';

/**
 * Student Menu editor (Staff → Student Menu and Admin → Menu): what it shows is what parents see,
 * and every change follows the shared rules (paid, not-cancelled orders block; closed days are
 * view-only; portions never below what is ordered; no Sundays).
 */

const TUE = '2026-11-17';
const WED = '2026-11-18';
const THU = '2026-11-19';
const SUN = '2026-11-22';
const CLASSES = ['Pre-primary', 'Primary', 'Secondary'] as const;
const slug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '_');
const entryId = (date: string, c: string) => `menu_${date}_${slug(c)}`;

let fs: FakeFirestore;
let staff: Record<string, string>;
let admin: Record<string, string>;
let parent: Record<string, string>;

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

function menu(date: string, category: string, mealId = 'meal_dal', extra: Record<string, unknown> = {}) {
  const id = entryId(date, category);
  fs.seed('menus', id, {
    id, date, studentCategory: category, mealId, isHoliday: false, isActive: true,
    availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', ...extra,
  });
}

function order(id: string, date: string, category: string, studentId: string, fields: Record<string, unknown> = {}, quantity = 1) {
  fs.seed('orders', id, { id, parentId: 'par_x', totalAmount: 80, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', ...fields });
  fs.seed('orderItems', `oit_${id}`, {
    id: `oit_${id}`, orderId: id, studentId, studentCategory: category, mealId: 'meal_dal', mealName: 'Dal Khichdi',
    menuId: entryId(date, category), date, quantity, unitPrice: 80, totalPrice: 80 * quantity,
  });
}
const cancel = (id: string) => fs.seed('orders', id, { ...fs.getDoc('orders', id), orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });

const days = async (who = staff, from = TUE, n = 7) => {
  const res = await menuDaysRoute(jsonRequest(`/api/staff/menu-days?from=${from}&days=${n}`, 'GET', undefined, who));
  return { status: res.status, body: await res.json() };
};
const dayOf = async (date: string) => (await days(staff, TUE, 7)).body.days.find((d: any) => d.date === date);
const card = async (date: string, c: string) => (await dayOf(date)).classes.find((x: any) => x.category === c);
const parentSees = async (date: string, c: string) =>
  ((await (await parentMenu(jsonRequest(`/api/menu?date=${date}&category=${c}`, 'GET'))).json()).menus as any[]).map((m) => ({
    mealId: m.mealId || null,
    available: m.isAvailable,
    holiday: Boolean(m.isHoliday),
  }));
const post = (fn: (r: Request) => Promise<Response>, url: string, body: unknown, who = staff) => fn(jsonRequest(url, 'POST', body, who));

beforeEach(async () => {
  fs = useFakeFirestore();
  at(`${TUE}T07:00`);
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  parent = await signedInAs(fs, 'PARENT');
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: 80, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_poha', { id: 'meal_poha', name: 'Poha', price: 60, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_egg', { id: 'meal_egg', name: 'Egg Curry Rice', price: 90, category: 'LUNCH', isVegetarian: false });
});

afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

// --- Shows what parents see -------------------------------------------------------------------

test('each class card shows the same entry as the parent menu, with the class price, portions and paid orders only', async () => {
  for (const c of CLASSES) menu(WED, c);
  // An older duplicate for Primary that parents do not see, and an older "all classes" entry on Thursday.
  fs.seed('menus', `meal_egg_${WED}`, { id: `meal_egg_${WED}`, date: WED, studentCategory: 'Primary', mealId: 'meal_egg', isActive: true, availableQuantity: 10, updatedAt: '2020-01-01' });
  fs.seed('menus', `meal_poha_${THU}`, { id: `meal_poha_${THU}`, date: THU, studentCategory: 'ALL', mealId: 'meal_poha', isActive: true, availableQuantity: 30, maxQuantity: 30 });
  order('ORD-1', WED, 'Primary', 'stu_1', {}, 2);
  order('ORD-2', WED, 'Primary', 'stu_2');
  order('ORD-C', WED, 'Primary', 'stu_3', { orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });

  const primary = await card(WED, 'Primary');
  assert.equal(primary.state, 'ON_SALE');
  assert.equal(primary.mealName, 'Dal Khichdi');
  assert.equal(primary.price, 75, 'the Primary class price, not the dish price');
  assert.equal(primary.isVegetarian, true);
  assert.equal(primary.ordered, 3, 'paid, not cancelled portions');
  assert.equal(primary.children, 2);
  assert.equal(primary.maxQuantity, 50);
  assert.equal(primary.duplicates, 1, 'the older duplicate is reported');

  for (const date of [WED, THU]) {
    const day = await dayOf(date);
    for (const c of CLASSES) {
      const seen = await parentSees(date, c);
      const shown = day.classes.find((x: any) => x.category === c);
      assert.deepEqual(seen.map((m) => m.mealId), [shown.mealId], `${date} ${c}: staff and parents see the same dish`);
    }
  }
  const thu = await card(THU, 'Secondary');
  assert.equal(thu.shared, true);
  assert.equal(thu.mealName, 'Poha');
  assert.equal(thu.price, 90, 'an older entry shared by all classes still shows the Secondary class price');
});

test('day status: all on sale / some / none / holiday / Sunday; past and closed days are view-only', async () => {
  for (const c of CLASSES) menu(WED, c);
  menu(THU, 'Primary');
  for (const c of CLASSES) menu(TUE, c);
  const body = (await days(staff, '2026-11-16', 8)).body;
  const status = Object.fromEntries(body.days.map((d: any) => [d.date, d.status]));
  assert.equal(status[WED], 'ALL');
  assert.equal(status[THU], 'SOME');
  assert.equal(status['2026-11-20'], 'NONE');
  assert.equal(status[SUN], 'SUNDAY');
  const mon = body.days.find((d: any) => d.date === '2026-11-16');
  assert.equal(mon.isPast, true);
  assert.ok(mon.classes.every((c: any) => !c.editable && !c.removable), 'past days are view-only');

  // Today: editable until 08:30, then view-only (Remove still offered while something is on sale).
  assert.ok((await card(TUE, 'Primary')).editable);
  at(`${TUE}T08:31`);
  const closed = await card(TUE, 'Primary');
  assert.equal(closed.editable, false);
  assert.equal(closed.removable, true);

  assert.equal((await days(parent)).status, 403);
});

test('Monthly Menu import results appear in the editor straight away', async () => {
  const plan: MonthlyMenuPlan = {
    title: null, month: '2026-11', issues: [],
    days: [{ row: 0, date: WED, dayLabel: WED, weekday: null, errors: [], cells: {
      'Pre-primary': { kind: 'MEAL', dish: 'Poha', merged: false },
      Primary: { kind: 'MEAL', dish: 'Poha', merged: false },
      Secondary: { kind: 'HOLIDAY', reason: 'Exam', merged: false },
    } as any }],
  };
  const result = await applyMonthlyMenu(plan, { replaceUnordered: true, actorId: 'usr_staff', fileName: 'nov.xlsx' });
  assert.equal(result.written, true);
  const day = await dayOf(WED);
  assert.deepEqual(day.classes.map((c: any) => [c.state, c.mealName || c.holidayReason]), [['ON_SALE', 'Poha'], ['ON_SALE', 'Poha'], ['HOLIDAY', 'Exam']]);
});

// --- Add / change / remove --------------------------------------------------------------------

test('no publishing on Sundays, past days, or today after 08:30; Remove still works then when nobody ordered', async () => {
  assert.equal((await post(assign, '/api/admin/menus/assign', { date: SUN, studentCategory: 'ALL', mealId: 'meal_dal' })).status, 400);
  assert.equal((await post(assign, '/api/admin/menus/assign', { date: '2026-11-16', studentCategory: 'Primary', mealId: 'meal_dal' })).status, 400);

  menu(TUE, 'Primary');
  at(`${TUE}T08:31`);
  for (const who of [staff, admin]) {
    const late = await post(assign, '/api/admin/menus/assign', { date: TUE, studentCategory: 'Secondary', mealId: 'meal_dal' }, who);
    assert.equal(late.status, 400);
    const body = await late.json();
    assert.equal(body.code, 'ORDERING_CLOSED');
    assert.match(body.error, /closed at 08:30/);
  }
  assert.equal((await post(portions, '/api/admin/menus/portions', { date: TUE, studentCategory: 'Primary', portions: 80 })).status, 400);
  assert.equal((await post(holiday, '/api/admin/menus/holiday', { date: TUE, studentCategory: 'ALL', action: 'mark', reason: 'Rain' })).status, 400);

  const removed = await post(unpublish, '/api/admin/menus/unpublish', { date: TUE, studentCategory: 'Primary' });
  assert.equal(removed.status, 200);
  assert.equal(fs.getDoc('menus', entryId(TUE, 'Primary'))?.isActive, false);
});

test('changing a dish with paid orders is refused with the Remove message; after cancel and refund it works', async () => {
  menu(WED, 'Primary');
  order('ORD-1', WED, 'Primary', 'stu_1');
  const refused = await post(assign, '/api/admin/menus/assign', { date: WED, studentCategory: 'Primary', mealId: 'meal_poha', replace: true });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error, '1 child has already ordered this. Ask the admin to cancel and refund those orders first.');
  assert.equal(fs.getDoc('menus', entryId(WED, 'Primary'))?.mealId, 'meal_dal');

  cancel('ORD-1');
  const ok = await post(assign, '/api/admin/menus/assign', { date: WED, studentCategory: 'Primary', mealId: 'meal_poha', replace: true });
  assert.equal(ok.status, 200);
  assert.deepEqual((await parentSees(WED, 'Primary')).map((m) => m.mealId), ['meal_poha']);
});

test('"All 3 classes" with one class ordered names the blocked class; the other classes can then be saved alone', async () => {
  for (const c of CLASSES) menu(WED, c);
  order('ORD-1', WED, 'Primary', 'stu_1');
  const all = await post(assign, '/api/admin/menus/assign', { date: WED, studentCategory: 'ALL', mealId: 'meal_poha', replace: true });
  assert.equal(all.status, 409);
  const body = await all.json();
  assert.deepEqual(body.blockedCategories, ['Primary']);
  assert.match(body.error, /^Primary: 1 child has already ordered this/);
  for (const c of CLASSES) assert.equal(fs.getDoc('menus', entryId(WED, c))?.mealId, 'meal_dal', 'nothing changed');

  for (const c of ['Pre-primary', 'Secondary']) {
    assert.equal((await post(assign, '/api/admin/menus/assign', { date: WED, studentCategory: c, mealId: 'meal_poha', replace: true })).status, 200);
  }
  assert.deepEqual((await dayOf(WED)).classes.map((c: any) => c.mealName), ['Poha', 'Dal Khichdi', 'Poha']);
});

// --- Holiday ---------------------------------------------------------------------------------

test('holiday for one class or all: refused with paid orders, allowed after cancel, undo leaves nothing on sale; next serving day follows', async () => {
  at(`${TUE}T15:00`);
  for (const c of CLASSES) menu(WED, c);
  menu(THU, 'Primary');
  order('ORD-1', WED, 'Secondary', 'stu_1');

  const blocked = await post(holiday, '/api/admin/menus/holiday', { date: WED, studentCategory: 'ALL', action: 'mark', reason: 'Diwali' });
  assert.equal(blocked.status, 409);
  const b = await blocked.json();
  assert.deepEqual(b.blockedCategories, ['Secondary']);
  assert.match(b.error, /Secondary: 1 child has already ordered this/);

  const one = await post(holiday, '/api/admin/menus/holiday', { date: WED, studentCategory: 'Pre-primary', action: 'mark', reason: 'Sports day' });
  assert.equal(one.status, 200);
  assert.deepEqual((await parentSees(WED, 'Pre-primary')).map((m) => [m.holiday, m.available]), [[true, false]], 'parents see the holiday');
  assert.equal((await card(WED, 'Pre-primary')).holidayReason, 'Sports day');
  assert.equal((await card(WED, 'Primary')).state, 'ON_SALE');

  cancel('ORD-1');
  assert.equal((await post(holiday, '/api/admin/menus/holiday', { date: WED, studentCategory: 'ALL', action: 'mark', reason: 'Diwali' })).status, 200);
  assert.equal((await dayOf(WED)).status, 'HOLIDAY');
  assert.equal(await nextServingDay(), THU, 'the next serving day skips the new holiday');
  const prepare = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${WED}&refresh=true`, 'GET', undefined, staff))).json();
  assert.equal(prepare.totalMeals, 0, 'the cancelled order is not counted');
  assert.ok(prepare.plan.categories.every((c: any) => c.state === 'HOLIDAY'));

  const undo = await post(holiday, '/api/admin/menus/holiday', { date: WED, studentCategory: 'Primary', action: 'undo' });
  assert.equal(undo.status, 200);
  assert.equal((await card(WED, 'Primary')).state, 'NOT_ON_SALE');
  assert.equal((await card(WED, 'Secondary')).state, 'HOLIDAY');
  assert.deepEqual(await parentSees(WED, 'Primary'), [], 'parents see nothing on sale');

  assert.equal((await post(holiday, '/api/admin/menus/holiday', { date: SUN, studentCategory: 'ALL', action: 'mark', reason: 'x y' })).status, 400);
  assert.equal((await post(holiday, '/api/admin/menus/holiday', { date: THU, studentCategory: 'ALL', action: 'mark', reason: 'x y' }, parent)).status, 403);
});

// --- Portions --------------------------------------------------------------------------------

test('portions: total and left follow paid orders, never below what is ordered (also through the older menu API)', async () => {
  menu(WED, 'Primary', 'meal_dal', { availableQuantity: 47, maxQuantity: 50 });
  order('ORD-1', WED, 'Primary', 'stu_1', {}, 3);
  order('ORD-C', WED, 'Primary', 'stu_2', { orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' }, 5);

  const low = await post(portions, '/api/admin/menus/portions', { date: WED, studentCategory: 'Primary', portions: 2 });
  assert.equal(low.status, 409);
  assert.equal((await low.json()).error, "3 portions are already ordered. Portions can't be set lower than that.");

  const ok = await post(portions, '/api/admin/menus/portions', { date: WED, studentCategory: 'Primary', portions: 3 });
  assert.equal(ok.status, 200);
  assert.deepEqual(
    [fs.getDoc('menus', entryId(WED, 'Primary'))?.maxQuantity, fs.getDoc('menus', entryId(WED, 'Primary'))?.availableQuantity],
    [3, 0],
    'sold out for parents now'
  );
  assert.deepEqual((await parentSees(WED, 'Primary')).map((m) => m.available), [false]);

  assert.equal((await post(portions, '/api/admin/menus/portions', { date: WED, studentCategory: 'Primary', portions: 40 })).status, 200);
  assert.equal(fs.getDoc('menus', entryId(WED, 'Primary'))?.availableQuantity, 37);
  const c = await card(WED, 'Primary');
  assert.deepEqual([c.ordered, c.maxQuantity, c.availableQuantity], [3, 40, 37]);

  assert.equal((await post(portions, '/api/admin/menus/portions', { date: WED, studentCategory: 'Secondary', portions: 5 })).status, 404, 'nothing on sale');
  assert.equal((await post(portions, '/api/admin/menus/portions', { date: WED, studentCategory: 'Primary', portions: -1 })).status, 400);
  assert.equal((await post(portions, '/api/admin/menus/portions', { date: WED, studentCategory: 'Primary', portions: 9 }, parent)).status, 403);

  const old = await updateMenu(jsonRequest('/api/admin/menus', 'PUT', { id: entryId(WED, 'Primary'), maxQuantity: 1 }, admin));
  assert.equal(old.status, 409);
  assert.equal(fs.getDoc('menus', entryId(WED, 'Primary'))?.maxQuantity, 40);
});

// --- Screens ---------------------------------------------------------------------------------

test('Staff → Student Menu and Admin → Menu use the same editor; Delete is admin-only; clutter is gone', () => {
  const staffPage = readFileSync('app/staff/kitchen/page.tsx', 'utf-8');
  const adminPage = readFileSync('app/admin/menu/page.tsx', 'utf-8');
  assert.match(staffPage, /<StudentMenuEditor isAdmin=\{user\?\.role === 'ADMIN'\} \/>/);
  assert.match(adminPage, /<StudentMenuEditor isAdmin \/>/);
  const editor = readFileSync('components/StudentMenuEditor.tsx', 'utf-8');
  assert.match(editor, /\{isAdmin && \(\s*<button[^>]*onClick=\{\(\) => onDelete\(d\)\}/);
  for (const gone of ['Publish a catalog recipe', 'Timetable Reference', 'Saved Menu', 'October 2026 timetable', 'OCTOBER_2026']) {
    assert.ok(!editor.includes(gone) && !staffPage.includes(gone), `removed: ${gone}`);
  }
  for (const text of ['Extra price changes apply to new orders only, on every day this dish is sold as an extra.', "Edits this dish everywhere it&apos;s used.", 'Save for the other classes only', 'Remove {sheet.card.mealName} from']) {
    assert.ok(editor.includes(text), `shows: ${text}`);
  }
  // Every text input on the editor is 16px.
  const inputs = editor.match(/<input[\s\S]*?\/>/g) || [];
  for (const i of inputs) if (!/type="radio"/.test(i)) assert.match(i, /text-base/, i.slice(0, 80));
});
