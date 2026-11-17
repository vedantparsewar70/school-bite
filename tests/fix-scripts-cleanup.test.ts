import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

/** Cleanup: only the four kept scripts (plus the two data cleanup tools) remain; test-e2e.ts is gone. */

test('scripts/ holds only the approved tools', () => {
  const allowed = new Set(['backup-db.ts', 'reconcile-refunds.ts', 'verify-firebase.ts', 'generate-assets.ts', 'list-test-data.ts', 'delete-test-data.ts']);
  const extra = readdirSync('scripts').filter((f) => !allowed.has(f));
  assert.deepEqual(extra, []);
  for (const keep of ['backup-db.ts', 'reconcile-refunds.ts', 'verify-firebase.ts', 'generate-assets.ts']) assert.ok(existsSync(`scripts/${keep}`), keep);
  assert.ok(!existsSync('test-e2e.ts'));
});
