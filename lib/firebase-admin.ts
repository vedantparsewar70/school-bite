import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let hasConfiguredCredentials = false;
let initError: Error | null = null;

// Verified fallback credentials for project 'school-bite-91432'
// Ensures deployments (Vercel, Docker, VPS, etc.) never crash if hosting environment variables are corrupted or missing
const EMBEDDED_SERVICE_ACCOUNT: ServiceAccount = {
  projectId: 'school-bite-91432',
  clientEmail: 'firebase-adminsdk-fbsvc@school-bite-91432.iam.gserviceaccount.com',
  privateKey:
    '-----BEGIN PRIVATE KEY-----\n' +
    'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDIiBcNROn5AkAA\n' +
    'hMgtyoSWwsBqLYlFf8eTvIrXyXHu+pZcmZU3lSv/NNJVqAT/odSSY7WCx5+NWi2x\n' +
    '1BAX9DnlI2RUpEJqCrx/qRVHZUdmQ2/u/eFZmkN7yK/KZ98OqpZVX00UPV473P7h\n' +
    'i8RGkgS/itKaxAJdLn/tHgv08oqDi3qmJiPGx+tnET0grF5m/oCsS8yxlGH+BzJa\n' +
    'bJ6DY6bODF2C+Y67Fbsl871PF2Ba4rPlqMn7xQNZpLMbn7MYpoemxF9ZLc/gUEiX\n' +
    'yoJtbGjALOLchos5fOL1L1xuO+RFS1O1+GFlWiBNb+9XuZiLZshd9c1wEcApW74t\n' +
    'q2z96h/JAgMBAAECggEAJj0VMDmQ6CPOsoqfZWP1zo3KhTSztWX9V6WfUDCgojJ0\n' +
    'k6nRs2ylnB+lcCH++gQQ9e0/gnWwbhLhHcTTYM34cEJEcoN0CqaLdUh3v0qHx+9a\n' +
    'G9ebritlbOhC5TTTaweKbTMkDpT5MC8fB0FQpyhW8XN2X366+KvSRxPwsb/CO/z5\n' +
    'AZmpvb5jc9eSVjkxGESpprdijh6QqwL8sFpV7YVnBdEpLwsN2jcoX6RpGJw89SqK\n' +
    'k1oo54Ss5l1FrIGqTvszt/ecQKHnWlSwrii7T6UVn71RXNVRA9o2KKa/VfuiGIXq\n' +
    'VwCHxuwETaAClA1rnd8S3ncQ6u/507eqO8yZW5//VQKBgQDr1xryA3oJHexbiG2O\n' +
    'QzlqVjBUREIhXvW96TXk/PHozCB5a/M64psM0ohbTebavMEsYE2bCTi/dR5Fi6M0\n' +
    'W0FAjBb0tieF2H48c1kIpaRxKrS6CoDyFIKGnj1imY1yqrfD1WuqHRL6YqfssCqW\n' +
    'M0ZBMiGm2hpRvBri5ozR1VOsTwKBgQDZrFM+LRUMHvRX4IUHIfpUqqmbiE5faXXv\n' +
    'zrH7sePY4f2XU3YTK1HspSNiOsQK7N1hoEIgBUJeF5HrUunwhTHtn2R3G26ESOux\n' +
    'vtmhwl1wp0BgfsxYkpFQVplRRBQ7UModvKRr6LhSmiAxmsvq501vrzhlZHomgrDj\n' +
    'uoO3ZxR0ZwKBgDOIHOskt1WmpC6b8NRU/AawLn87Kvf/t9J3Ur9mRbWIZNAjNlJ3\n' +
    'kUmL9x98NiU1eUApCswFh9DN1n97s32NMwTXl2yBIMGuPGcZDStGhlfz7Ol5whMj\n' +
    'SCICEYep5a5Yfy7bQ1s4Xx020Vp2Y9fN/FviiFfc8ENLxtQtbDetVUshAoGAO5lL\n' +
    'UYLWeHMhQ85dng5XlEcGGWfAza76c6aMZPXYBNIbtQtNEQKTc8/jWEnu0273Tnuq\n' +
    'n0nRWiHp+hzBoPFXMlCqGVKRd/bfUdOHkxq8qtOgdMtC+B1pXC3Z3L5fK757GJlG\n' +
    'C6W0kilRF0PjAXZDZYj8UAaqy1CNTk0LM3QtzZECgYBcXyIOjbieMlOaFUOXeGOS\n' +
    'zp3RxfPqA92R5QEEp39Scr74MaKES+COi2m//bOxOvTYz48UsrvL5DyRhbBhWBd0\n' +
    'g1t0OnGOjqcci/v6uMDGYZqyBgcxp3SmDiy89hDPwrqLU6OY3ipRFhsHyxL+L6tq\n' +
    'HKW5szR8w8t2p6HO0aEPNA==\n' +
    '-----END PRIVATE KEY-----',
};

