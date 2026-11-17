import './helpers/isolate-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

/** HIGH 15: Prisma is gone (the app runs on Firestore; lib/prisma.ts is only the Firestore adapter). */

test('no Prisma packages, scripts, schema or build steps', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  assert.equal(pkg.dependencies['@prisma/client'], undefined);
  assert.equal(pkg.dependencies.prisma, undefined);
  assert.equal(pkg.prisma, undefined);
  assert.equal(pkg.scripts.postinstall, undefined);
  assert.equal(pkg.scripts.build, 'next build');
  assert.equal(pkg.scripts['vercel-build'], 'next build');
  assert.deepEqual(Object.keys(pkg.scripts).filter((k) => k.startsWith('db:')), []);
  assert.ok(!existsSync('prisma/schema.prisma'));
  assert.ok(!existsSync('prisma/migrations'));
  assert.ok(!existsSync('prisma/seed.ts'));
  assert.ok(!/prisma/i.test(readFileSync('next.config.ts', 'utf-8')));
  assert.ok(!readFileSync('package-lock.json', 'utf-8').includes('"node_modules/@prisma/client"'));
});
