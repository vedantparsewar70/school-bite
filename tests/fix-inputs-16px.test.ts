import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** HIGH 13: on phones every text field is at least 16px, so iPhones don't zoom in when it is tapped. */

const PAGES = [
  'app/page.tsx', 'app/contact/page.tsx', 'app/parent/menu/page.tsx', 'app/parent/cart/page.tsx', 'app/parent/payments/page.tsx',
  'app/parent/children/page.tsx', 'app/parent/profile/page.tsx', 'app/teacher/menu/page.tsx', 'app/admin/orders/page.tsx',
  'app/admin/users/page.tsx', 'app/admin/kitchen/page.tsx', 'components/StudentMenuEditor.tsx', 'app/login/page.tsx',
];

test('every input, select and textarea uses text-base on phones (a smaller size only from sm up)', () => {
  for (const file of PAGES) {
    const src = readFileSync(file, 'utf-8');
    const fields = src.match(/<(input|select|textarea)\b[^<]*?className=(\{`|")[^"`]*/g) || [];
    for (const f of fields) {
      if (/type="(checkbox|radio|file|hidden)"/.test(f)) continue;
      const cls = f.slice(f.search(/className=/));
      assert.ok(/(?<![\w:-])text-(base|lg|xl|2xl)\b/.test(cls), `${file}: ${cls.slice(0, 120)}`);
      assert.ok(!/(?<![\w:-])text-(xs|sm|\[1[0-5]px\])(?![\w-])/.test(cls), `${file}: small text on phones: ${cls.slice(0, 120)}`);
    }
  }
});
