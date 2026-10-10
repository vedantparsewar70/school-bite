import { db } from './firebase-admin';

export interface SyncVersions {
  menuVersion: number;
  ordersVersion: number;
  teacherOrdersVersion: number;
  timestamp: number;
}

let inMemoryVersions = {
  menuVersion: Date.now(),
  ordersVersion: Date.now(),
  teacherOrdersVersion: Date.now(),
};

let lastFirestoreFetch = 0;
const FIRESTORE_CACHE_TTL = 1500; // 1.5s cache to avoid excessive Firestore read units

export async function notifyMenuUpdated(): Promise<number> {
  const now = Date.now();
  inMemoryVersions.menuVersion = now;
  try {
    await db.collection('system_sync').doc('latest').set(
      { menuVersion: now, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Sync] Failed to persist menuVersion to Firestore, using memory fallback:', err);
  }
  return now;
}

export async function notifyOrdersUpdated(): Promise<number> {
  const now = Date.now();
  inMemoryVersions.ordersVersion = now;
  try {
    await db.collection('system_sync').doc('latest').set(
      { ordersVersion: now, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Sync] Failed to persist ordersVersion to Firestore, using memory fallback:', err);
  }
  return now;
}

export async function notifyTeacherOrdersUpdated(): Promise<number> {
  const now = Date.now();
  inMemoryVersions.teacherOrdersVersion = now;
  try {
    await db.collection('system_sync').doc('latest').set(
      { teacherOrdersVersion: now, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Sync] Failed to persist teacherOrdersVersion to Firestore, using memory fallback:', err);
  }
  return now;
}

export async function getSyncVersions(): Promise<SyncVersions> {
  const now = Date.now();
  if (now - lastFirestoreFetch > FIRESTORE_CACHE_TTL) {
    lastFirestoreFetch = now;
    try {
      const snap = await db.collection('system_sync').doc('latest').get();
      if (snap.exists) {
        const data = snap.data() || {};
        inMemoryVersions.menuVersion = Math.max(inMemoryVersions.menuVersion, Number(data.menuVersion || 0));
        inMemoryVersions.ordersVersion = Math.max(inMemoryVersions.ordersVersion, Number(data.ordersVersion || 0));
        inMemoryVersions.teacherOrdersVersion = Math.max(
          inMemoryVersions.teacherOrdersVersion,
          Number(data.teacherOrdersVersion || 0)
        );
      }
    } catch {
      // Memory fallback continues safely
    }
  }

  return {
    menuVersion: inMemoryVersions.menuVersion,
    ordersVersion: inMemoryVersions.ordersVersion,
    teacherOrdersVersion: inMemoryVersions.teacherOrdersVersion,
    timestamp: now,
  };
}
