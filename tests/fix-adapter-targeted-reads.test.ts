import './helpers/isolate-env';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { invalidateStaticCache } from '../lib/firestore-db';
import prisma from '../lib/prisma';

/**
 * HIGH 14: dishes by ID and menus by date are read with targeted Firestore queries, never the whole
 * collection, and return exactly the same records (and order) as before.
 */

let fs: FakeFirestore;
let fullReads: Record<string, number>;
const CATS = ['Pre-primary', 'Primary', 'Secondary', 'ALL'];
const T = '2026-10-01T00:00:00.000Z';
const day = (i: number) => new Date(Date.UTC(2026, 10, 1) + i * 86400000).toISOString().slice(0, 10);

beforeEach(() => {
  fs = new FakeFirestore();
  fullReads = {};
  // Count whole-collection reads (collection(...).get() with no filter).
  const real = fs.asFirestore() as any;
  const spy = new Proxy(real, {
    get(target, prop) {
      if (prop === 'collection') {
        return (name: string) => {
          const col = target.collection(name);
          return new Proxy(col, {
            get(c, p) {
              if (p === 'get') return async () => { fullReads[name] = (fullReads[name] || 0) + 1; return c.get(); };
              const v = (c as any)[p];
              return typeof v === 'function' ? v.bind(c) : v;
            },
          });
        };
      }
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  setFirestoreForTesting(spy);
  invalidateStaticCache();
  // 60 dishes (some with allergens), 60 days x 4 category entries, inserted in shuffled order.
  for (const i of [...Array(60).keys()].sort(() => 0.5 - Math.random())) {
    fs.seed('meals', `meal_${String(i).padStart(2, '0')}`, { id: `meal_${String(i).padStart(2, '0')}`, name: `Dish ${i}`, price: 50 + i, category: 'LUNCH', isVegetarian: i % 3 !== 0, createdAt: T, updatedAt: T });
  }
  fs.seed('allergens', 'alg_milk', { id: 'alg_milk', name: 'Milk', createdAt: T, updatedAt: T });
  for (const i of [3, 7, 11]) fs.seed('mealAllergens', `ma_${i}`, { id: `ma_${i}`, mealId: `meal_${String(i).padStart(2, '0')}`, allergenId: 'alg_milk', createdAt: T, updatedAt: T });
  for (const i of [...Array(60).keys()].sort(() => 0.5 - Math.random())) {
    for (const c of CATS) {
      const id = `menu_${day(i)}_${c.toLowerCase()}`;
      fs.seed('menus', id, { id, date: day(i), studentCategory: c, mealId: `meal_${String(i % 60).padStart(2, '0')}`, isActive: i % 5 !== 0, isHoliday: i % 13 === 0, availableQuantity: 10, createdAt: T, updatedAt: T });
    }
  }
});
afterEach(() => setFirestoreForTesting(null));

const ids = (list: any[]) => list.map((x) => x.id);
const strip = (list: any[]) => JSON.parse(JSON.stringify(list));

test('dishes by ID: exactly the same records (with allergens) as reading all and picking, without a full read', async () => {
  const wanted = ['meal_07', 'meal_03', 'meal_59', 'meal_nope', 'meal_07'];
  const include = { mealAllergens: { include: { allergen: true } } };
  const all = await prisma.meal.findMany({ include });
  const fullBefore = fullReads.meals || 0;
  invalidateStaticCache();
  const picked = await prisma.meal.findMany({ where: { id: { in: wanted } }, include });
  assert.equal(fullReads.meals || 0, fullBefore, 'no whole-collection read of meals');
  // A full read returns documents by ID in Firestore (the fake keeps insertion order), so sort to compare.
  const expected = all.filter((m: any) => wanted.includes(m.id)).sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
  assert.deepEqual(strip(picked), strip(expected));
  assert.deepEqual(ids(picked), ['meal_03', 'meal_07', 'meal_59'], 'document-ID order, unknown IDs skipped');
  assert.equal(picked.find((m: any) => m.id === 'meal_07')!.mealAllergens[0].allergen.name, 'Milk');
  assert.deepEqual(await prisma.meal.findMany({ where: { id: { in: [] } } }), []);
});

test('menus by date range, by a list of dates (over 30) and by one date: same records as a full read + filter', async () => {
  const all = (await prisma.menu.findMany({})) as any[];
  const byId = (a: any, b: any) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const cases: Array<[string, any, (m: any) => boolean]> = [
    ['range (45 days, the parent schedule)', { date: { gte: day(10), lte: day(54) } }, (m) => m.date >= day(10) && m.date <= day(54)],
    ['range + category (parent menu)', { date: { gte: day(0), lte: day(44) }, studentCategory: { in: ['Primary', 'ALL'] } }, (m) => m.date <= day(44) && ['Primary', 'ALL'].includes(m.studentCategory)],
    ['only gte', { date: { gte: day(50) } }, (m) => m.date >= day(50)],
    ['list of 40 dates (2 chunks)', { date: { in: [...Array(40).keys()].map((i) => day(i * 1)) } }, (m) => m.date <= day(39)],
    ['list with unknown dates', { date: { in: [day(2), '2030-01-01', day(2)] } }, (m) => m.date === day(2)],
    ['one date', { date: day(5) }, (m) => m.date === day(5)],
  ];
  for (const [name, where, oracle] of cases) {
    const before = fullReads.menus || 0;
    const got = (await prisma.menu.findMany({ where })) as any[];
    assert.equal(fullReads.menus || 0, before, `${name}: no whole-collection read of menus`);
    const expected = all.filter(oracle).sort(byId);
    assert.deepEqual(strip(got), strip(expected), name);
  }
});
