import './helpers/isolate-env';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { listTestData, toCsv } from '../scripts/list-test-data';
import { DELETE_ORDER, run, targetsFromCsv } from '../scripts/delete-test-data';

/** Data cleanup tools (written, not run against any real database): tested on the in-memory fake only. */

let fs: FakeFirestore;
const T = '2026-10-01T00:00:00.000Z';

beforeEach(() => {
  fs = new FakeFirestore();
  // Real parent, test parent, staff with a "test" email, a test dish used on a menu.
  fs.seed('users', 'usr_real', { id: 'usr_real', email: 'asha.rao@gmail.com', name: 'Asha Rao', role: 'PARENT', createdAt: T });
  fs.seed('users', 'usr_test', { id: 'usr_test', email: 'test1@example.com', name: 'Test Parent', role: 'PARENT', createdAt: T });
  fs.seed('users', 'usr_staff', { id: 'usr_staff', email: 'staff-test@school.com', name: 'Kitchen', role: 'STAFF', createdAt: T });
  fs.seed('parents', 'par_real', { id: 'par_real', userId: 'usr_real' });
  fs.seed('parents', 'par_test', { id: 'par_test', userId: 'usr_test' });
  fs.seed('students', 'stu_real', { id: 'stu_real', parentId: 'par_real', name: 'Riya Rao', grade: '3' });
  fs.seed('students', 'stu_test', { id: 'stu_test', parentId: 'par_test', name: 'Kid One', grade: '2' });
  fs.seed('studentAllergies', 'sa_1', { id: 'sa_1', studentId: 'stu_test', allergyId: 'alg_milk' });
  fs.seed('meals', 'meal_real', { id: 'meal_real', name: 'Veg Pulao', price: 70 });
  fs.seed('meals', 'meal_junk', { id: 'meal_junk', name: 'Iksdhf', price: 1 });
  fs.seed('menus', 'menu_junk', { id: 'menu_junk', date: '2026-11-20', studentCategory: 'Primary', mealId: 'meal_junk' });
  fs.seed('menus', 'menu_real', { id: 'menu_real', date: '2026-11-20', studentCategory: 'Secondary', mealId: 'meal_real' });
  fs.seed('orders', 'ORD-T', { id: 'ORD-T', parentId: 'par_test', paymentStatus: 'CANCELLED', orderStatus: 'CANCELLED', totalAmount: 70, createdAt: T });
  fs.seed('orders', 'ORD-PAID', { id: 'ORD-PAID', parentId: 'par_test', paymentStatus: 'PAID', orderStatus: 'CONFIRMED', totalAmount: 70, createdAt: T });
  fs.seed('orders', 'ORD-R', { id: 'ORD-R', parentId: 'par_real', paymentStatus: 'PAID', orderStatus: 'CONFIRMED', totalAmount: 70, createdAt: T });
  fs.seed('orderItems', 'oit_t', { id: 'oit_t', orderId: 'ORD-T', studentId: 'stu_test', mealId: 'meal_real', date: '2026-11-20' });
  fs.seed('orderItems', 'oit_p', { id: 'oit_p', orderId: 'ORD-PAID', studentId: 'stu_test', mealId: 'meal_real', date: '2026-11-21' });
  fs.seed('orderItems', 'oit_r', { id: 'oit_r', orderId: 'ORD-R', studentId: 'stu_real', mealId: 'meal_real', date: '2026-11-20' });
  fs.seed('payments', 'PAY-T', { id: 'PAY-T', orderId: 'ORD-T', amount: 70, status: 'SUCCESS' });
  fs.seed('idempotency_locks', 'gateway_par_test', { id: 'gateway_par_test' });
  fs.seed('teacher_orders', 'TCH-1', { id: 'TCH-1', teacherName: 'Demo Teacher', paymentStatus: 'CANCELLED' });
  fs.seed('teacher_orders', 'TCH-2', { id: 'TCH-2', teacherName: 'Meera Joshi', paymentStatus: 'PAID' });
});
afterEach(() => setFirestoreForTesting(null));

const snapshot = () => JSON.stringify(['users', 'parents', 'students', 'orders', 'orderItems', 'payments', 'menus', 'meals'].map((c) => fs.list(c)));

test('the list tool finds test accounts, their data and test dishes; never staff or real parents; writes nothing', async () => {
  const before = snapshot();
  const rows = await listTestData(fs.asFirestore());
  assert.equal(snapshot(), before, 'read-only');
  const keys = rows.map((r) => `${r.collection}/${r.id}`).sort();
  assert.deepEqual(keys, [
    'idempotency_locks/gateway_par_test', 'meals/meal_junk', 'menus/menu_junk',
    'orderItems/oit_p', 'orderItems/oit_t', 'orders/ORD-PAID', 'orders/ORD-T',
    'parents/par_test', 'payments/PAY-T', 'studentAllergies/sa_1', 'students/stu_test',
    'teacher_orders/TCH-1', 'users/usr_test',
  ]);
  const csv = toCsv(rows);
  assert.match(csv.split('\r\n')[0], /^collection,id,reason,label,linkedTo,createdAt,amount,paymentStatus,delete$/);
  assert.equal(targetsFromCsv(csv).length, 0, 'nothing is marked for deletion until a person reviews it');
});

