import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Cleanup: the unused /api/admin/menus/publish route is gone; nothing in the app calls it. */

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

test('route deleted and not referenced by app, components or lib', () => {
  assert.ok(!existsSync('app/api/admin/menus/publish'));
  for (const f of [...files('app'), ...files('components'), ...files('lib')]) {
    assert.ok(!readFileSync(f, 'utf-8').includes('menus/publish'), f);
  }
  assert.ok(existsSync('app/api/admin/settings/route.ts'), '/api/admin/settings is kept');
});
