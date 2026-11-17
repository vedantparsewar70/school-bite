import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFailedMessage } from '../components/LoadError';

/** HIGH 12: a failed load is shown as an error with "Try again", never as "nothing here". */

const read = (p: string) => readFileSync(p, 'utf-8');

test('the message says what failed and how', () => {
  assert.equal(loadFailedMessage('your orders', 500), 'Could not load your orders (error 500). Please try again.');
  assert.equal(loadFailedMessage('the menu'), 'Could not load the menu. Check the connection and try again.');
});

test('list pages show LoadError before their empty state when nothing could be loaded', () => {
  const pages: Array<[string, string, string]> = [
    ['app/parent/orders/page.tsx', 'loadError && orders.length === 0', 'orders.length === 0 ? ('],
    ['app/parent/payments/page.tsx', 'loadError && payments.length === 0', 'payments.length === 0 ? ('],
    ['app/parent/menu/page.tsx', 'loadError && menus.length === 0', 'menus.length === 0 ? ('],
    ['app/admin/orders/page.tsx', 'loadError && orders.length === 0', 'orders.length === 0 ? ('],
    ['app/admin/kitchen/page.tsx', 'loadError && !kitchenData', 'loading ? ('],
    ['app/staff/teacher-menu/page.tsx', 'loadError && meals.length === 0', 'meals.length === 0 ? ('],
    ['app/teacher/menu/page.tsx', 'loadError && meals.length === 0', 'filteredMeals.length === 0 ? ('],
  ];
  for (const [file, guard, empty] of pages) {
    const src = read(file);
    assert.ok(src.includes(guard), `${file}: ${guard}`);
    assert.ok(src.indexOf(guard) < src.indexOf(`: ${empty}`), `${file}: the error comes before the empty state`);
    assert.match(src, /<LoadError message=\{loadError\} onRetry=/, file);
    assert.match(src, /setLoadError\(loadFailedMessage\(/, `${file}: a failed request is recorded`);
  }
});

test('the dashboard, reports and users pages show LoadError instead of zeros', () => {
  for (const [file, guard] of [
    ['app/admin/dashboard/page.tsx', 'if (loadError && !stats)'],
    ['app/admin/reports/page.tsx', 'if (loadError && !reports)'],
    ['app/admin/users/page.tsx', 'if (loadError && students.length === 0 && parents.length === 0)'],
  ]) {
    const src = read(file);
    assert.ok(src.includes(guard), `${file}: ${guard}`);
    assert.match(src, /<LoadError message=\{loadError\}/, file);
  }
});

test('Serve, History and Not served no longer add "nothing here" under a load error', () => {
  assert.match(read('app/staff/orders/page.tsx'), /loadError && rows\.length === 0 \? null : visibleRows\.length === 0/);
  assert.match(read('app/staff/orders/page.tsx'), /loadError && teachers\.length === 0 \? null : visibleTeachers\.length === 0/);
  assert.match(read('app/staff/history/page.tsx'), /error && rows\.length === 0 && teachers\.length === 0 \? null : view === 'NOT_SERVED'/);
  assert.match(read('app/admin/not-served/page.tsx'), /error && rows\.length === 0 && teachers\.length === 0 \? null : \(/);
});

test('a failed kitchen load for a new date does not keep showing the previous date', () => {
  const src = read('app/admin/kitchen/page.tsx');
  assert.match(src, /if \(!quiet\) setKitchenData\(null\);/);
});
