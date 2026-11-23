import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { compareByClassDivisionName, DIVISION_LIST_TEXT, DIVISION_RANGE_TEXT, DIVISIONS, divisionOf, isDivision } from '../lib/division';
import { DEFAULT_SERVE_FILTER, filterServeRows } from '../lib/serve-filter';
import * as children from '../app/api/parent/children/route';
import { GET as serveList } from '../app/api/staff/serve/route';

/** Divisions are A to H, listed once (lib/division.ts DIVISIONS) and used everywhere. */

const DAY = '2026-11-18';
let fs: FakeFirestore;
let parent: Record<string, string>;
let staff: Record<string, string>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${DAY}T06:30:00+05:30`) });
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210', createdAt: '2026-10-01T00:00:00.000Z' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1', createdAt: '2026-10-01T00:00:00.000Z' });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  staff = await signedInAs(fs, 'STAFF');
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: null, category: 'LUNCH', isVegetarian: true });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

const child = (id: string, name: string, studentCategory: string, division: string) =>
  fs.seed('students', id, { id, parentId: 'par_1', name, grade: studentCategory, division, rollNo: '-', studentId: `STU-2026-${id}`, studentCategory, isActive: true, createdAt: '2026-10-01T00:00:00.000Z' });
const post = (body: Record<string, unknown>) => children.POST(jsonRequest('/api/parent/children', 'POST', body, parent));
const put = (body: Record<string, unknown>) => children.PUT(jsonRequest('/api/parent/children', 'PUT', body, parent));
const form = { name: 'Aarav Shah', dob: null, category: 'Primary', studentCategory: 'Primary', grade: 'Primary' };
const REJECTED = ['I', 'a', 'AB', ''];

test('the one shared list is A to H, and the messages are built from it', () => {
  assert.deepEqual([...DIVISIONS], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.equal(DIVISION_LIST_TEXT, 'A, B, C, D, E, F, G or H');
  assert.equal(DIVISION_RANGE_TEXT, 'A to H');
  for (const d of ['F', 'G', 'H']) assert.equal(isDivision(d), true, d);
  for (const d of REJECTED) assert.equal(isDivision(d), false, d);
  assert.equal(divisionOf(' h '), 'H', 'stored values are read forgivingly for display');
  assert.equal(divisionOf('I'), null);
});

test('create: F, G and H are accepted; I, a, AB and empty are rejected', async () => {
  for (const division of REJECTED) {
    const res = await post({ ...form, division });
    assert.equal(res.status, 400, division);
    assert.equal((await res.json()).error, 'Please choose the division (A, B, C, D, E, F, G or H).');
  }
  assert.equal(fs.list('students').length, 0, 'nothing saved');
  for (const division of ['F', 'G', 'H']) {
    const res = await post({ ...form, name: `Child ${division}`, division });
    assert.equal(res.status, 201, division);
    const { student } = await res.json();
    assert.equal(fs.getDoc('students', student.id)?.division, division);
  }
});

test('edit: F, G and H are accepted; I, a, AB and empty are rejected; existing children keep their division', async () => {
  child('stu_c', 'Has C', 'Secondary', 'C');
  child('stu_e', 'Has E', 'Primary', 'E');
  for (const division of REJECTED) {
    const res = await put({ id: 'stu_c', name: 'Has C', division });
    assert.equal(res.status, 400, division);
    assert.equal(fs.getDoc('students', 'stu_c')?.division, 'C', 'unchanged');
  }
  for (const division of ['F', 'G', 'H']) {
    assert.equal((await put({ id: 'stu_c', name: 'Has C', division })).status, 200, division);
    assert.equal(fs.getDoc('students', 'stu_c')?.division, division);
  }
  // Editing without sending a division keeps the stored one (no migration, nothing reset).
  assert.equal((await put({ id: 'stu_e', name: 'Renamed E' })).status, 200);
  assert.equal(fs.getDoc('students', 'stu_e')?.division, 'E');
  assert.equal(fs.getDoc('students', 'stu_e')?.name, 'Renamed E');
});

test('Serve sorts A..H (none last) and the division filter works for F, G and H', async () => {
  child('stu_h', 'Hari', 'Primary', 'H');
  child('stu_f', 'Farah', 'Primary', 'F');
  child('stu_g', 'Gita', 'Primary', 'G');
  child('stu_e', 'Esha', 'Primary', 'E');
  child('stu_f2', 'Anil', 'Secondary', 'F');
  child('stu_none', 'Old', 'Primary', '-');
  fs.seed('orders', 'ORD-S', { id: 'ORD-S', parentId: 'par_1', totalAmount: 450, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', createdAt: '2026-11-17T10:00:00.000Z' });
  for (const [i, s] of ['stu_h', 'stu_f', 'stu_g', 'stu_e', 'stu_f2', 'stu_none'].entries()) {
    fs.seed('orderItems', `oit_${i}`, { id: `oit_${i}`, orderId: 'ORD-S', studentId: s, studentCategory: fs.getDoc('students', s)!.studentCategory, mealId: 'meal_dal', mealName: 'Dal Khichdi', date: DAY, quantity: 1, unitPrice: 75, totalPrice: 75 });
  }
  const res = await serveList(jsonRequest(`/api/staff/serve?date=${DAY}`, 'GET', undefined, staff));
  assert.equal(res.status, 200);
  const rows = (await res.json()).rows;
  assert.deepEqual(rows.map((r: any) => [r.studentName, r.division]), [
    ['Esha', 'E'], ['Farah', 'F'], ['Gita', 'G'], ['Hari', 'H'], ['Old', ''], ['Anil', 'F'],
  ]);
  const names = (f: Record<string, string>) => filterServeRows(rows, { ...DEFAULT_SERVE_FILTER, status: 'ALL', ...f }).map((r: any) => r.studentName);
  assert.deepEqual(names({ division: 'F' }), ['Farah', 'Anil']);
  assert.deepEqual(names({ division: 'F', category: 'Secondary' }), ['Anil']);
  assert.deepEqual(names({ division: 'G' }), ['Gita']);
  assert.deepEqual(names({ division: 'H' }), ['Hari']);
  assert.deepEqual(names({ division: 'ALL' }).length, 6);
  assert.ok(compareByClassDivisionName({ studentCategory: 'Primary', division: 'H' }, { studentCategory: 'Primary', division: null }) < 0);
});

test('Serve division chips (All + A to H) come from the shared list and fit a phone: own sideways-scrolling row, 44px tall', () => {
  const page = readFileSync('app/staff/orders/page.tsx', 'utf-8');
  assert.match(page, /const DIVISION_CHIPS = \['ALL', \.\.\.DIVISIONS\]/);
  const row = page.match(/<div className="([^"]*)" role="group" aria-label="Division">/);
  assert.ok(row, 'division chip row');
  assert.match(row![1], /\boverflow-x-auto\b/, 'scrolls sideways inside its own row, so the page never does');
  assert.match(row![1], /\bflex\b/);
  const chip = page.slice(page.indexOf('{DIVISION_CHIPS.map'), page.indexOf('{DIVISION_CHIPS.map') + 700);
  assert.match(chip, /shrink-0/);
  assert.match(chip, /min-h-\[44px\]/);
  assert.match(chip, /min-w-\[44px\]/);
});

test('the parent child form lists divisions from the shared list; nothing else hard-codes a division list', () => {
  const page = readFileSync('app/parent/children/page.tsx', 'utf-8');
  assert.match(page, /DIVISIONS\.map/);
  assert.match(page, /DIVISION_LIST_TEXT/);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) files.push(p);
    }
  };
  ['app', 'components', 'lib', 'types'].forEach(walk);
  const offenders = files.filter((f) => !f.replace(/\\/g, '/').endsWith('lib/division.ts')).filter((f) => {
    const s = readFileSync(f, 'utf-8');
    return /\[\s*['"]A['"]\s*,\s*['"]B['"]/.test(s) || /\[A-[B-Y]\]/.test(s) /* [A-Z] is spreadsheet columns, not divisions */ || /A, B, C, D/.test(s) || /\bA (?:to|-|–) [A-Z]\b/.test(s.replace(/\(A to H\)/g, ''));
  });
  assert.deepEqual(offenders, []);
});
