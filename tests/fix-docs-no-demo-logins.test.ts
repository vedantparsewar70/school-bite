import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Cleanup: docs carry no demo logins, no ₹500 wallet, no seed or Prisma steps. */

test('README and the Firebase guide have no demo accounts or removed tooling', () => {
  for (const f of ['README.md', 'FIREBASE_SETUP_GUIDE.md']) {
    const s = readFileSync(f, 'utf-8');
    for (const bad of ['parent@example.com', 'admin@school.com', 'Parent123', 'Admin123', 'db:seed', 'seed-firestore', 'test-e2e', '₹500', 'file:///']) {
      assert.ok(!s.includes(bad), `${f} mentions ${bad}`);
    }
  }
});
