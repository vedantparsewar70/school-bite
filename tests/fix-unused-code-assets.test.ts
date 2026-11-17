import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as allergy from '../lib/allergy';
import * as menuDay from '../lib/menu-day';

/** Cleanup: unused code and duplicate icons removed; small logos use the lighter logo.webp. */

test('unused AllergyWarningModal, checkMealAllergy and firstMenuDay are gone', () => {
  assert.ok(!existsSync('components/AllergyWarningModal.tsx'));
  assert.equal((allergy as any).checkMealAllergy, undefined);
  assert.equal((menuDay as any).firstMenuDay, undefined);
  assert.equal(typeof allergy.evaluateAllergyConflict, 'function', 'the shared conflict check stays');
});

test('one favicon and one apple icon (in app/), not duplicated in public/', () => {
  assert.ok(existsSync('app/favicon.ico') && existsSync('app/apple-icon.png'));
  assert.ok(!existsSync('public/favicon.ico') && !existsSync('public/apple-icon.png'));
  assert.ok(!/PUBLIC_DIR, '(favicon\.ico|apple-icon\.png)'/.test(readFileSync('scripts/generate-assets.ts', 'utf-8')));
});

test('small logos load logo.webp', () => {
  for (const f of ['components/Navbar.tsx', 'components/Footer.tsx', 'app/page.tsx', 'app/not-found.tsx']) {
    const s = readFileSync(f, 'utf-8');
    assert.ok(s.includes('src="/logo.webp"'), f);
    assert.ok(!s.includes('src="/logo.png"'), f);
  }
  assert.ok(existsSync('public/logo.webp'));
});
