import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { createSessionToken } from '../lib/auth';
import { classDivisionLabel, compareByClassDivisionName, DIVISIONS } from '../lib/division';
import { DEFAULT_SERVE_FILTER, filterServeRows } from '../lib/serve-filter';
import { notServedCsv } from '../lib/not-served';
import * as children from '../app/api/parent/children/route';
import { GET as me } from '../app/api/auth/me/route';
import { GET as parentOrders } from '../app/api/parent/orders/route';
import { GET as adminOrders } from '../app/api/admin/orders/route';
import { GET as adminUsers } from '../app/api/admin/users/route';
import { GET as kitchen } from '../app/api/admin/kitchen/route';
import { GET as reports } from '../app/api/admin/reports/route';
import { GET as serveList } from '../app/api/staff/serve/route';

/** Division (A to H) on children, shown wherever a child is identified; the internal student ID is never shown. */

const DAY = '2026-11-18';
let fs: FakeFirestore;
let parent: Record<string, string>;
let staff: Record<string, string>;
let admin: Record<string, string>;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${DAY}T07:00:00+05:30`) });
  fs.seed('users', 'usr_p1', { id: 'usr_p1', email: 'p1@example.com', name: 'Parent One', role: 'PARENT', phone: '9876543210', createdAt: '2026-10-01T00:00:00.000Z' });
  fs.seed('parents', 'par_1', { id: 'par_1', userId: 'usr_p1', createdAt: '2026-10-01T00:00:00.000Z' });
  parent = { authorization: `Bearer ${await createSessionToken({ userId: 'usr_p1', email: 'p1@example.com', name: 'P', role: 'PARENT', parentId: 'par_1' })}` };
  staff = await signedInAs(fs, 'STAFF');
  admin = await signedInAs(fs, 'ADMIN');
  fs.seed('meals', 'meal_dal', { id: 'meal_dal', name: 'Dal Khichdi', price: null, category: 'LUNCH', isVegetarian: true });
});
afterEach(() => {
  mock.timers.reset();
  setFirestoreForTesting(null);
});

const child = (id: string, name: string, studentCategory: string, division: string, extra: Record<string, unknown> = {}) =>
  fs.seed('students', id, { id, parentId: 'par_1', name, grade: studentCategory, division, rollNo: '-', studentId: `STU-2026-${id.length}${name.length}${division.charCodeAt(0) || 0}`, studentCategory, isActive: true, createdAt: '2026-10-01T00:00:00.000Z', ...extra });
const post = (body: Record<string, unknown>) => children.POST(jsonRequest('/api/parent/children', 'POST', body, parent));
const put = (body: Record<string, unknown>) => children.PUT(jsonRequest('/api/parent/children', 'PUT', body, parent));
const form = { name: 'Aarav Shah', dob: null, category: 'Primary', studentCategory: 'Primary', grade: 'Primary' };

// --- 1. Division on the child form (server) ------------------------------------------------------

test('division is required on create and must be exactly A, B, C, D, E, F, G or H', async () => {
  for (const division of [undefined, '', 'a', 'I', 'AB', ' A', 'Z', 1, null]) {
    const res = await post({ ...form, division });
    assert.equal(res.status, 400, JSON.stringify(division));
    assert.match((await res.json()).error, /division \(A, B, C, D, E, F, G or H\)/);
  }
  assert.equal(fs.list('students').length, 0, 'nothing saved');
  for (const division of DIVISIONS) {
    const res = await post({ ...form, name: `Child ${division}`, division });
    assert.equal(res.status, 201);
    const { student } = await res.json();
    assert.equal(student.division, division);
    assert.equal(fs.getDoc('students', student.id)?.division, division);
    assert.match(String(fs.getDoc('students', student.id)?.studentId), /^STU-/, 'the internal ID is still kept in the database');
  }
});

test('on edit a division must be A to H; an older child without one must add it; a child with one keeps it', async () => {
  child('stu_old', 'Old Child', 'Primary', '-');
  child('stu_ok', 'Has Division', 'Secondary', 'C');

  for (const division of ['', 'I', 'b']) assert.equal((await put({ id: 'stu_ok', name: 'Has Division', division })).status, 400, division);
  const missing = await put({ id: 'stu_old', name: 'Old Child Renamed', category: 'Primary', studentCategory: 'Primary', grade: 'Primary' });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).code, 'DIVISION_REQUIRED');
  assert.equal(fs.getDoc('students', 'stu_old')?.name, 'Old Child', 'nothing changed');

  const fixed = await put({ id: 'stu_old', name: 'Old Child', category: 'Primary', studentCategory: 'Primary', grade: 'Primary', division: 'E' });
  assert.equal(fixed.status, 200);
  assert.equal(fs.getDoc('students', 'stu_old')?.division, 'E');
  assert.equal((await fixed.json()).student.studentId, undefined);

  assert.equal((await put({ id: 'stu_ok', name: 'Renamed' })).status, 200, 'a child that has a division keeps it');
  assert.equal(fs.getDoc('students', 'stu_ok')?.division, 'C');
});

test('an older child without a division: the parent is asked to add it before ordering (edit form opens); nothing else is blocked', async () => {
  child('stu_old', 'Old Child', 'Primary', '-');
  const list = (await (await children.GET(jsonRequest('/api/parent/children', 'GET', undefined, parent))).json()).students;
  assert.equal(list[0].division, null, 'shown as not set');
  const menu = readFileSync('app/parent/menu/page.tsx', 'utf-8');
  assert.match(menu, /hasDivisionOrAsk/);
  assert.match(menu, /router\.push\(`\/parent\/children\?edit=\$\{encodeURIComponent\(selectedChild\.id\)\}`\)/);
  assert.equal((menu.match(/if \(!hasDivisionOrAsk\(\)\) return;/g) || []).length, 2, 'brunch and extras');
  const page = readFileSync('app/parent/children/page.tsx', 'utf-8');
  assert.match(page, /get\('edit'\)/);
  assert.match(page, /Division \*/);
  assert.match(page, /DIVISIONS\.map/);
  // The Division field comes right after Class / Category.
  const classAt = page.search(/\n\s+Class \/ Category \*\r?\n/);
  const divisionAt = page.search(/\n\s+Division \*\r?\n/);
  assert.ok(classAt > 0 && classAt < divisionAt);
});

// --- 2. The internal student ID is never displayed ------------------------------------------------

test('no API response used for display, and no CSV export, contains the internal student ID', async () => {
  child('stu_riya', 'Riya', 'Primary', 'B');
  child('stu_old', 'Old Child', 'Secondary', '-');
  const internal = fs.list('students').map((s) => String(s.studentId));
  assert.ok(internal.every((s) => s.startsWith('STU-2026-')));
  fs.seed('orders', 'ORD-1', { id: 'ORD-1', parentId: 'par_1', totalAmount: 75, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', createdAt: '2026-11-17T10:00:00.000Z', paymentMethod: 'UPI' });
  fs.seed('orderItems', 'oit_1', { id: 'oit_1', orderId: 'ORD-1', studentId: 'stu_riya', studentCategory: 'Primary', mealId: 'meal_dal', mealName: 'Dal Khichdi', date: DAY, quantity: 1, unitPrice: 75, totalPrice: 75 });

  const responses: Array<[string, Response]> = [
    ['parent children', await children.GET(jsonRequest('/api/parent/children', 'GET', undefined, parent))],
    ['auth me', await me(jsonRequest('/api/auth/me', 'GET', undefined, parent))],
    ['parent orders', await parentOrders(jsonRequest('/api/parent/orders', 'GET', undefined, parent))],
    ['admin orders (admin)', await adminOrders(jsonRequest(`/api/admin/orders?date=${DAY}`, 'GET', undefined, admin))],
    ['admin orders (staff)', await adminOrders(jsonRequest(`/api/admin/orders?date=${DAY}`, 'GET', undefined, staff))],
    ['admin users', await adminUsers(jsonRequest('/api/admin/users', 'GET', undefined, admin))],
    ['kitchen / prepare', await kitchen(jsonRequest(`/api/admin/kitchen?date=${DAY}&refresh=true`, 'GET', undefined, staff))],
    ['reports', await reports(jsonRequest('/api/admin/reports', 'GET', undefined, admin))],
    ['serve', await serveList(jsonRequest(`/api/staff/serve?date=${DAY}`, 'GET', undefined, staff))],
    ['create child', await post({ ...form, name: 'New Kid', division: 'A' })],
    ['edit child', await put({ id: 'stu_riya', name: 'Riya S' })],
  ];
  for (const [name, res] of responses) {
    const text = await res.text();
    assert.ok(res.status < 300, `${name}: ${res.status} ${text.slice(0, 120)}`);
    assert.ok(text.length > 2, name);
    for (const id of [...internal, ...fs.list('students').map((s) => String(s.studentId))]) assert.ok(!text.includes(id), `${name} must not include ${id}`);
    assert.ok(!/STU-20\d\d-/.test(text), `${name}: no internal student ID`);
  }

  const serveRows = (await (await serveList(jsonRequest(`/api/staff/serve?date=${DAY}`, 'GET', undefined, staff))).json()).rows;
  const csv = notServedCsv(DAY, serveRows, []);
  assert.ok(!/STU-/.test(csv) && !/Roll/.test(csv));
  assert.match(csv, /"Riya S","Primary","B","Dal Khichdi"/);

  const exportRows = (await (await reports(jsonRequest('/api/admin/reports', 'GET', undefined, admin))).json()).exportRows;
  assert.deepEqual([exportRows[0].studentClass, exportRows[0].division], ['Primary', 'B']);
  assert.equal(exportRows[0].studentId, undefined);
  assert.equal(exportRows[0].rollNo, undefined);
});

test('no screen renders the internal student ID or a roll number', () => {
  const files = [
    'app/parent/children/page.tsx', 'app/parent/dashboard/page.tsx', 'app/parent/orders/page.tsx', 'app/parent/confirmation/[id]/page.tsx',
    'app/parent/cart/page.tsx', 'app/parent/menu/page.tsx', 'components/OrderReceiptModal.tsx', 'app/admin/users/page.tsx',
    'app/admin/orders/page.tsx', 'app/admin/kitchen/page.tsx', 'app/admin/reports/page.tsx', 'app/staff/orders/page.tsx',
    'app/staff/history/page.tsx', 'app/staff/prepare/page.tsx', 'components/NotServedList.tsx',
  ];
  for (const f of files) {
    const src = readFileSync(f, 'utf-8');
    // JSX like {child.studentId} (a `${...studentId}` cart key is not shown on screen).
    assert.ok(!/(?<!\$)\{[\w.?]+\.studentId\}|'Student ID'|Roll No|Roll:|Roll #|`Roll |rollNo\}/.test(src), `${f} shows an internal ID or a roll number`);
  }
});

