import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { november2026Workbook } from './helpers/xlsx-builder';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { dishKey } from '../lib/monthly-menu';
import { POST as importMenu } from '../app/api/admin/menus/import/route';
import { GET as menuDays } from '../app/api/staff/menu-days/route';
import { GET as menuMonth } from '../app/api/staff/menu-month/route';
import { POST as assign } from '../app/api/admin/menus/assign/route';
import { POST as portions } from '../app/api/admin/menus/portions/route';
import { POST as extras } from '../app/api/admin/menus/extras/route';
import { POST as dayCopy } from '../app/api/admin/meals/day-copy/route';
import { PUT as editMeal, DELETE as deleteMeal, POST as addMeal } from '../app/api/admin/meals/route';
import { GET as parentMenu } from '../app/api/menu/route';

/**
 * Student Menu regression (the redesigned editor uses only these APIs): a real monthly .xlsx import,
 * then Change dish / Edit for this day / Edit everywhere, portions, extras, permissions, and what
 * parents see after each step.
 */

const MON = '2026-11-02'; // imported: Soyabean Masala+Dal+Chapati+Salad for all 3 classes
const TUE = '2026-11-03'; // imported: Aloo Gobi + Chapati + Lemon Rice + Papad for all 3 classes
const SOYA = 'Soyabean Masala+Dal+Chapati+Salad';
const CLASSES = ['Pre-primary', 'Primary', 'Secondary'];
const slug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '_');
const entryId = (date: string, c: string) => `menu_${date}_${slug(c)}`;

let fs: FakeFirestore;
let staff: Record<string, string>;
let admin: Record<string, string>;
let parent: Record<string, string>;

const NOVEMBER_DISHES = [
  'Soyabean Masala+Dal+Chapati+Salad', 'Aloo Gobi + Chapati + Lemon Rice + Papad', 'Jeera Rice + Chole Bhaji + Chapati + Salad+Sweet',
  'Chana Masala + Chapati +Jeera Rice +  Salad', 'Green Moong + Dal + Chapati + Rice', 'Aloo Paratha + Pulao + Curd', 'Uttapa+Sambar+Chutney',
  'Bharli Vangi + Pancharatna Dal + Chapati + Rice', 'Paneer butter Masala+Dal+Chapati+Rice', 'Veg Cutlet+Mint Chutney+Banana',
  'Veg Biryani + Raita + Papad(udid roasted)', 'Chawli Usal+Masale Bhat + Chapati + Salad', 'Cabbage Peas subji+ Dal +Rice+Chapati + Salad',
  'Kofta Curry + Dal + Rice + Chapati + Salad',
];

function upload(headers: Record<string, string>) {
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(november2026Workbook())]), 'November_2026_Menu.xlsx');
  form.set('action', 'publish');
  form.set(
    'options',
    JSON.stringify({ replaceUnordered: true, dishes: Object.fromEntries(NOVEMBER_DISHES.map((d) => [dishKey(d), { price: 80, isVegetarian: true, noAllergens: true }])) })
  );
  return importMenu(new Request('http://localhost:3000/api/admin/menus/import', { method: 'POST', body: form, headers }));
}

const day = async (date: string) =>
  (await (await menuDays(jsonRequest(`/api/staff/menu-days?from=${date}&days=1`, 'GET', undefined, staff))).json()).days[0];
const card = async (date: string, c: string) => (await day(date)).classes.find((x: any) => x.category === c);
const parentSees = async (date: string, c: string) =>
  ((await (await parentMenu(jsonRequest(`/api/menu?date=${date}&category=${c}`, 'GET'))).json()).menus as any[]).map((m) => ({
    mealId: m.mealId || null,
    name: m.meal?.name || null,
    price: m.meal?.price ?? null,
    holiday: Boolean(m.isHoliday),
  }));
const parentExtras = async (date: string, c: string) =>
  ((await (await parentMenu(jsonRequest(`/api/menu?date=${date}&category=${c}`, 'GET'))).json()).extras as any[]).map((e) => e.meal.name);
const post = (fn: (r: Request) => Promise<Response>, url: string, body: unknown, who = staff) => fn(jsonRequest(url, 'POST', body, who));
const mealIdOf = (name: string) => fs.list('meals').find((m) => m.name === name && !m.dayOnly)!.id as string;

