// Launch audit: time zone and school-day handling.
// Vercel runs in UTC; force that before anything reads the clock (Node honours runtime TZ changes).
process.env.TZ = 'UTC';

import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { signedInAs, jsonRequest, useFakeFirestore } from './helpers/session';
import {
  getTodayString,
  getOffsetDateString,
  isDeadlinePassed,
  formatDatePretty,
} from '../lib/utils';
import { validateCartAvailability } from '../lib/availability';
import { serviceProblem } from '../lib/order-fulfillment';
import { GET as adminStats } from '../app/api/admin/stats/route';
import { GET as menuGet } from '../app/api/menu/route';

let fs: FakeFirestore;

/** Freeze the clock at an IST wall-clock time, e.g. '2026-11-16T08:29'. */
const atIST = (istLocal: string) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${istLocal}:00+05:30`) });
};

const SAT = '2026-11-14';
const SUN = '2026-11-15';
const MON = '2026-11-16';

function seedMenus() {
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Rice', price: 80, category: 'LUNCH', isVegetarian: true });
  // Sunday as the monthly import writes it: holiday rows are inactive.
  fs.seed('menus', `menu_${SUN}_primary`, {
    id: `menu_${SUN}_primary`, date: SUN, studentCategory: 'Primary', mealId: '', isHoliday: true,
    holidayReason: 'Sunday Holiday', availableQuantity: 0, maxQuantity: 0, orderingDeadline: '08:30', isActive: false,
  });
  fs.seed('menus', `menu_${MON}_primary`, {
    id: `menu_${MON}_primary`, date: MON, studentCategory: 'Primary', mealId: 'meal_dal', isHoliday: false,
    availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', isActive: true,
  });
}

beforeEach(() => {
  fs = useFakeFirestore();
  seedMenus();
});
afterEach(() => mock.timers.reset());

test('ENV: process TZ is UTC like Vercel', () => {
  assert.equal(new Date().getTimezoneOffset(), 0);
});

// ---------------------------------------------------------------- 1. TIME ZONE

test('OK: getTodayString/getOffsetDateString use IST even when server is UTC (00:15 IST Mon = 18:45 UTC Sun)', () => {
  atIST(`${MON}T00:15`);
  assert.equal(new Date().toISOString().slice(0, 10), SUN, 'UTC date is still Sunday');
  assert.equal(getTodayString(), MON);
  assert.equal(getOffsetDateString(1), '2026-11-17');
  atIST(`${SUN}T23:59`);
  assert.equal(getTodayString(), SUN);
  assert.equal(getOffsetDateString(1), MON);
  // month/year rollover
  atIST('2026-12-31T23:00');
  assert.equal(getOffsetDateString(1), '2027-01-01');
});

test('OK: isDeadlinePassed cutoff is exactly 08:30 IST regardless of server TZ', () => {
  atIST(`${MON}T08:29`);
  assert.equal(isDeadlinePassed(MON), false);
  atIST(`${MON}T08:31`);
  assert.equal(isDeadlinePassed(MON), true);
  // the night before (00:00-05:30 IST window) is still open
  atIST(`${MON}T01:00`);
  assert.equal(isDeadlinePassed(MON), false);
  assert.equal(isDeadlinePassed(SUN), true);
});

test('OK: checkout validation accepts Monday at 08:29 IST and rejects at 08:31 IST (server in UTC)', async () => {
  const cart = [{ mealId: 'meal_dal', date: MON, quantity: 1, studentCategory: 'Primary' } as any];
  atIST(`${MON}T08:29`);
  assert.equal((await validateCartAvailability(cart)).valid, true);
  atIST(`${MON}T08:31`);
  const late = await validateCartAvailability(cart);
  assert.equal(late.valid, false);
  assert.equal(late.items[0].isDeadlinePassed, true);
});

test('OK: ordering for Monday is open at 00:15 IST Monday (UTC still Sunday)', async () => {
  atIST(`${MON}T00:15`);
  const r = await validateCartAvailability([{ mealId: 'meal_dal', date: MON, quantity: 1, studentCategory: 'Primary' } as any]);
  assert.equal(r.valid, true);
});

test('OK: /api/menu marks isPastDate/isDeadlinePassed by IST at 23:00 IST Sunday (UTC 17:30)', async () => {
  atIST(`${SUN}T23:00`);
  const res = await menuGet(jsonRequest(`/api/menu?date=${MON}&category=Primary`, 'GET'));
  const body = await res.json();
  const m = body.menus.find((x: any) => x.date === MON);
  assert.equal(m.isPastDate, false);
  assert.equal(m.isDeadlinePassed, false);
  assert.equal(m.isAvailable, true);
});

test('OK: serviceProblem accepts Cashfree payment_time with +05:30 offset just before cutoff', () => {
  const menu = { date: MON, isActive: true, isHoliday: false, orderingDeadline: '08:30' };
  assert.equal(serviceProblem(menu, new Date(`${MON}T08:29:59+05:30`)), null);
  assert.equal(serviceProblem(menu, new Date(`${MON}T08:30:30+05:30`))?.reason, 'PAID_AFTER_CUTOFF');
});

test('BUG (conditional, LOW): an offset-less paidAt string is read as UTC on Vercel, so 08:00 IST looks like 13:30 IST and is auto-refunded', () => {
  // lib/order-fulfillment.ts paymentCompletedAt(): new Date(payment.paidAt). Cashfree documents
  // payment_time WITH +05:30, so this only bites if Cashfree ever sends an offset-less time.
  const menu = { date: MON, isActive: true, isHoliday: false, orderingDeadline: '08:30' };
  assert.equal(serviceProblem(menu, new Date(`${MON}T08:00:00`))?.reason, 'PAID_AFTER_CUTOFF');
});

test('BUG (LOW): isDeadlinePassed fails OPEN on a malformed deadline ("8:30 AM") - cutoff never passes', () => {
  atIST(`${MON}T15:00`);
  assert.equal(isDeadlinePassed(MON, '08:30'), true);
  assert.equal(isDeadlinePassed(MON, '8:30 AM'), false, 'NaN date -> comparison false -> still open');
});

test('OK: formatDatePretty shows the right weekday for a YYYY-MM-DD in UTC', () => {
  assert.match(formatDatePretty(SUN), /Sun/);
  assert.match(formatDatePretty(MON), /Mon/);
});

// ---------------------------------------------------------------- 2. SCHOOL DAYS

test('BUG (HIGH): admin stats "nextMealDate" is calendar tomorrow (Sunday) on Saturday, ignoring holidays', async () => {
  atIST(`${SAT}T10:00`);
  const admin = await signedInAs(fs, 'ADMIN');
  fs.seed('orders', 'ORD-1', { id: 'ORD-1', parentId: 'par_x', totalAmount: 80, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', createdAt: `${SAT}T04:00:00.000Z` });
  fs.seed('orderItems', 'oit_1', { id: 'oit_1', orderId: 'ORD-1', mealId: 'meal_dal', studentId: 'stu_1', date: MON, quantity: 1, studentCategory: 'Primary' });
  const res = await adminStats(jsonRequest('/api/admin/stats', 'GET', undefined, admin));
  assert.equal(res.status, 200);
  const { stats, tomorrowProduction } = await res.json();
  assert.equal(stats.nextMealDate, SUN, 'next meal date is the Sunday holiday');
  assert.equal(stats.isTomorrowMenuPublished, false, 'banner says "NOT published - parents cannot order"');
  assert.equal(stats.tomorrowTotalMeals, 0, "Monday's paid order is not counted in the production preview");
  assert.equal(tomorrowProduction.length, 0);
});

test('BUG (MEDIUM/HIGH): parent checkout has no weekday guard - an active menu on a Sunday is orderable', async () => {
  // Nothing in lib/availability.ts checks the weekday; only a menu row with isHoliday blocks a date.
  // If an admin follows the dashboard's "Set & Publish Tomorrow's Menu" on a Saturday, this happens:
  fs.seed('menus', `menu_${SUN}_primary`, {
    id: `menu_${SUN}_primary`, date: SUN, studentCategory: 'Primary', mealId: 'meal_dal', isHoliday: false,
    availableQuantity: 50, maxQuantity: 50, orderingDeadline: '08:30', isActive: true,
  });
  atIST(`${SAT}T20:00`);
  const r = await validateCartAvailability([{ mealId: 'meal_dal', date: SUN, quantity: 1, studentCategory: 'Primary' } as any]);
  assert.equal(r.valid, true);
});

test('OK: a Sunday stored as a holiday row is rejected at checkout', async () => {
  atIST(`${SAT}T20:00`);
  const r = await validateCartAvailability([{ mealId: 'meal_dal', date: SUN, quantity: 1, studentCategory: 'Primary' } as any]);
  assert.equal(r.valid, false);
  assert.match(String(r.items[0].reason), /Sunday Holiday/);
});

test('OK: a date with no menu row at all (e.g. unimported Sunday) is rejected at checkout', async () => {
  atIST(`${SAT}T20:00`);
  const r = await validateCartAvailability([{ mealId: 'meal_dal', date: '2026-11-22', quantity: 1, studentCategory: 'Primary' } as any]);
  assert.equal(r.valid, false);
});
