import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { DEFAULT_ORDERING_CUTOFF, ORDERING_CUTOFF_FIELD, setLoadedOrderingCutoff, validCutoff } from './ordering-cutoff';

const SETTINGS_DOC = 'BRUNCH_PRICES';

/**
 * Reads "Ordering closes at" (missing or invalid -> 07:00) and makes it the cutoff for this request's
 * checks. If the read fails, the cutoff falls back to each menu entry's stored time.
 */
export async function loadOrderingCutoff(firestore: Firestore = db): Promise<string | null> {
  try {
    const snap = await firestore.collection('systemSettings').doc(SETTINGS_DOC).get();
    const value = validCutoff(snap.exists ? snap.data()?.[ORDERING_CUTOFF_FIELD] : null) || DEFAULT_ORDERING_CUTOFF;
    setLoadedOrderingCutoff(value);
    return value;
  } catch {
    setLoadedOrderingCutoff(null);
    return null;
  }
}

/** The saved setting for display/editing (07:00 until saved). Throws if it cannot be read. */
export async function getOrderingCutoff(firestore: Firestore = db): Promise<string> {
  const snap = await firestore.collection('systemSettings').doc(SETTINGS_DOC).get();
  return validCutoff(snap.exists ? snap.data()?.[ORDERING_CUTOFF_FIELD] : null) || DEFAULT_ORDERING_CUTOFF;
}

export async function saveOrderingCutoff(time: string, actorId: string, firestore: Firestore = db): Promise<void> {
  await firestore.collection('systemSettings').doc(SETTINGS_DOC).set(
    { key: SETTINGS_DOC, [ORDERING_CUTOFF_FIELD]: time, cutoffUpdatedAt: new Date().toISOString(), cutoffUpdatedBy: actorId },
    { merge: true }
  );
  setLoadedOrderingCutoff(time);
}

/** For the public policy pages: the saved cutoff, or 07:00 if it cannot be read (e.g. during the build). */
export async function policyCutoffTime(firestore?: Firestore): Promise<string> {
  try {
    return await getOrderingCutoff(firestore);
  } catch {
    return DEFAULT_ORDERING_CUTOFF;
  }
}