// --- 3. Division wherever a child is identified; Serve ---------------------------------------------

test('Serve shows "Class · Division", sorts by class, division and name, and filters by division', async () => {
  child('stu_1', 'Zara', 'Primary', 'B');
  child('stu_2', 'Aditi', 'Primary', 'B');
  child('stu_3', 'Kabir', 'Primary', 'A');
  child('stu_4', 'Meera', 'Pre-primary', 'D');
  child('stu_5', 'Arjun', 'Secondary', 'A');
  child('stu_6', 'Old', 'Primary', '-');
  fs.seed('orders', 'ORD-S', { id: 'ORD-S', parentId: 'par_1', totalAmount: 450, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', createdAt: '2026-11-17T10:00:00.000Z' });
  for (const [i, s] of ['stu_1', 'stu_2', 'stu_3', 'stu_4', 'stu_5', 'stu_6'].entries()) {
    fs.seed('orderItems', `oit_${i}`, { id: `oit_${i}`, orderId: 'ORD-S', studentId: s, studentCategory: fs.getDoc('students', s)!.studentCategory, mealId: 'meal_dal', mealName: 'Dal Khichdi', date: DAY, quantity: 1, unitPrice: 75, totalPrice: 75 });
  }
  const rows = (await (await serveList(jsonRequest(`/api/staff/serve?date=${DAY}`, 'GET', undefined, staff))).json()).rows;
  assert.deepEqual(
    rows.map((r: any) => [r.studentName, classDivisionLabel(r.studentCategory, r.division)]),
    [['Meera', 'Pre-primary · D'], ['Kabir', 'Primary · A'], ['Aditi', 'Primary · B'], ['Zara', 'Primary · B'], ['Old', 'Primary'], ['Arjun', 'Secondary · A']]
  );
  const names = (f: Record<string, string>) => filterServeRows(rows, { ...DEFAULT_SERVE_FILTER, status: 'ALL', ...f }).map((r: any) => r.studentName);
  assert.deepEqual(names({ division: 'B' }), ['Aditi', 'Zara']);
  assert.deepEqual(names({ division: 'A' }), ['Kabir', 'Arjun']);
  assert.deepEqual(names({ division: 'A', category: 'Primary' }), ['Kabir']);
  assert.deepEqual(names({ division: 'E' }), []);
  assert.deepEqual(names({ division: 'ALL' }).length, 6);

  const page = readFileSync('app/staff/orders/page.tsx', 'utf-8');
  assert.match(page, /const DIVISION_CHIPS = \['ALL', \.\.\.DIVISIONS\]/);
  assert.match(page, /aria-label="Division"/);
  assert.match(page, /classDivisionLabel\(r\.studentCategory, r\.division\)/);
  assert.match(page, /text-lg font-black[^"]*">\{r\.studentName\}/, 'name large');
});

test('division appears in history, not-served, kitchen, orders, users, children, cart, confirmation and receipts', async () => {
  assert.equal(classDivisionLabel('Primary', 'B'), 'Primary · B');
  assert.equal(classDivisionLabel('Primary', '-'), 'Primary');
  assert.deepEqual(
    [{ studentCategory: 'Secondary', division: 'A', studentName: 'b' }, { studentCategory: 'Primary', division: null, studentName: 'a' }, { studentCategory: 'Primary', division: 'C', studentName: 'z' }]
      .sort(compareByClassDivisionName)
      .map((r) => r.studentName),
    ['z', 'a', 'b']
  );
  for (const f of [
    'app/staff/history/page.tsx', 'components/NotServedList.tsx', 'app/admin/kitchen/page.tsx', 'app/admin/orders/page.tsx', 'app/admin/users/page.tsx',
    'app/parent/children/page.tsx', 'app/parent/cart/page.tsx', 'app/parent/confirmation/[id]/page.tsx', 'components/OrderReceiptModal.tsx',
    'app/parent/orders/page.tsx', 'app/parent/dashboard/page.tsx',
  ]) {
    const src = readFileSync(f, 'utf-8');
    assert.ok(/classDivisionLabel|classLabel\(|divisionOf|\.division/.test(src), `${f} shows the division`);
  }

  child('stu_riya', 'Riya', 'Primary', 'B');
  fs.seed('orders', 'ORD-1', { id: 'ORD-1', parentId: 'par_1', totalAmount: 75, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', createdAt: '2026-11-17T10:00:00.000Z' });
  fs.seed('orderItems', 'oit_1', { id: 'oit_1', orderId: 'ORD-1', studentId: 'stu_riya', studentCategory: 'Primary', mealId: 'meal_dal', mealName: 'Dal Khichdi', date: DAY, quantity: 1, unitPrice: 75, totalPrice: 75 });
  const history = (await (await parentOrders(jsonRequest('/api/parent/orders', 'GET', undefined, parent))).json()).orders;
  assert.deepEqual([history[0].items[0].studentCategory, history[0].items[0].studentDivision, history[0].items[0].studentRollNo], ['Primary', 'B', undefined]);
  const admins = (await (await adminOrders(jsonRequest(`/api/admin/orders?date=${DAY}`, 'GET', undefined, admin))).json()).orders;
  assert.deepEqual([admins[0].items[0].studentCategory, admins[0].items[0].studentDivision], ['Primary', 'B']);
  const users = await (await adminUsers(jsonRequest('/api/admin/users', 'GET', undefined, admin))).json();
  assert.equal(users.students.find((s: any) => s.id === 'stu_riya').division, 'B');
  const k = await (await kitchen(jsonRequest(`/api/admin/kitchen?date=${DAY}&refresh=true`, 'GET', undefined, staff))).json();
  assert.deepEqual(k.studentList.map((s: any) => [s.studentName, s.division]), [['Riya', 'B']]);
  assert.ok(k.classBreakdown.some((c: any) => /Primary · B/.test(JSON.stringify(c))));
});
