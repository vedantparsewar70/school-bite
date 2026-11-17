import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { setSystemSetting } from '../lib/allergy';
import { GET as menu } from '../app/api/menu/route';

/** HIGH 5: adding a main brunch checks the child's allergies, like extras do. */

const DAY = '2026-11-18';
let fs: FakeFirestore;
let parent: Record<string, string>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T10:00:00+05:30') });
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_1', name: 'Riya Sharma', grade: '3', studentCategory: 'Primary', allergies: 'Milk', isActive: true });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  fs.seed('meals', 'meal_paneer', { id: 'meal_paneer', name: 'Paneer Rice', price: 80, category: 'LUNCH', isVegetarian: true, allergens: 'Milk' });
  const id = `menu_${DAY}_primary`;
  fs.seed('menus', id, { id, date: DAY, studentCategory: 'Primary', mealId: 'meal_paneer', isHoliday: false, isActive: true, availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30' });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

test('the menu tells the page about the brunch conflict and the school policy', async () => {
  const body = await (await menu(jsonRequest(`/api/menu?date=${DAY}&childId=stu_1`, 'GET', undefined, parent))).json();
  assert.equal(body.menus[0].allergyEvaluation.hasConflict, true);
  assert.deepEqual(body.menus[0].allergyEvaluation.matchingAllergens.map((a: string) => a.toLowerCase()), ['milk']);
  assert.equal(body.policy.allowAllergyOrders, true);
  await setSystemSetting('ALLOW_ALLERGY_ORDERS', 'false');
  const blocked = await (await menu(jsonRequest(`/api/menu?date=${DAY}&childId=stu_1`, 'GET', undefined, parent))).json();
  assert.equal(blocked.policy.allowAllergyOrders, false);
});

test('the page blocks (policy off) or asks before adding a brunch with an allergy conflict, and flags the cart line', () => {
  const src = readFileSync('app/parent/menu/page.tsx', 'utf-8');
  const handler = src.slice(src.indexOf('const handleSelectMeal'), src.indexOf('// Filter menus based on search'));
  assert.match(handler, /allergy\?\.hasConflict/);
  assert.match(handler, /if \(!allowAllergyOrders\)/);
  assert.match(handler, /window\.confirm\(/);
  assert.match(handler, /executeAddToCart\(menuItem, date, Boolean\(allergy\?\.hasConflict\), matching\)/);
  assert.ok(!handler.includes('executeAddToCart(menuItem, date, false, [])'), 'no longer adds without checking');
});
