import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { BRUNCH_PRICES_KEY, normalizeBrunchPrices, normalizeDefaultPortions, type BrunchPrices, type DefaultPortions } from './brunch-prices';

/**
 * Current class brunch prices (read on every use, no cache, so a saved change applies at once on
 * every server). Defaults apply until the document exists; a read failure is an error, never ₹0.
 */
export async function getBrunchPrices(firestore: Firestore = db): Promise<BrunchPrices> {
  const snap = await firestore.collection('systemSettings').doc(BRUNCH_PRICES_KEY).get();
  return normalizeBrunchPrices(snap.exists ? snap.data()?.prices : null);
}

/** Default portions per class for new main menu entries (500 each until someone saves). */
export async function getDefaultPortions(firestore: Firestore = db): Promise<DefaultPortions> {
  const snap = await firestore.collection('systemSettings').doc(BRUNCH_PRICES_KEY).get();
  return normalizeDefaultPortions(snap.exists ? snap.data()?.defaultPortions : null);
}

/** Prices and default portions share one document: each save merges only its own field. */
export async function saveBrunchPrices(prices: BrunchPrices, actorId: string, firestore: Firestore = db): Promise<void> {
  await firestore.collection('systemSettings').doc(BRUNCH_PRICES_KEY).set(
    { key: BRUNCH_PRICES_KEY, prices, updatedAt: new Date().toISOString(), updatedBy: actorId },
    { merge: true }
  );
}

export async function saveDefaultPortions(defaultPortions: DefaultPortions, actorId: string, firestore: Firestore = db): Promise<void> {
  await firestore.collection('systemSettings').doc(BRUNCH_PRICES_KEY).set(
    { key: BRUNCH_PRICES_KEY, defaultPortions, portionsUpdatedAt: new Date().toISOString(), portionsUpdatedBy: actorId },
    { merge: true }
  );
}
