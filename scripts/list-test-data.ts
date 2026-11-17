/**
 * READ-ONLY: lists candidate TEST data into a CSV for review. It never writes to Firestore
 * (only .get() reads) and never calls Cashfree.
 *
 * Usage (point --env-file at the database you want to inspect):
 *   npx tsx --env-file=.env.production.local scripts/list-test-data.ts [options]
 *
 * Options (all optional; the defaults match the pre-launch cleanup plan):
 *   --email-pattern=<regex>   parent emails to treat as test accounts (default: test|example|demo|dummy)
 *   --name-pattern=<regex>    parent or child names to treat as test (default: test|demo|dummy|asdf)
 *   --before=YYYY-MM-DD       also list parent accounts created before this date (e.g. the launch day)
 *   --dish-pattern=<regex>    dish names to treat as test (default: ^test\b|iksdhf|gt saa|dummy|asdf)
 *   --teacher-pattern=<regex> teacher names on teacher orders (default: test|demo|dummy|asdf)
 *   --out=<file>              CSV path (default: test-data-review.csv, git-ignored)
 *
 * The CSV holds one row per document: collection, id, why it was listed, a short label, the
 * linked parent/order/dish, created date, amount and payment status, and an empty `delete` column.
 * Review every row; put `yes` in `delete` for the rows to remove, then give the file to
 * scripts/delete-test-data.ts (dry run first). Staff and admin accounts are never listed.
 *
 * The CSV contains names and emails: keep it private and do not commit it.
 */
import { writeFileSync } from 'fs';
import type { Firestore } from 'firebase-admin/firestore';

export type Row = {
  collection: string;
  id: string;
  reason: string;
  label: string;
  linkedTo: string;
  createdAt: string;
  amount: string;
  paymentStatus: string;
};

export type ListOptions = {
  emailPattern: RegExp;
  namePattern: RegExp;
  before: string | null;
  dishPattern: RegExp;
  teacherPattern: RegExp;
};

export const DEFAULT_OPTIONS: ListOptions = {
  emailPattern: /test|example|demo|dummy/i,
  namePattern: /test|demo|dummy|asdf/i,
  before: null,
  dishPattern: /^test\b|iksdhf|gt saa|dummy|asdf/i,
  teacherPattern: /test|demo|dummy|asdf/i,
};

type Doc = Record<string, any> & { id: string };

async function all(firestore: Firestore, collection: string): Promise<Doc[]> {
  const snap = await firestore.collection(collection).get();
  return snap.docs.map((d) => ({ ...(d.data() as Record<string, any>), id: d.id }));
}

const day = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : v instanceof Date ? v.toISOString().slice(0, 10) : (v as any)?.toDate?.()?.toISOString?.().slice(0, 10) || '');

