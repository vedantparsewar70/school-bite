import './helpers/isolate-env';
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import prisma from '../lib/prisma';
import { POST as checkout } from '../app/api/parent/orders/route';

/** LOW: checkout shows friendly messages, never raw internal error text. */

let fs: FakeFirestore;
let parent: Record<string, string>;
const original = (prisma.meal as any).findMany;

beforeEach(async () => {
  fs = useFakeFirestore();
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T07:00:00+05:30') });
  parent = await signedInAs(fs, 'PARENT');
  fs.seed('users', 'usr_parent', { ...fs.getDoc('users', 'usr_parent'), phone: '9876543210' });
  fs.seed('students', 'stu_1', { id: 'stu_1', parentId: 'par_usr_parent', name: 'Riya', grade: '3', studentCategory: 'Primary', isActive: true });
});
afterEach(() => {
  (prisma.meal as any).findMany = original;
  mock.timers.reset();
  setFirestoreForTesting(null);
});

const cart = [{ mealId: 'meal_x', mealName: 'Veg Pulao', studentId: 'stu_1', date: '2026-11-18', quantity: 1, price: 70 }];

test('an internal failure returns a friendly message without the raw error text', async () => {
  (prisma.meal as any).findMany = async () => {
    throw new Error('16 UNAUTHENTICATED: secret internal detail');
  };
  const res = await checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: cart, idempotencyKey: 'k-int' }, parent));
  const body = await res.json();
  assert.ok(res.status >= 400);
  assert.ok(!JSON.stringify(body).includes('UNAUTHENTICATED'), JSON.stringify(body));
  assert.ok(!JSON.stringify(body).includes('secret internal detail'));
});

test('the catch-all only passes through messages written for parents', () => {
  const src = readFileSync('app/api/parent/orders/route.ts', 'utf-8');
  const tail = src.slice(src.lastIndexOf("console.error('Error placing order:'"));
  assert.ok(!/error\?\.message/.test(tail.slice(0, 800)), 'no raw error.message to the client');
  assert.match(tail, /error instanceof CheckoutError/);
  assert.match(tail, /We could not place your order just now\. Please try again in a moment\./);
  assert.ok(!src.includes('Meal not found: '));
});
