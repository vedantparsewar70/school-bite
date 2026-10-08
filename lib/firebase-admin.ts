import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let hasConfiguredCredentials = false;
let initError: Error | null = null;



function cleanPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let cleaned = key.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim();
}

function parseServiceAccount(input: string | undefined): any | null {
  if (!input) return null;
  let raw = input.trim();

  // Strip wrapping quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }

  // Handle double-escaped JSON (e.g. \"{\\\"project_id\\\": ...}\")
  if (raw.includes('\\"')) {
    try {
      const unescaped = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (unescaped.startsWith('{')) {
        const parsed = JSON.parse(unescaped);
        if (parsed.private_key) parsed.private_key = cleanPrivateKey(parsed.private_key);
        if (parsed.privateKey) parsed.privateKey = cleanPrivateKey(parsed.privateKey);
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  // 1. JSON string
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.private_key) {
        parsed.private_key = cleanPrivateKey(parsed.private_key);
      }
      if (parsed.privateKey) {
        parsed.privateKey = cleanPrivateKey(parsed.privateKey);
      }
      return parsed;
    } catch (e: any) {
      console.warn('[Firebase] JSON parse failed on FIREBASE_SERVICE_ACCOUNT_KEY:', e?.message);
    }
  }

  // 2. Base64 encoded JSON
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.trim().startsWith('{')) {
      const parsed = JSON.parse(decoded);
      if (parsed.private_key) {
        parsed.private_key = cleanPrivateKey(parsed.private_key);
      }
      if (parsed.privateKey) {
        parsed.privateKey = cleanPrivateKey(parsed.privateKey);
      }
      return parsed;
    }
  } catch {
    // not base64
  }

  // 3. File path (only if short and does not look like JSON)
  if (!raw.startsWith('{') && raw.length < 500) {
    try {
      const resolvedPath = path.isAbsolute(raw) ? raw : path.join(/*turbopackIgnore: true*/ process.cwd(), raw);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed.private_key) {
          parsed.private_key = cleanPrivateKey(parsed.private_key);
        }
        if (parsed.privateKey) {
          parsed.privateKey = cleanPrivateKey(parsed.privateKey);
        }
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
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  // Strategy 1: Parse from FIREBASE_SERVICE_ACCOUNT_KEY
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

  // Strategy 2: Individual environment variables
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

  // Fallback placeholder during build or if credentials missing
  initError = new Error('No valid Firebase credentials could be configured');
  cachedApp = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || 'default',
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
