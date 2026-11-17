import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** LOW: parent pages check for menu changes every 30 seconds, not every 10. */

test('parent menu and dashboard poll every 30 s', () => {
  for (const file of ['app/parent/menu/page.tsx', 'app/parent/dashboard/page.tsx']) {
    const src = readFileSync(file, 'utf-8');
    const call = src.slice(src.indexOf('useSyncWatcher({'), src.indexOf('useSyncWatcher({') + 120);
    assert.match(call, /pollIntervalMs: 30000/, file);
  }
});
