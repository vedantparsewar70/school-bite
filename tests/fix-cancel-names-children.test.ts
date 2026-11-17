import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** LOW: the admin cancel confirmation names every child in the order, not just the first. */

test('the confirmation lists all children (deduplicated)', () => {
  const src = readFileSync('app/admin/orders/page.tsx', 'utf-8');
  const helper = src.slice(src.indexOf('const childNamesOf'), src.indexOf('const handleCancelOrder'));
  const body = helper.slice(helper.indexOf('=>') + 2).trim().replace(/;\s*$/, '').replace(/: any/g, '');
  // Evaluate the helper on a two-child order.
  const childNamesOf = new Function('o', `return ${body};`) as (o: any) => string;
  assert.equal(childNamesOf({ items: [{ studentName: 'Riya' }, { studentName: 'Aarav' }, { studentName: 'Riya' }] }), 'Riya, Aarav');
  assert.equal(childNamesOf({ items: [] }), 'this student');
  const handler = src.slice(src.indexOf('const handleCancelOrder'), src.indexOf('const handleResetFilters'));
  assert.match(handler, /Cancel order \$\{o\.id\} for \$\{children\}\?/);
  assert.ok(!handler.includes('items?.[0]?.studentName'));
});