/** Staff and parents see the same dish (ID, name, price) for every class on the date. */
async function sameForParents(date: string) {
  const d = await day(date);
  for (const c of d.classes) {
    const seen = await parentSees(date, c.category);
    if (c.state === 'ON_SALE') assert.deepEqual(seen.map((s) => [s.mealId, s.name, s.price]), [[c.mealId, c.mealName, c.price]], `${date} ${c.category}`);
    else if (c.state === 'HOLIDAY') assert.ok(seen.every((s) => s.holiday), `${date} ${c.category} holiday`);
  }
}

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-29T12:00:00+05:30') });
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  parent = await signedInAs(fs, 'PARENT');
  const res = await upload(staff);
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  fs.seed('meals', 'meal_banana', { id: 'meal_banana', name: 'Banana', price: 10, category: 'SNACK', isVegetarian: true });
});

afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

test('the monthly import appears in the editor exactly as parents see it (dishes, holidays, Sundays, dates in order)', async () => {
  const month = (await (await menuMonth(jsonRequest('/api/staff/menu-month?month=2026-11', 'GET', undefined, staff))).json()).days;
  assert.equal(month.length, 30);
  assert.deepEqual(month.map((d: any) => d.date), Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`));
  const status = Object.fromEntries(month.map((d: any) => [d.date, d.status]));
  assert.equal(status['2026-11-01'], 'SUNDAY');
  assert.equal(status['2026-11-05'], 'HOLIDAY');
  assert.equal(month.find((d: any) => d.date === '2026-11-05').classes[0].holidayReason, 'Diwali Vacation');
  assert.equal(status[MON], 'ALL');
  for (const d of month) assert.deepEqual(d.classes.map((c: any) => c.category), CLASSES, `${d.date} class order`);

  const monday = await day(MON);
  assert.deepEqual(monday.classes.map((c: any) => [c.mealName, c.price, c.ordered, c.maxQuantity, c.availableQuantity]), [
    [SOYA, 60, 0, 500, 500],
    [SOYA, 75, 0, 500, 500],
    [SOYA, 90, 0, 500, 500],
  ]);
  await sameForParents(MON);
  await sameForParents('2026-11-05');
});

test('Change dish, Edit for this day and Edit everywhere each have their own effect on imported dishes', async () => {
  const soya = mealIdOf(SOYA);
  const pulao = (await (await post(addMeal, '/api/admin/meals', { name: 'Veg Pulao + Raita', price: 75, category: 'LUNCH', isVegetarian: true })).json()).meal.id;

  // The same catalogue dish is also on sale on another date (Wednesday, Primary).
  const WED = '2026-11-04';
  assert.equal((await post(assign, '/api/admin/menus/assign', { date: WED, studentCategory: 'Primary', mealId: soya, replace: true })).status, 200);

  // Change dish (Primary only): only Primary on Monday changes.
  assert.equal((await post(assign, '/api/admin/menus/assign', { date: MON, studentCategory: 'Primary', mealId: pulao, replace: true })).status, 200);
  assert.deepEqual((await day(MON)).classes.map((c: any) => c.mealName), [SOYA, 'Veg Pulao + Raita', SOYA]);
  await sameForParents(MON);

  // Edit for this day (Secondary, Monday): a copy for that day only; the catalogue dish and other days stay.
  const copy = await post(dayCopy, '/api/admin/meals/day-copy', { date: MON, studentCategory: 'Secondary', mealId: soya, name: 'Soyabean Masala + Chapati + Salad', price: 70, isVegetarian: true });
  assert.equal(copy.status, 200);
  const copyId = (await copy.json()).mealId;
  assert.deepEqual((await day(MON)).classes.map((c: any) => [c.mealName, c.price]), [
    [SOYA, 60],
    ['Veg Pulao + Raita', 75],
    ['Soyabean Masala + Chapati + Salad', 90],
  ]);
  assert.equal(fs.getDoc('meals', soya)?.price, null, 'catalogue dish unchanged (an imported dish has no extra price)');
  assert.deepEqual((await parentSees(WED, 'Primary')).map((x) => [x.name, x.price]), [[SOYA, 75]], 'other day keeps the original dish');
  await sameForParents(MON);

  // Edit everywhere (catalogue dish): every day using it changes, but not the day-only copy.
  // Its price is only the extra price now: the brunch keeps the class price.
  assert.equal((await editMeal(jsonRequest('/api/admin/meals', 'PUT', { id: soya, name: SOYA, price: 85, isVegetarian: false }, staff))).status, 200);
  assert.deepEqual([(await card(MON, 'Pre-primary')).isVegetarian, (await card(MON, 'Pre-primary')).price], [false, 60]);
  assert.deepEqual([(await card(MON, 'Secondary')).isVegetarian, (await card(MON, 'Secondary')).price], [true, 90], 'the day-only copy keeps its own dish');
  assert.deepEqual((await parentSees(WED, 'Primary')).map((x) => x.price), [75], 'still the class price');
  assert.equal((await card(WED, 'Primary')).isVegetarian, false, 'every other day using the dish changes too');
  assert.equal(fs.getDoc('meals', soya)?.price, 85, 'saved as the extra price');
  assert.equal(fs.getDoc('meals', copyId)?.price, 70);
  await sameForParents(MON);
});

test('portions never go below what is ordered, and a dish with paid orders cannot be changed', async () => {
  fs.seed('orders', 'ORD-1', { id: 'ORD-1', parentId: 'par_x', paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
  fs.seed('orderItems', 'oit_1', {
    id: 'oit_1', orderId: 'ORD-1', studentId: 'stu_1', studentCategory: 'Pre-primary', mealId: mealIdOf(SOYA),
    menuId: entryId(MON, 'Pre-primary'), date: MON, quantity: 3, unitPrice: 80, totalPrice: 240,
  });
  fs.seed('menus', entryId(MON, 'Pre-primary'), { ...fs.getDoc('menus', entryId(MON, 'Pre-primary')), availableQuantity: 497 });

  const c = await card(MON, 'Pre-primary');
  assert.deepEqual([c.ordered, c.maxQuantity, c.availableQuantity], [3, 500, 497]);
  const low = await post(portions, '/api/admin/menus/portions', { date: MON, studentCategory: 'Pre-primary', portions: 2 });
  assert.equal(low.status, 409);
  assert.match((await low.json()).error, /3 portions are already ordered/);
  assert.equal((await post(portions, '/api/admin/menus/portions', { date: MON, studentCategory: 'Pre-primary', portions: 3 })).status, 200);
  assert.deepEqual([(await card(MON, 'Pre-primary')).maxQuantity, (await card(MON, 'Pre-primary')).availableQuantity], [3, 0]);
  assert.equal((await card(MON, 'Primary')).maxQuantity, 500, 'other classes untouched');

  const pulao = (await (await post(addMeal, '/api/admin/meals', { name: 'Veg Pulao + Raita', price: 75, category: 'LUNCH', isVegetarian: true })).json()).meal.id;
  const change = await post(assign, '/api/admin/menus/assign', { date: MON, studentCategory: 'ALL', mealId: pulao, replace: true });
  assert.equal(change.status, 409);
  assert.deepEqual((await change.json()).blockedCategories, ['Pre-primary']);
  const edit = await post(dayCopy, '/api/admin/meals/day-copy', { date: MON, studentCategory: 'Pre-primary', mealId: mealIdOf(SOYA), name: 'X dish', price: 50, isVegetarian: true });
  assert.equal(edit.status, 409);
});

test('extras belong to the chosen class and date only, and survive a re-import', async () => {
  assert.equal((await post(extras, '/api/admin/menus/extras', { action: 'add', date: TUE, studentCategory: 'Secondary', mealId: 'meal_banana', portions: 20 })).status, 200);
  const tue = await day(TUE);
  assert.deepEqual(tue.classes.map((c: any) => c.extras.map((x: any) => x.mealName)), [[], [], ['Banana']]);
  assert.deepEqual((await day(MON)).classes.map((c: any) => c.extras.length), [0, 0, 0], 'other date has none');
  assert.deepEqual(await parentExtras(TUE, 'Secondary'), ['Banana']);
  assert.deepEqual(await parentExtras(TUE, 'Primary'), []);
  assert.deepEqual(await parentExtras(MON, 'Secondary'), []);

  const before = fs.list('menuExtras');
  assert.equal((await upload(staff)).status, 200, 're-import');
  assert.deepEqual(fs.list('menuExtras'), before, 'the import never changes extras');
  assert.deepEqual((await day(TUE)).classes.map((c: any) => c.extras.length), [0, 0, 1]);
});

test('repeated saves do not create duplicates (a second identical request changes nothing)', async () => {
  const pulao = (await (await post(addMeal, '/api/admin/meals', { name: 'Veg Pulao + Raita', price: 75, category: 'LUNCH', isVegetarian: true })).json()).meal.id;
  const again = await post(addMeal, '/api/admin/meals', { name: 'Veg Pulao + Raita', price: 75, category: 'LUNCH', isVegetarian: true });
  assert.equal(again.status, 409, 'no second dish with the same name');
  const menusBefore = fs.list('menus').length;
  for (let i = 0; i < 2; i++) assert.equal((await post(assign, '/api/admin/menus/assign', { date: MON, studentCategory: 'Primary', mealId: pulao, replace: true })).status, 200);
  assert.equal(fs.list('menus').filter((m) => m.date === MON && m.isActive !== false && !m.isHoliday).length, 3, 'still one live dish per class');
  assert.ok(fs.list('menus').length <= menusBefore + 1);
  for (let i = 0; i < 2; i++) assert.equal((await post(extras, '/api/admin/menus/extras', { action: 'add', date: MON, studentCategory: 'Primary', mealId: 'meal_banana', portions: 10 })).status, 200);
  assert.equal(fs.list('menuExtras').filter((e) => e.date === MON).length, 1, 'one extra entry');
});

test('permissions: staff and admin edit; only admin deletes dishes, never one with orders; parents can do neither', async () => {
  const pulao = (await (await post(addMeal, '/api/admin/meals', { name: 'Veg Pulao + Raita', price: 75, category: 'LUNCH', isVegetarian: true }, staff)).json()).meal.id;
  assert.equal((await deleteMeal(jsonRequest(`/api/admin/meals?id=${pulao}`, 'DELETE', undefined, staff))).status, 403, 'staff cannot delete');
  assert.equal((await deleteMeal(jsonRequest(`/api/admin/meals?id=${pulao}`, 'DELETE', undefined, parent))).status, 403);
  assert.equal((await deleteMeal(jsonRequest(`/api/admin/meals?id=${pulao}`, 'DELETE', undefined, admin))).status, 200, 'admin can delete an unused dish');

  fs.seed('orders', 'ORD-1', { id: 'ORD-1', parentId: 'par_x', paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
  fs.seed('orderItems', 'oit_1', { id: 'oit_1', orderId: 'ORD-1', studentId: 'stu_1', mealId: mealIdOf(SOYA), menuId: entryId(MON, 'Primary'), date: MON, quantity: 1, studentCategory: 'Primary' });
  assert.notEqual((await deleteMeal(jsonRequest(`/api/admin/meals?id=${mealIdOf(SOYA)}`, 'DELETE', undefined, admin))).status, 200, 'a dish with orders is never deleted');

  for (const [fn, url, body] of [
    [assign, '/api/admin/menus/assign', { date: MON, studentCategory: 'Primary', mealId: mealIdOf(SOYA) }],
    [portions, '/api/admin/menus/portions', { date: MON, studentCategory: 'Primary', portions: 10 }],
    [extras, '/api/admin/menus/extras', { action: 'add', date: MON, studentCategory: 'Primary', mealId: 'meal_banana', portions: 5 }],
    [dayCopy, '/api/admin/meals/day-copy', { date: MON, studentCategory: 'Primary', mealId: mealIdOf(SOYA), name: 'X', price: 5, isVegetarian: true }],
  ] as const) {
    assert.equal((await post(fn as any, url, body, parent)).status, 403, `${url} refused for parents`);
  }
  assert.equal((await menuDays(jsonRequest(`/api/staff/menu-days?from=${MON}&days=1`, 'GET', undefined, parent))).status, 403);
});