/** Collects candidate test documents. Reads only. */
export async function listTestData(firestore: Firestore, opts: ListOptions = DEFAULT_OPTIONS): Promise<Row[]> {
  const rows: Row[] = [];
  const seen = new Set<string>();
  const add = (collection: string, d: Doc, reason: string, label: string, linkedTo = '') => {
    const key = `${collection}/${d.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      collection,
      id: d.id,
      reason,
      label,
      linkedTo,
      createdAt: day(d.createdAt),
      amount: d.totalAmount ?? d.amount ?? '',
      paymentStatus: d.paymentStatus ?? d.status ?? '',
    });
  };

  const [users, parents, students] = await Promise.all([all(firestore, 'users'), all(firestore, 'parents'), all(firestore, 'students')]);

  // 1. Parent accounts (never staff or admin).
  const testUsers = new Map<string, string>();
  for (const u of users) {
    if (u.role !== 'PARENT') continue;
    const why: string[] = [];
    if (opts.emailPattern.test(String(u.email || ''))) why.push('email matches');
    if (opts.namePattern.test(String(u.name || ''))) why.push('name matches');
    if (opts.before && day(u.createdAt) && day(u.createdAt) < opts.before) why.push(`created before ${opts.before}`);
    if (why.length) testUsers.set(u.id, why.join('; '));
  }
  const parentOf = new Map<string, Doc>();
  for (const p of parents) parentOf.set(p.id, p);
  const testParentIds = new Set<string>();
  for (const p of parents) if (testUsers.has(p.userId)) testParentIds.add(p.id);
  // A child with a test name marks only that child (its parent is listed for review, not assumed).
  const testStudentIds = new Set<string>();
  for (const s of students) {
    if (testParentIds.has(s.parentId)) testStudentIds.add(s.id);
    else if (opts.namePattern.test(String(s.name || ''))) testStudentIds.add(s.id);
  }

  for (const u of users) if (testUsers.has(u.id)) add('users', u, testUsers.get(u.id)!, `${u.name || ''} <${u.email || ''}>`);
  for (const pid of testParentIds) {
    const p = parentOf.get(pid)!;
    add('parents', p, 'account of a listed user', '', `user ${p.userId}`);
  }
  for (const s of students) {
    if (!testStudentIds.has(s.id)) continue;
    add('students', s, testParentIds.has(s.parentId) ? 'child of a listed parent' : 'child name matches', `${s.name || ''} (${s.grade || s.studentCategory || ''})`, `parent ${s.parentId}`);
  }
  for (const sa of await all(firestore, 'studentAllergies')) {
    if (testStudentIds.has(sa.studentId)) add('studentAllergies', sa, 'allergy of a listed child', '', `student ${sa.studentId}`);
  }

  // 2. Dishes (student and teacher catalogs) and where they are used.
  const meals = await all(firestore, 'meals');
  const testMealIds = new Set(meals.filter((m) => opts.dishPattern.test(String(m.name || ''))).map((m) => m.id));
  for (const m of meals) if (testMealIds.has(m.id)) add('meals', m, 'dish name matches', String(m.name || ''));
  for (const m of await all(firestore, 'teacher_meals')) {
    if (opts.dishPattern.test(String(m.name || ''))) add('teacher_meals', m, 'teacher dish name matches', String(m.name || ''));
  }
  for (const ma of await all(firestore, 'mealAllergens')) {
    if (testMealIds.has(ma.mealId)) add('mealAllergens', ma, 'allergen link of a listed dish', '', `dish ${ma.mealId}`);
  }
  for (const m of await all(firestore, 'menus')) {
    if (testMealIds.has(m.mealId)) add('menus', m, 'menu entry uses a listed dish', `${m.date} ${m.studentCategory || ''}`, `dish ${m.mealId}`);
  }
  for (const e of await all(firestore, 'menuExtras')) {
    if (testMealIds.has(e.mealId)) add('menuExtras', e, 'extra uses a listed dish', `${e.date} ${e.studentCategory || ''}`, `dish ${e.mealId}`);
  }

  // 3. Orders of listed parents/children, or containing a listed dish, with their lines and payments.
  const [orders, items] = await Promise.all([all(firestore, 'orders'), all(firestore, 'orderItems')]);
  const testOrderIds = new Set<string>();
  for (const o of orders) if (testParentIds.has(o.parentId)) testOrderIds.add(o.id);
  for (const it of items) if (testStudentIds.has(it.studentId) || testMealIds.has(it.mealId)) testOrderIds.add(it.orderId);
  for (const o of orders) {
    if (!testOrderIds.has(o.id)) continue;
    add('orders', o, testParentIds.has(o.parentId) ? 'order of a listed parent' : 'order has a listed child or dish', `${o.orderStatus || ''}`, `parent ${o.parentId}`);
  }
  for (const it of items) {
    if (testOrderIds.has(it.orderId)) add('orderItems', it, 'line of a listed order', `${it.date || ''} ${it.mealName || it.mealId || ''}`, `order ${it.orderId}`);
  }
  for (const p of await all(firestore, 'payments')) {
    if (testOrderIds.has(p.orderId)) add('payments', p, 'payment of a listed order', String(p.paymentMethod || ''), `order ${p.orderId}`);
  }
  for (const p of await all(firestore, 'pending_orders')) {
    if (testParentIds.has(p.parentId)) add('pending_orders', p, 'unfinished checkout of a listed parent', '', `parent ${p.parentId}`);
  }
  for (const x of await all(firestore, 'payment_exceptions')) {
    if (testParentIds.has(x.ownerId) || testOrderIds.has(x.orderId)) add('payment_exceptions', x, 'payment exception of a listed parent', String(x.reason || ''), `order ${x.orderId}`);
  }
  for (const l of await all(firestore, 'idempotency_locks')) {
    const owner = l.id.startsWith('gateway_') ? l.id.slice('gateway_'.length) : '';
    if (testParentIds.has(owner) || testOrderIds.has(l.id)) add('idempotency_locks', l, 'checkout lock of a listed parent', '', owner ? `parent ${owner}` : `order ${l.id}`);
  }

  // 4. Teacher orders by teacher name.
  for (const t of await all(firestore, 'teacher_orders')) {
    if (opts.teacherPattern.test(String(t.teacherName || ''))) add('teacher_orders', t, 'teacher name matches', `${t.teacherName || ''} ${t.date || ''}`);
  }
  for (const t of await all(firestore, 'pending_teacher_orders')) {
    if (opts.teacherPattern.test(String(t.teacherName || ''))) add('pending_teacher_orders', t, 'teacher name matches', `${t.teacherName || ''}`);
  }

  return rows;
}

const COLUMNS: Array<keyof Row | 'delete'> = ['collection', 'id', 'reason', 'label', 'linkedTo', 'createdAt', 'amount', 'paymentStatus', 'delete'];

/** CSV cell, safe for spreadsheets (no formula injection). */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[]): string {
  const lines = [COLUMNS.join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => csvCell(c === 'delete' ? '' : r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

function parseArgs(argv: string[]) {
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const re = (name: string, fallback: RegExp) => (get(name) ? new RegExp(get(name)!, 'i') : fallback);
  const before = get('before') || null;
  if (before && !/^\d{4}-\d{2}-\d{2}$/.test(before)) throw new Error('--before must be YYYY-MM-DD');
  return {
    out: get('out') || 'test-data-review.csv',
    opts: {
      emailPattern: re('email-pattern', DEFAULT_OPTIONS.emailPattern),
      namePattern: re('name-pattern', DEFAULT_OPTIONS.namePattern),
      before,
      dishPattern: re('dish-pattern', DEFAULT_OPTIONS.dishPattern),
      teacherPattern: re('teacher-pattern', DEFAULT_OPTIONS.teacherPattern),
    } as ListOptions,
  };
}

async function main() {
  const { out, opts } = parseArgs(process.argv.slice(2));
  const { db } = await import('../lib/firebase-admin');
  const rows = await listTestData(db, opts);
  writeFileSync(out, '﻿' + toCsv(rows), 'utf-8');
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.collection] = (counts[r.collection] || 0) + 1;
  console.log('READ-ONLY: nothing was changed.');
  console.table(counts);
  console.log(`${rows.length} candidate document(s) written to ${out}. Review it and mark rows with delete = yes.`);
}

if (process.argv[1] && /list-test-data\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error('Failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
