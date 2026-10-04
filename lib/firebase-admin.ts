import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let hasConfiguredCredentials = false;

export function getFirebaseApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    hasConfiguredCredentials = true;
    return cachedApp;
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  try {
    if (serviceAccountEnv) {
      const resolvedPath = path.join(/*turbopackIgnore: true*/ process.cwd(), serviceAccountEnv);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const serviceAccount: ServiceAccount = JSON.parse(fileContent);
        cachedApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.projectId || projectId,
        });
        hasConfiguredCredentials = true;
        return cachedApp;
      }

      try {
        const serviceAccount: ServiceAccount = JSON.parse(serviceAccountEnv);
        cachedApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.projectId || projectId,
        });
        hasConfiguredCredentials = true;
        return cachedApp;
      } catch {
        // Fall through to other checks
      }
    }

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
      return cachedApp;
    }

    const defaultKeyPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(defaultKeyPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(defaultKeyPath, 'utf8'));
      if (
        serviceAccount.project_id &&
        !serviceAccount.project_id.includes('PASTE_YOUR') &&
        serviceAccount.private_key &&
        !serviceAccount.private_key.includes('PASTE_YOUR')
      ) {
        cachedApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        });
        hasConfiguredCredentials = true;
        return cachedApp;
      }
    }

    // Fallback placeholder during build or before credentials exist
    cachedApp = initializeApp({
      projectId: projectId || 'demo-school-bite',
    });
    return cachedApp;
  } catch (error) {
    console.warn('[Firebase] Warning during app initialization:', error);
    cachedApp = initializeApp({
      projectId: projectId || 'demo-school-bite',
    });
    return cachedApp;
  }
}

function verifyCredentialsConfigured() {
  getFirebaseApp();
  if (!hasConfiguredCredentials) {
    throw new Error(
      `Firebase credentials not found!\n` +
      `Please provide your Firebase credentials using one of these options:\n` +
      `1. Save your Firebase Service Account JSON as 'firebase-service-account.json' in the project root folder.\n` +
      `2. Or in '.env', provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.`
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

export default getFirebaseApp;
