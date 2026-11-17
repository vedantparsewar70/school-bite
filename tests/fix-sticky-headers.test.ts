import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** HIGH 10: page headers stick just below the top bar (h-16), not underneath it. */

test('the top bar is 4rem (h-16) tall and sticks at the very top', () => {
  const nav = readFileSync('components/Navbar.tsx', 'utf-8');
  assert.match(nav, /sticky top-0 z-40/);
  assert.match(nav, /justify-between h-16/);
});

test('Serve, History and the teacher menu headers stick below it (top-16), so their counters and buttons stay visible', () => {
  for (const file of ['app/staff/orders/page.tsx', 'app/staff/history/page.tsx', 'app/teacher/menu/page.tsx']) {
    const src = readFileSync(file, 'utf-8');
    assert.ok(!src.includes('sticky top-0'), `${file}: no header under the top bar`);
    assert.match(src, /sticky top-16 z-30/, file);
  }
});
