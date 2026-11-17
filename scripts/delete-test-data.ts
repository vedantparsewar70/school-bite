/**
 * Deletes ONLY the exact documents marked `delete = yes` in a reviewed CSV from
 * scripts/list-test-data.ts. It never deletes by pattern and never calls Cashfree.
 *
 * DRY RUN by default: reads the listed documents and prints what would be deleted.
 * Nothing is written unless BOTH flags are given:
 *   --apply                 actually delete
 *   --project=<projectId>   must equal the Firebase project the env file points at
 *
 * Usage:
 *   npx tsx --env-file=.env.production.local scripts/delete-test-data.ts --file=test-data-review.csv
 *   npx tsx --env-file=.env.production.local scripts/delete-test-data.ts --file=test-data-review.csv --apply --project=<id>
 *
 * With --apply it first saves a JSON backup of every document it will delete
 * (--backup=<file>, default test-data-backup-<time>.json, git-ignored) and stops if that fails.
 * Then it deletes in this order: order lines, payments, orders, unfinished checkouts, payment
 * exceptions, checkout locks, child allergies, children, parents, users, teacher orders; and last
 * extras, menu entries, dish allergen links and dishes. It prints counts at the end.
 *
 * Refuses to: touch any other collection; delete a staff or admin user; delete a PAID or
 * refund-in-progress order/payment unless --allow-paid is given (cancel and refund real-money
 * orders in Admin → Orders first). IDs that no longer exist are reported and skipped.
 */
import { readFileSync, writeFileSync } from 'fs';
import type { Firestore } from 'firebase-admin/firestore';

/** Deletion order: what points at something is deleted before what it points at. */
export const DELETE_ORDER = [
  'orderItems',
  'payments',
  'orders',
  'pending_orders',
  'payment_exceptions',
  'idempotency_locks',
  'studentAllergies',
  'students',
  'parents',
  'users',
  'teacher_orders',
  'pending_teacher_orders',
  'menuExtras',
  'menus',
  'mealAllergens',
  'meals',
  'teacher_meals',
] as const;

const LIVE_MONEY = new Set(['PAID', 'REFUND_PENDING']);

export type Target = { collection: string; id: string };

/** Minimal CSV parser (quoted cells, "" escapes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** Rows marked delete = yes, as exact (collection, id) pairs. */
export function targetsFromCsv(text: string): Target[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const [ci, ii, di] = [col('collection'), col('id'), col('delete')];
  if (ci < 0 || ii < 0 || di < 0) throw new Error('The CSV needs collection, id and delete columns (use the file from list-test-data.ts).');
  const seen = new Set<string>();
  const out: Target[] = [];
  for (const r of rows) {
    if (String(r[di] || '').trim().toLowerCase() !== 'yes') continue;
    const t = { collection: String(r[ci] || '').trim(), id: String(r[ii] || '').trim() };
    const key = `${t.collection}/${t.id}`;
    if (!t.collection || !t.id || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export type Plan = {
  found: Array<Target & { data: Record<string, any> }>;
  missing: Target[];
  problems: string[];
};

/** Reads every target (no writes) and checks the safety rules. */
export async function planDeletion(firestore: Firestore, targets: Target[], allowPaid = false): Promise<Plan> {
  const plan: Plan = { found: [], missing: [], problems: [] };
  const allowed = new Set<string>(DELETE_ORDER);
  for (const t of targets) {
    if (!allowed.has(t.collection)) {
      plan.problems.push(`${t.collection}/${t.id}: collection "${t.collection}" is not allowed`);
      continue;
    }
    if (t.id.includes('/')) {
      plan.problems.push(`${t.collection}/${t.id}: invalid ID`);
      continue;
    }
    const snap = await firestore.collection(t.collection).doc(t.id).get();
    if (!snap.exists) {
      plan.missing.push(t);
      continue;
    }
    const data = snap.data() || {};
    if (t.collection === 'users' && data.role && data.role !== 'PARENT') {
      plan.problems.push(`users/${t.id}: is a ${data.role} account; staff and admin accounts are never deleted`);
      continue;
    }
    let money = String(data.paymentStatus || '');
    if ((t.collection === 'orderItems' || t.collection === 'payments') && data.orderId) {
      // A line or payment of a paid order counts as paid too.
      const order = await firestore.collection('orders').doc(String(data.orderId)).get();
      money = order.exists ? String(order.data()?.paymentStatus || '') : '';
    }
    if (!allowPaid && ['orders', 'teacher_orders', 'orderItems', 'payments'].includes(t.collection) && LIVE_MONEY.has(money)) {
      plan.problems.push(`${t.collection}/${t.id}: payment status ${money}; cancel and refund it in the admin screens first, or pass --allow-paid if it was a Cashfree test payment`);
      continue;
    }
    plan.found.push({ ...t, data });
  }
  return plan;
}

/** Deletes the planned documents in DELETE_ORDER, at most 400 per batch. Returns counts. */
export async function applyDeletion(firestore: Firestore, plan: Plan): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const collection of DELETE_ORDER) {
    const ids = plan.found.filter((f) => f.collection === collection).map((f) => f.id);
    for (let i = 0; i < ids.length; i += 400) {
      const batch = firestore.batch();
      for (const id of ids.slice(i, i + 400)) batch.delete(firestore.collection(collection).doc(id));
      await batch.commit();
    }
    if (ids.length) counts[collection] = ids.length;
  }
  return counts;
}

export function summarize(plan: Plan): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of plan.found) counts[f.collection] = (counts[f.collection] || 0) + 1;
  return counts;
}

