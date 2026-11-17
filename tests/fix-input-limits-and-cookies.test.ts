import './helpers/isolate-env';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fake-firestore';
import { jsonRequest, signedInAs, useFakeFirestore } from './helpers/session';
import { setFirestoreForTesting } from '../lib/firebase-admin';
import { hashPassword, TOKEN_COOKIE_NAME } from '../lib/auth';
import { POST as register } from '../app/api/auth/register/route';
import { POST as login } from '../app/api/auth/login/route';
import * as children from '../app/api/parent/children/route';
import { POST as checkout } from '../app/api/parent/orders/route';

/** LOW: new passwords need 8 characters (old ones still work), names/notes have length limits,
 *  and the session cookie is always Secure in production. */

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;
let fs: FakeFirestore;
let ip = 0;

beforeEach(() => {
  fs = useFakeFirestore();
});
afterEach(() => {
  env.NODE_ENV = originalNodeEnv;
  setFirestoreForTesting(null);
});

function post(url: string, body: unknown) {
  return new Request(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ip}` },
    body: JSON.stringify(body),
  });
}
const signup = (password: string, name = 'Asha Rao', email = `p${ip}@example.com`) =>
  register(post('/api/auth/register', { name, email, phone: '9876543210', password, confirmPassword: password }));

test('registration needs a password of at least 8 characters', async () => {
  const short = await signup('abc1234');
  assert.equal(short.status, 400);
  assert.match((await short.json()).error, /at least 8 characters/);
  assert.equal((await signup('abcd1234')).status, 200);
});

test('an existing account with a 6-character password can still sign in', async () => {
  fs.seed('users', 'usr_old', { id: 'usr_old', email: 'old@example.com', name: 'Old', role: 'PARENT', passwordHash: await hashPassword('abc123') });
  const res = await login(post('/api/auth/login', { email: 'old@example.com', password: 'abc123' }));
  assert.equal(res.status, 200);
});

test('names over 80 characters are refused (registration and children)', async () => {
  assert.equal((await signup('abcd1234', 'x'.repeat(81))).status, 400);
  const parent = await signedInAs(fs, 'PARENT');
  const tooLongName = await children.POST(jsonRequest('/api/parent/children', 'POST', { name: 'y'.repeat(81), grade: '3', studentCategory: 'Primary' }, parent));
  assert.equal(tooLongName.status, 400);
  const tooLongNotes = await children.POST(jsonRequest('/api/parent/children', 'POST', { name: 'Riya', grade: '3', studentCategory: 'Primary', notes: 'n'.repeat(301) }, parent));
  assert.equal(tooLongNotes.status, 400);
  assert.equal(fs.list('students').length, 0);
});

test('checkout refuses order notes over 300 characters', async () => {
  const parent = await signedInAs(fs, 'PARENT');
  fs.seed('users', 'usr_parent', { ...fs.getDoc('users', 'usr_parent'), phone: '9876543210' });
  const res = await checkout(jsonRequest('/api/parent/orders', 'POST', { cartItems: [], notes: 'n'.repeat(301), idempotencyKey: 'k1' }, parent));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /at most 300/);
});

test('in production the session cookie is Secure even when the request looks like http', async () => {
  env.NODE_ENV = 'production';
  const res = await signup('abcd1234');
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie') || '';
  assert.match(cookie, new RegExp(`${TOKEN_COOKIE_NAME}=`));
  assert.match(cookie, /;\s*Secure/i);
});
