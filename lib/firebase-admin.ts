import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let hasConfiguredCredentials = false;
let initError: Error | null = null;

function cleanPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let cleaned = key.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.replace(/\\n/g, '\n');
}

function parseServiceAccount(input: string | undefined): any | null {
  if (!input) return null;
  let raw = input.trim();

  // Strip wrapping quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }

  // 1. JSON string
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.private_key) {
        parsed.private_key = cleanPrivateKey(parsed.private_key);
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
      return parsed;
    }
  } catch {
    // not base64
  }

  // 3. File path (only if short and does not look like JSON)
  if (!raw.startsWith('{') && raw.length < 500) {
    try {
      const resolvedPath = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed.private_key) {
          parsed.private_key = cleanPrivateKey(parsed.private_key);
        }
        return parsed;
      }
    } catch {
      // not a readable file
    }
  }

  return null;
}

export function getFirebaseApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    hasConfiguredCredentials = true;
    return cachedApp;
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  try {
    // Option 1: Parse from FIREBASE_SERVICE_ACCOUNT_KEY
    const serviceAccount = parseServiceAccount(serviceAccountEnv);
    if (serviceAccount && (serviceAccount.project_id || serviceAccount.projectId)) {
      cachedApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || serviceAccount.projectId || projectId,
      });
      hasConfiguredCredentials = true;
      initError = null;
      return cachedApp;
    }

    // Option 2: Individual environment variables
    if (projectId && clientEmail && privateKey) {
      cachedApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      hasConfiguredCredentials = true;
      initError = null;
      return cachedApp;
    }

    // Option 3: Default local file 'firebase-service-account.json'
    const defaultKeyPath = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(defaultKeyPath)) {
      try {
        const fileContent = fs.readFileSync(defaultKeyPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed.private_key) {
          parsed.private_key = cleanPrivateKey(parsed.private_key);
        }
        if (
          parsed.project_id &&
          !parsed.project_id.includes('PASTE_YOUR') &&
          parsed.private_key &&
          !parsed.private_key.includes('PASTE_YOUR')
        ) {
          cachedApp = initializeApp({
            credential: cert(parsed),
            projectId: parsed.project_id || projectId,
          });
          hasConfiguredCredentials = true;
          initError = null;
          return cachedApp;
        }
      } catch (fileErr: any) {
        console.warn('[Firebase] Error reading default firebase-service-account.json:', fileErr?.message);
      }
    }

    // Fallback placeholder during build or before credentials exist
    cachedApp = initializeApp({
      projectId: projectId || 'demo-school-bite',
    });
    return cachedApp;
  } catch (error: any) {
    initError = error;
    console.error('[Firebase] Error during app initialization:', error);
    cachedApp = initializeApp({
      projectId: projectId || 'demo-school-bite',
    });
    return cachedApp;
  }
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

// Proxy wrapper for Auth
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (!cachedAuth) {
      cachedAuth = getAuth(getFirebaseApp());
    }
    const val = (cachedAuth as any)[prop];
    return typeof val === 'function' ? val.bind(cachedAuth) : val;
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