export type RunOptions = {
  csv: string;
  apply: boolean;
  project: string | null;
  currentProject: string | null;
  allowPaid: boolean;
  backupPath: string;
  writeBackup?: (path: string, json: string) => void;
  log?: (...args: unknown[]) => void;
};

/** The whole run. Dry run unless apply + matching project; backup is written before any delete. */
export async function run(firestore: Firestore, o: RunOptions): Promise<{ applied: boolean; counts: Record<string, number>; plan: Plan }> {
  const log = o.log || console.log;
  const targets = targetsFromCsv(o.csv);
  const plan = await planDeletion(firestore, targets, o.allowPaid);
  log(`${targets.length} row(s) marked delete = yes; ${plan.found.length} found, ${plan.missing.length} already gone, ${plan.problems.length} refused.`);
  for (const p of plan.problems) log(`REFUSED  ${p}`);
  for (const m of plan.missing) log(`MISSING  ${m.collection}/${m.id}`);
  const counts = summarize(plan);
  log(counts);

  if (!o.apply) {
    log('DRY RUN: nothing was deleted. Add --apply --project=<id> to delete the documents above.');
    return { applied: false, counts, plan };
  }
  if (plan.problems.length) throw new Error('Refused rows found; fix the CSV (or flags) and run again. Nothing was deleted.');
  if (!o.project || !o.currentProject || o.project !== o.currentProject) {
    throw new Error(`--project must equal the connected Firebase project (${o.currentProject || 'unknown'}). Nothing was deleted.`);
  }
  if (!plan.found.length) {
    log('Nothing to delete.');
    return { applied: true, counts: {}, plan };
  }

  const backup = { project: o.currentProject, createdAt: new Date().toISOString(), documents: plan.found };
  (o.writeBackup || ((p, j) => writeFileSync(p, j, 'utf-8')))(o.backupPath, JSON.stringify(backup, null, 2));
  log(`Backup of ${plan.found.length} document(s) saved to ${o.backupPath}.`);

  const deleted = await applyDeletion(firestore, plan);
  log('Deleted:', deleted);
  return { applied: true, counts: deleted, plan };
}

async function main() {
  const argv = process.argv.slice(2);
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const file = get('file');
  if (!file) throw new Error('Pass --file=<reviewed CSV from list-test-data.ts>');
  const { db, getFirebaseApp } = await import('../lib/firebase-admin');
  const app = getFirebaseApp();
  const currentProject = app.options.projectId || (app.options.credential as any)?.projectId || process.env.FIREBASE_PROJECT_ID || null;
  await run(db, {
    csv: readFileSync(file, 'utf-8'),
    apply: argv.includes('--apply'),
    project: get('project') || null,
    currentProject,
    allowPaid: argv.includes('--allow-paid'),
    backupPath: get('backup') || `test-data-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  });
}

if (process.argv[1] && /delete-test-data\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error('Failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
