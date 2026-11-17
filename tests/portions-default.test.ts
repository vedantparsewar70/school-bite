import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { november2026Workbook } from './helpers/xlsx-builder';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { dishKey, parseMonthlyMenu } from '../lib/monthly-menu';
import { readFirstSheet } from '../lib/xlsx-reader';
import { DEFAULT_PORTIONS, portionChanges } from '../lib/brunch-prices';
import { GET as getSettings, PUT as putSettings } from '../app/api/admin/menus/brunch-prices/route';
import { POST as bulk } from '../app/api/admin/menus/portions/bulk/route';
import { POST as assign } from '../app/api/admin/menus/assign/route';
import { POST as importMenu } from '../app/api/admin/menus/import/route';

/** Default portions per class (500 until saved) and "Apply portions to upcoming days". Fake database only. */

const SLUG: Record<string, string> = { 'Pre-primary': 'pre_primary', Primary: 'primary', Secondary: 'secondary' };
const id = (date: string, cat: string) => `menu_${date}_${SLUG[cat]}`;
let fs: FakeFirestore;
let staff: Record<string, string>;
let admin: Record<string, string>;
let parent: Record<string, string>;

const at = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

beforeEach(async () => {
  fs = useFakeFirestore();
  at('2026-11-17T10:00'); // Tuesday, after the 08:30 cutoff: today is closed.
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: null, category: 'LUNCH', isVegetarian: true });
  fs.seed('meals', 'meal_banana', { id: 'meal_banana', name: 'Banana', price: 10, category: 'SNACK', isVegetarian: true, isExtra: true });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

const menu = (date: string, cat: string, fields: Record<string, unknown> = {}) =>
  fs.seed('menus', id(date, cat), {
    id: id(date, cat), date, studentCategory: cat, mealId: 'meal_dal', isHoliday: false, isActive: true,
    availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', ...fields,
  });
/** A paid order of `quantity` portions for one class's entry. */
const paid = (orderId: string, date: string, cat: string, quantity: number) => {
  fs.seed('orders', orderId, { id: orderId, parentId: 'par_1', paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
  fs.seed('orderItems', `oit_${orderId}`, { id: `oit_${orderId}`, orderId, studentId: 'stu_1', studentCategory: cat, mealId: 'meal_dal', menuId: id(date, cat), date, quantity, unitPrice: 75, totalPrice: 75 * quantity });
};
const putDefaults = (defaultPortions: Record<string, unknown>, headers = staff) =>
  putSettings(jsonRequest('/api/admin/menus/brunch-prices', 'PUT', { defaultPortions }, headers));
const applyBulk = (body: Record<string, unknown>, headers = staff) => bulk(jsonRequest('/api/admin/menus/portions/bulk', 'POST', body, headers));
const q = (date: string, cat: string) => {
  const m = fs.getDoc('menus', id(date, cat))!;
  return [m.maxQuantity, m.availableQuantity];
};

// --- Default portions ------------------------------------------------------------------------------

test('Add dish (and Change dish into an empty class) starts at the default portions: 500, or the saved class default', async () => {
  const add = (date: string, studentCategory: string) => assign(jsonRequest('/api/admin/menus/assign', 'POST', { date, studentCategory, mealId: 'meal_dal', replace: true }, staff));
  assert.equal((await add('2026-11-18', 'Primary')).status, 200);
  assert.deepEqual(q('2026-11-18', 'Primary'), [500, 500]);

  assert.equal((await putDefaults({ 'Pre-primary': 120, Primary: 300, Secondary: 500 })).status, 200);
  assert.equal((await add('2026-11-19', 'ALL')).status, 200);
  assert.deepEqual([q('2026-11-19', 'Pre-primary'), q('2026-11-19', 'Primary'), q('2026-11-19', 'Secondary')], [[120, 120], [300, 300], [500, 500]]);
  assert.deepEqual(q('2026-11-18', 'Primary'), [500, 500], 'existing entries keep their portions');
});

test('the monthly import gives every new entry its class default portions', async () => {
  at('2026-10-25T10:00');
  assert.equal((await putDefaults({ 'Pre-primary': 150, Primary: 250, Secondary: 350 })).status, 200);
  const plan = parseMonthlyMenu(readFirstSheet(november2026Workbook()));
  const keys = new Set(plan.days.flatMap((d) => Object.values(d.cells)).filter((c: any) => c.kind === 'MEAL').map((c: any) => dishKey(c.dish)));
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(november2026Workbook())]), 'November_2026_Menu.xlsx');
  form.set('action', 'publish');
  form.set('options', JSON.stringify({ dishes: Object.fromEntries(Array.from(keys).map((k) => [k, { isVegetarian: true, noAllergens: true }])) }));
  const res = await importMenu(new Request('http://localhost:3000/api/admin/menus/import', { method: 'POST', body: form, headers: staff }));
  assert.equal(res.status, 200);
  const live = fs.list('menus').filter((m) => !m.isHoliday);
  assert.ok(live.length > 0);
  const expected: Record<string, number> = { 'Pre-primary': 150, Primary: 250, Secondary: 350 };
  for (const m of live) assert.deepEqual([m.maxQuantity, m.availableQuantity], [expected[m.studentCategory], expected[m.studentCategory]], m.id);
});

