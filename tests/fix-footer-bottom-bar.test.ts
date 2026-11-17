import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** HIGH 11: on phones, the footer's last row of links is never hidden behind the fixed bottom bar. */

const footer = readFileSync('components/Footer.tsx', 'utf-8');

test('the footer leaves room (pb-24, more than the bottom bar) on parent, staff and admin pages, on phones only', () => {
  assert.match(footer, /'use client'/);
  assert.match(footer, /hasBottomBar \? 'pb-24 md:pb-0' : ''/);
  const rule = new RegExp(footer.match(/const hasBottomBar = \/(.+)\/\.test\(pathname\)/)![1]);
  for (const p of ['/parent/menu', '/parent', '/staff/orders', '/admin/orders']) assert.ok(rule.test(p), p);
  for (const p of ['/', '/about', '/teacher/menu', '/login', '/parenting']) assert.ok(!rule.test(p), p);
});

test('the bottom bars only show on phones (md:hidden), matching the footer padding', () => {
  for (const f of ['components/ParentMobileBottomNav.tsx', 'components/StaffMobileBottomNav.tsx', 'components/AdminMobileBottomNav.tsx']) {
    assert.match(readFileSync(f, 'utf-8'), /md:hidden fixed bottom-0/, f);
  }
});
