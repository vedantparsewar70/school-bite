import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { invalidateStaticCache } from '../lib/firestore-db';
import { BUSINESS_CONFIG } from '../lib/business-config';
import prisma from '../lib/prisma';
import { GET as menu } from '../app/api/menu/route';

/** LOW: wording leftovers (no made-up dish text, no ₹500 credit, one support number, no Cashfree mention). */

const DAY = '2026-11-18';
let fs: FakeFirestore;

beforeEach(() => {
  fs = useFakeFirestore();
  invalidateStaticCache();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T10:00:00+05:30') });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

test('a menu entry whose dish no longer exists is not shown as a made-up "Scheduled Brunch" for ₹80', async () => {
  fs.seed('meals', 'meal_ok', { id: 'meal_ok', name: 'Veg Pulao', price: 70, category: 'LUNCH', isVegetarian: true });
  fs.seed('menus', `menu_${DAY}_primary`, { id: `menu_${DAY}_primary`, date: DAY, studentCategory: 'Primary', mealId: 'meal_gone', isHoliday: false, isActive: true, availableQuantity: 50, orderingDeadline: '08:30' });
  fs.seed('menus', 'menu_2026-11-19_primary', { id: 'menu_2026-11-19_primary', date: '2026-11-19', studentCategory: 'Primary', mealId: 'meal_ok', isHoliday: false, isActive: true, availableQuantity: 50, orderingDeadline: '08:30' });
  const body = await (await menu(jsonRequest('/api/menu?category=Primary&startDate=2026-11-18&endDate=2026-11-19', 'GET'))).json();
  assert.deepEqual(body.menus.map((m: any) => m.meal?.name), ['Veg Pulao']);
  assert.ok(!JSON.stringify(body).includes('Scheduled Brunch'));
  assert.ok(!readFileSync('app/api/menu/route.ts', 'utf-8').includes('Freshly prepared'));
});

test('no filler dish description is invented for new teacher or student dishes', () => {
  assert.ok(!readFileSync('app/api/staff/teacher-menu/route.ts', 'utf-8').includes('Freshly prepared'));
  assert.ok(!readFileSync('app/api/admin/meals/route.ts', 'utf-8').includes('Freshly prepared'));
});

test('a new parent account starts with no wallet credit', async () => {
  const user: any = await prisma.user.create({
    data: { name: 'New Parent', email: 'new@example.com', phone: '9876543210', passwordHash: 'x', role: 'PARENT', parent: { create: {} } },
    include: { parent: true },
  });
  assert.equal(user.parent.walletBalance, 0);
  assert.ok(!readFileSync('app/api/auth/register/route.ts', 'utf-8').includes('walletBalance: 500'));
});

test('one support number only (the canteen), no WhatsApp claim; profile does not mention Cashfree', () => {
  const cfg = BUSINESS_CONFIG as any;
  assert.equal(cfg.supportPhone, undefined);
  assert.equal(cfg.supportPhoneRaw, undefined);
  assert.equal(cfg.whatsAppSupport, undefined);
  assert.ok(!readFileSync('lib/business-config.ts', 'utf-8').includes('9922028988'));
  assert.ok(!readFileSync('app/parent/profile/page.tsx', 'utf-8').includes('Required by Cashfree'));
});
