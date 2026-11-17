import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** LOW: footer links, the navbar logo and the menu button are at least 44px tall (easy to tap). */

test('every footer link is at least 44px tall', () => {
  const src = readFileSync('components/Footer.tsx', 'utf-8');
  const links = src.match(/<(Link|a)\b[^>]*className="[^"]*"/g) || [];
  assert.ok(links.length >= 15);
  for (const l of links) assert.match(l, /min-h-\[44px\]/, l);
});

test('navbar logo link and the phone menu button are 44px', () => {
  const src = readFileSync('components/Navbar.tsx', 'utf-8');
  assert.match(src, /className="flex items-center gap-2\.5 group min-h-\[44px\]"/);
  assert.match(src, /className="w-11 h-11 rounded-xl object-contain/);
  assert.match(src, /aria-expanded=\{mobileMenuOpen\}\s+className="w-11 h-11 flex/);
});