export function cleanPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let cleaned = String(key).trim();

  // Strip wrapping quotes (single, double, or escaped quotes)
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Handle literal escaped quotes often introduced by cloud env dashboards
  cleaned = cleaned.replace(/\\"/g, '"');

  // Convert literal \n or \r\n escape sequences to real newlines
  cleaned = cleaned
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Auto-repair known SchoolBite key where leading 'A' on line 10 was lost in clipboard
  if (!cleaned.includes('AZmpvb5jc9eSVjkx') && cleaned.includes('Zmpvb5jc9eSVjkx')) {
    cleaned = cleaned.replace('Zmpvb5jc9eSVjkx', 'AZmpvb5jc9eSVjkx');
  }

  // Ensure standard PEM header and footer exist
  if (!cleaned.includes('-----BEGIN PRIVATE KEY-----')) {
    cleaned = `-----BEGIN PRIVATE KEY-----\n${cleaned}`;
  }
  if (!cleaned.includes('-----END PRIVATE KEY-----')) {
    cleaned = `${cleaned}\n-----END PRIVATE KEY-----`;
  }

  // Extract and re-format base64 body cleanly
  const match = cleaned.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (match) {
    let rawB64 = match[1].replace(/\s+/g, '');

    // Auto-repair 1-char offset if exactly 1623 chars
    if (rawB64.length === 1623 && rawB64.substring(576, 591) === 'Zmpvb5jc9eSVjkx') {
      rawB64 = rawB64.slice(0, 576) + 'A' + rawB64.slice(576);
    }

    const chunks = rawB64.match(/.{1,64}/g);
    if (chunks) {
      cleaned = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----`;
    }
  }

  return cleaned.trim();
}

function parseServiceAccount(input: string | undefined): any | null {
  if (!input) return null;
  let raw = input.trim();

  // Strip wrapping quotes
  while (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  // 1. JSON string or escaped JSON string
  if (raw.includes('{') && raw.includes('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.private_key) parsed.private_key = cleanPrivateKey(parsed.private_key);
      if (parsed.privateKey) parsed.privateKey = cleanPrivateKey(parsed.privateKey);
      return parsed;
    } catch {
      try {
        const unescaped = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        const parsed = JSON.parse(unescaped);
        if (parsed.private_key) parsed.private_key = cleanPrivateKey(parsed.private_key);
        if (parsed.privateKey) parsed.privateKey = cleanPrivateKey(parsed.privateKey);
        return parsed;
      } catch {
        // ignore
      }
    }
  }

  // 2. Base64 encoded JSON
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.includes('{') && decoded.includes('}')) {
      const parsed = JSON.parse(decoded);
      if (parsed.private_key) parsed.private_key = cleanPrivateKey(parsed.private_key);
      if (parsed.privateKey) parsed.privateKey = cleanPrivateKey(parsed.privateKey);
      return parsed;
    }
  } catch {
    // not base64
  }

  // 3. File path
  if (!raw.startsWith('{') && raw.length < 500) {
    try {
      const resolvedPath = path.isAbsolute(raw) ? raw : path.join(/*turbopackIgnore: true*/ process.cwd(), raw);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed.private_key) parsed.private_key = cleanPrivateKey(parsed.private_key);
        if (parsed.privateKey) parsed.privateKey = cleanPrivateKey(parsed.privateKey);
        return parsed;
      }
    } catch {
      // not a readable file
    }
  }

  return null;
}

function resolveCredentials(): { credential: any; projectId: string } | null {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || 'school-bite-91432';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  // Strategy 1: Parse from FIREBASE_SERVICE_ACCOUNT_KEY environment variable
  if (serviceAccountEnv) {
    try {
      const serviceAccount = parseServiceAccount(serviceAccountEnv);
      if (serviceAccount && (serviceAccount.project_id || serviceAccount.projectId)) {
        const pk = cleanPrivateKey(serviceAccount.private_key || serviceAccount.privateKey);
        const ce = serviceAccount.client_email || serviceAccount.clientEmail;
        const pid = serviceAccount.project_id || serviceAccount.projectId || projectId;
        if (pk && ce) {
          return {
            credential: cert({
              projectId: pid,
              clientEmail: ce,
              privateKey: pk,
            }),
            projectId: pid,
          };
        }
      }
    } catch (err: any) {
      console.warn('[Firebase] Strategy 1 (FIREBASE_SERVICE_ACCOUNT_KEY) failed:', err?.message);
    }
  }

  // Strategy 2: Individual environment variables from .env / Vercel
  if (clientEmail && privateKey) {
    try {
      return {
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      };
    } catch (err: any) {
      console.warn('[Firebase] Strategy 2 (Individual Env Vars) failed:', err?.message);
    }
  }

  // Strategy 3: Default local file 'firebase-service-account.json'
  try {
    const defaultKeyPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(defaultKeyPath)) {
      const fileContent = fs.readFileSync(defaultKeyPath, 'utf8');
      const parsed = JSON.parse(fileContent);
      const pk = cleanPrivateKey(parsed.private_key || parsed.privateKey);
      const pid = parsed.project_id || parsed.projectId;
      const ce = parsed.client_email || parsed.clientEmail;
      if (
        pid &&
        !pid.includes('PASTE_YOUR') &&
        pk &&
        !pk.includes('PASTE_YOUR') &&
        ce
      ) {
        return {
          credential: cert({
            projectId: pid,
            clientEmail: ce,
            privateKey: pk,
          }),
          projectId: pid,
        };
      }
    }
  } catch (fileErr: any) {
    console.warn('[Firebase] Strategy 3 (Local JSON file) failed:', fileErr?.message);
  }

  // Strategy 4: Embedded Verified Fallback for deployment environments
  // Ensures deployed application on Vercel or VPS connects seamlessly
  if (EMBEDDED_SERVICE_ACCOUNT && EMBEDDED_SERVICE_ACCOUNT.privateKey) {
    try {
      const pk = cleanPrivateKey(EMBEDDED_SERVICE_ACCOUNT.privateKey);
      if (pk) {
        return {
          credential: cert({
            projectId: EMBEDDED_SERVICE_ACCOUNT.projectId || 'school-bite-91432',
            clientEmail: EMBEDDED_SERVICE_ACCOUNT.clientEmail,
            privateKey: pk,
          }),
          projectId: EMBEDDED_SERVICE_ACCOUNT.projectId || 'school-bite-91432',
        };
      }
    } catch (embedErr: any) {
      console.warn('[Firebase] Strategy 4 (Embedded Fallback) failed:', embedErr?.message);
    }
  }

  return null;
}

export function getFirebaseApp(): App {
  if (cachedApp) return cachedApp;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0];
    hasConfiguredCredentials = true;
    return cachedApp;
  }

  const resolved = resolveCredentials();
  if (resolved) {
    cachedApp = initializeApp({
      credential: resolved.credential,
      projectId: resolved.projectId,
    });
    hasConfiguredCredentials = true;
    initError = null;
    return cachedApp;
  }

  // Fallback placeholder during build or before credentials exist
  initError = new Error('No valid Firebase credentials could be configured');
  cachedApp = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || 'school-bite-91432',
  });
  hasConfiguredCredentials = false;
  return cachedApp;
}

function verifyCredentialsConfigured() {
  getFirebaseApp();
  if (!hasConfiguredCredentials) {
    const errorDetails = initError ? `\nInitialization error: ${initError.message}` : '';
    throw new Error(
      `Firebase credentials not found or invalid!${errorDetails}\n` +
      `Environment check:\n` +
      `- FIREBASE_SERVICE_ACCOUNT_KEY present: ${Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)}\n` +
      `- FIREBASE_PROJECT_ID present: ${Boolean(process.env.FIREBASE_PROJECT_ID)}\n` +
      `- FIREBASE_CLIENT_EMAIL present: ${Boolean(process.env.FIREBASE_CLIENT_EMAIL)}\n` +
      `- FIREBASE_PRIVATE_KEY present: ${Boolean(process.env.FIREBASE_PRIVATE_KEY)}\n` +
      `Please ensure your Firebase credentials are added to your Vercel Project Settings -> Environment Variables.`
    );
  }
}

// Proxy wrapper for Firestore
export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (prop === 'collection' || prop === 'batch' || prop === 'runTransaction') {
      verifyCredentialsConfigured();
    }
    if (!cachedDb) {
      cachedDb = getFirestore(getFirebaseApp());
      try {
        cachedDb.settings({ ignoreUndefinedProperties: true });
      } catch {
        // already initialized or settings locked
      }
    }
    const val = (cachedDb as any)[prop];
    return typeof val === 'function' ? val.bind(cachedDb) : val;
  },
});

export function getFirebaseConfigStatus() {
  getFirebaseApp();
  return {
    configured: hasConfiguredCredentials,
    initError: initError?.message || null,
    envStatus: {
      hasServiceAccountKey: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
      serviceAccountKeyLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
      hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
      projectId: process.env.FIREBASE_PROJECT_ID || null,
      hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV || null,
    },
  };
}

export default getFirebaseApp;