test('the list tool source only reads (no set/update/delete/batch/add)', () => {
  const src = readFileSync('scripts/list-test-data.ts', 'utf-8');
  // Firestore is only reached through collection(name).get(); no document refs, batches or transactions.
  assert.ok(!/\.(doc|update|delete|batch|runTransaction|create)\(/.test(src));
  assert.deepEqual(src.match(/firestore\.collection\([^)]*\)\.\w+/g), ['firestore.collection(collection).get']);
});

function reviewed(keys: string[]): string {
  return ['collection,id,reason,delete', ...keys.map((k) => { const [c, id] = k.split('/'); return `${c},${id},x,yes`; }), 'orders,ORD-R,real,'].join('\r\n');
}

test('delete tool: dry run by default changes nothing', async () => {
  const before = snapshot();
  const out = await run(fs.asFirestore(), { csv: reviewed(['users/usr_test', 'orders/ORD-T']), apply: false, project: null, currentProject: 'p', allowPaid: false, backupPath: 'x', log: () => {} });
  assert.equal(out.applied, false);
  assert.equal(snapshot(), before);
});

test('delete tool: --apply needs the matching project, refuses staff/paid rows, backs up first, deletes only the listed IDs in order', async () => {
  const keys = ['users/usr_test', 'parents/par_test', 'students/stu_test', 'studentAllergies/sa_1', 'orders/ORD-T', 'orderItems/oit_t', 'payments/PAY-T', 'idempotency_locks/gateway_par_test', 'menus/menu_junk', 'meals/meal_junk', 'teacher_orders/TCH-1'];
  const opts = { apply: true, currentProject: 'school-prod', allowPaid: false, backupPath: 'b.json', log: () => {} };

  await assert.rejects(run(fs.asFirestore(), { ...opts, csv: reviewed(keys), project: 'other' }), /--project must equal/);
  await assert.rejects(run(fs.asFirestore(), { ...opts, csv: reviewed([...keys, 'users/usr_staff']), project: 'school-prod' }), /Refused/);
  await assert.rejects(run(fs.asFirestore(), { ...opts, csv: reviewed([...keys, 'orders/ORD-PAID']), project: 'school-prod' }), /Refused/);
  await assert.rejects(run(fs.asFirestore(), { ...opts, csv: reviewed([...keys, 'orderItems/oit_p']), project: 'school-prod' }), /Refused/);
  assert.ok(fs.getDoc('users', 'usr_test'), 'nothing deleted by a refused run');

  const order: string[] = [];
  const realBatch = (fs.asFirestore() as any).batch.bind(fs.asFirestore());
  const firestore = new Proxy(fs.asFirestore() as any, {
    get(t, p) {
      if (p === 'batch') return () => { const b = realBatch(); const del = b.delete.bind(b); b.delete = (ref: any) => { order.push(ref.path || `${ref.parent?.id}/${ref.id}`); return del(ref); }; return b; };
      const v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  let backup = '';
  const events: string[] = [];
  const out = await run(firestore, { ...opts, csv: reviewed(keys), project: 'school-prod', writeBackup: (_p, j) => { backup = j; events.push('backup'); }, log: (m) => { if (String(m).startsWith('Deleted')) events.push('deleted'); } });
  assert.equal(out.applied, true);
  assert.deepEqual(events, ['backup', 'deleted'], 'backup before any delete');
  assert.deepEqual(JSON.parse(backup).documents.map((d: any) => `${d.collection}/${d.id}`).sort(), [...keys].sort());
  for (const k of keys) { const [c, id] = k.split('/'); assert.equal(fs.getDoc(c, id), undefined, k); }
  for (const keep of ['users/usr_real', 'users/usr_staff', 'orders/ORD-R', 'orders/ORD-PAID', 'meals/meal_real', 'menus/menu_real', 'teacher_orders/TCH-2']) {
    const [c, id] = keep.split('/');
    assert.ok(fs.getDoc(c, id), `${keep} kept`);
  }
  const rank = (c: string) => DELETE_ORDER.indexOf(c as any);
  const seq = order.map((p) => rank(p.split('/')[0]));
  assert.equal(order.length, keys.length);
  assert.ok(seq.every((r) => r >= 0), order.join(' '));
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b), 'deleted in DELETE_ORDER');
});

test('delete order: lines/payments before orders, accounts after their data, dishes last', () => {
  const i = (c: string) => DELETE_ORDER.indexOf(c as any);
  assert.ok(i('orderItems') < i('orders') && i('payments') < i('orders'));
  assert.ok(i('students') < i('parents') && i('parents') < i('users'));
  assert.ok(i('menus') < i('meals') && i('menuExtras') < i('meals'));
  assert.equal(DELETE_ORDER[DELETE_ORDER.length - 1], 'teacher_meals');
});