test('default portions: 500 / 500 / 500 until saved; whole numbers 1 to 2000; staff and admin only; prices kept', async () => {
  const get = async (headers = staff) => (await getSettings(jsonRequest('/api/admin/menus/brunch-prices', 'GET', undefined, headers))).json();
  assert.deepEqual((await get()).defaultPortions, DEFAULT_PORTIONS);
  assert.deepEqual(DEFAULT_PORTIONS, { 'Pre-primary': 500, Primary: 500, Secondary: 500 });

  for (const bad of [{ 'Pre-primary': 0, Primary: 500, Secondary: 500 }, { 'Pre-primary': 500, Primary: 2001, Secondary: 500 }, { 'Pre-primary': 500, Primary: 1.5, Secondary: 500 }, { 'Pre-primary': 500, Primary: 'x', Secondary: 500 }, { 'Pre-primary': 500, Primary: 500 }]) {
    const res = await putDefaults(bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.match((await res.json()).error, /whole number of portions from 1 to 2000/);
  }
  assert.equal((await putDefaults({ 'Pre-primary': 1, Primary: 1, Secondary: 1 }, parent)).status, 403);
  assert.equal((await putDefaults({ 'Pre-primary': 1, Primary: 1, Secondary: 1 }, {})).status, 403);
  assert.equal(fs.getDoc('systemSettings', 'BRUNCH_PRICES'), undefined, 'nothing saved');

  // Saving portions keeps the saved prices, and saving prices keeps the saved portions.
  await putSettings(jsonRequest('/api/admin/menus/brunch-prices', 'PUT', { prices: { 'Pre-primary': 61, Primary: 76, Secondary: 91 } }, admin));
  assert.equal((await putDefaults({ 'Pre-primary': 2000, Primary: '300', Secondary: 1 }, admin)).status, 200);
  await putSettings(jsonRequest('/api/admin/menus/brunch-prices', 'PUT', { prices: { 'Pre-primary': 62, Primary: 77, Secondary: 92 } }, staff));
  const s = await get(admin);
  assert.deepEqual(s.defaultPortions, { 'Pre-primary': 2000, Primary: 300, Secondary: 1 });
  assert.deepEqual(s.prices, { 'Pre-primary': 62, Primary: 77, Secondary: 92 });

  assert.deepEqual(portionChanges(DEFAULT_PORTIONS, { 'Pre-primary': 500, Primary: 300, Secondary: 500 }), ['Primary: 500 → 300 portions']);
});

// --- Apply portions to upcoming days ---------------------------------------------------------------

function seedWeek() {
  for (const c of ['Pre-primary', 'Primary', 'Secondary']) {
    menu('2026-11-16', c); // yesterday (past)
    menu('2026-11-17', c); // today, ordering closed (10:00 > 08:30)
    menu('2026-11-18', c);
    menu('2026-11-19', c);
  }
  menu('2026-11-20', 'Primary', { isHoliday: true, isActive: false, mealId: '', availableQuantity: 0, maxQuantity: 0 });
  // 30 portions already paid for tomorrow's Primary brunch.
  paid('ORD-1', '2026-11-18', 'Primary', 30);
  fs.seed('menus', id('2026-11-18', 'Primary'), { ...fs.getDoc('menus', id('2026-11-18', 'Primary')), availableQuantity: 20 });
  // An extra on the same day keeps its own portions.
  fs.seed('menuExtras', 'extra_2026-11-18_primary_meal_banana', { id: 'extra_2026-11-18_primary_meal_banana', date: '2026-11-18', studentCategory: 'Primary', mealId: 'meal_banana', isActive: true, maxQuantity: 20, availableQuantity: 20 });
  fs.seed('teacher_meals', 'TM-001', { id: 'TM-001', name: 'Veg Thali', price: 120, isAvailable: true });
}

test('bulk apply updates only upcoming main entries of the chosen classes; skips and lists the rest', async () => {
  seedWeek();
  const res = await applyBulk({ classes: ['Primary', 'Secondary'], portions: 20 });
  assert.equal(res.status, 200);
  const body = await res.json();

  // Updated: Wed and Thu for Secondary, Thu for Primary (Wed Primary has 30 ordered > 20).
  assert.deepEqual(q('2026-11-18', 'Secondary'), [20, 20]);
  assert.deepEqual(q('2026-11-19', 'Secondary'), [20, 20]);
  assert.deepEqual(q('2026-11-19', 'Primary'), [20, 20]);
  assert.deepEqual(q('2026-11-18', 'Primary'), [50, 20], 'never below what is already ordered');
  // Not touched: past, closed today, the class not chosen, holidays, extras, teacher menu.
  for (const c of ['Primary', 'Secondary', 'Pre-primary']) assert.deepEqual(q('2026-11-16', c), [50, 50], `past ${c}`);
  for (const c of ['Primary', 'Secondary']) assert.deepEqual(q('2026-11-17', c), [50, 50], `closed today ${c}`);
  for (const d of ['2026-11-18', '2026-11-19']) assert.deepEqual(q(d, 'Pre-primary'), [50, 50], 'class not chosen');
  assert.deepEqual(q('2026-11-20', 'Primary'), [0, 0], 'holiday unchanged');
  assert.deepEqual([fs.getDoc('menuExtras', 'extra_2026-11-18_primary_meal_banana')?.maxQuantity, fs.getDoc('menuExtras', 'extra_2026-11-18_primary_meal_banana')?.availableQuantity], [20, 20]);
  assert.deepEqual(fs.getDoc('teacher_meals', 'TM-001'), { id: 'TM-001', name: 'Veg Thali', price: 120, isAvailable: true });

  assert.equal(body.updatedDays, 2);
  assert.equal(body.updatedEntries, 3);
  assert.deepEqual(
    body.skipped.map((s: any) => [s.date, s.category, s.reason]),
    [
      ['2026-11-17', 'Primary', 'ordering closed'],
      ['2026-11-17', 'Secondary', 'ordering closed'],
      ['2026-11-18', 'Primary', '30 already ordered (more than 20)'],
    ]
  );
  assert.equal(body.message, 'Updated 2 days, skipped 3.');
});

test('bulk apply above what is ordered sets the total and leaves the rest available; today counts while open', async () => {
  at('2026-11-17T07:00'); // before the cutoff: today is open
  seedWeek();
  const body = await (await applyBulk({ classes: ['Primary'], portions: 40 })).json();
  assert.deepEqual(q('2026-11-18', 'Primary'), [40, 10], '40 total, 30 ordered, 10 left');
  assert.deepEqual(q('2026-11-17', 'Primary'), [40, 40], 'today, ordering still open');
  assert.deepEqual(q('2026-11-16', 'Primary'), [50, 50], 'past day untouched');
  assert.deepEqual(q('2026-11-18', 'Secondary'), [50, 50], 'class not chosen');
  assert.equal(body.message, 'Updated 3 days, skipped 0.');
  assert.deepEqual(body.skipped, []);
});

test('bulk apply: staff and admin only; classes and 1 to 2000 required', async () => {
  seedWeek();
  assert.equal((await applyBulk({ classes: ['Primary'], portions: 100 }, parent)).status, 403);
  assert.equal((await applyBulk({ classes: ['Primary'], portions: 100 }, {})).status, 403);
  for (const bad of [{ classes: [], portions: 100 }, { classes: ['Nursery'], portions: 100 }, { classes: ['Primary'], portions: 0 }, { classes: ['Primary'], portions: 2001 }, { classes: ['Primary'], portions: 2.5 }, { portions: 100 }]) {
    const res = await applyBulk(bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
  assert.deepEqual(q('2026-11-19', 'Primary'), [50, 50], 'nothing changed');
  assert.equal((await applyBulk({ classes: ['Primary'], portions: '100' }, admin)).status, 200);
  assert.deepEqual(q('2026-11-19', 'Primary'), [100, 100]);
});

// --- Screen ----------------------------------------------------------------------------------------

test('Student Menu card: default portions, bulk apply with confirmation and summary', () => {
  const editor = readFileSync('components/StudentMenuEditor.tsx', 'utf-8');
  for (const text of [
    'Default portions per class',
    'Save default portions',
    'Change default portions?',
    'Apply portions to upcoming days',
    "'/api/admin/menus/portions/bulk'",
    'Never below what is already ordered',
    'aria-label="Skipped"',
    'defaultPortions[cat]',
    'card.maxQuantity ?? defaultPortions[category]',
  ]) {
    assert.ok(editor.includes(text), `editor: ${text}`);
  }
  assert.ok(!/maxQuantity \?\? 50\b|: 50;/.test(editor), 'no hard-coded 50 portions left');
});
