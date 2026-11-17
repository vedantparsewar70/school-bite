import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** LOW: the receipt pop-up's close button stays visible while the receipt scrolls, and is 44px. */

test('the receipt header (with the close button) is sticky and the button is 44px with a label', () => {
  const src = readFileSync('components/OrderReceiptModal.tsx', 'utf-8');
  assert.match(src, /className="sticky top-0 z-10 bg-white[^"]*print:hidden"/);
  assert.match(src, /onClick=\{onClose\}\s+aria-label="Close receipt"\s+className="w-11 h-11/);
});
