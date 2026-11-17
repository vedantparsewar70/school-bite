import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { BRUNCH_PRICES_KEY, normalizeBrunchPrices, type BrunchPrices } from './brunch-prices';

/**
 * Current class brunch prices (read on every use, no cache, so a saved change applies at once on
 * every server). Defaults apply until the document exists; a read failure is an error, never ₹0.
 */
export async function getBrunchPrices(firestore: Firestore = db): Promise<BrunchPrices> {
  const snap = await firestore.collection('systemSettings').doc(BRUNCH_PRICES_KEY).get();
  return normalizeBrunchPrices(snap.exists ? snap.data()?.prices : null);
}

export async function saveBrunchPrices(prices: BrunchPrices, actorId: string, firestore: Firestore = db): Promise<void> {
  await firestore.collection('systemSettings').doc(BRUNCH_PRICES_KEY).set({
    key: BRUNCH_PRICES_KEY,
    prices,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}
