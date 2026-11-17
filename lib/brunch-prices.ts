/**
 * MAIN BRUNCH price by class (not by dish). Extras and the teacher menu keep their own dish prices.
 *
 * The three class prices are stored in systemSettings/BRUNCH_PRICES (lib/brunch-prices-server.ts)
 * and edited by admin and staff on the Student Menu page. Until someone first saves, the defaults
 * below apply. A missing or invalid stored price falls back to its default, so a bad value can never
 * charge ₹0. Changes apply to new orders only: an order saves the unit price it was bought at.
 *
 * Safe for client components: no server imports.
 */
import { STUDENT_CATEGORIES, type StudentCategory } from './student-category';

export type BrunchPrices = Record<StudentCategory, number>;

export const BRUNCH_PRICES_KEY = 'BRUNCH_PRICES';
export const DEFAULT_BRUNCH_PRICES: BrunchPrices = { 'Pre-primary': 60, Primary: 75, Secondary: 90 };
export const MAX_BRUNCH_PRICE = 500;

export const isValidBrunchPrice = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_BRUNCH_PRICE;

/** Stored value -> usable prices; each class falls back to its default when missing or invalid. */
export function normalizeBrunchPrices(stored: unknown): BrunchPrices {
  const src = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const out = { ...DEFAULT_BRUNCH_PRICES };
  for (const c of STUDENT_CATEGORIES) if (isValidBrunchPrice(src[c])) out[c] = src[c] as number;
  return out;
}

/** Validates new prices from the form/API: all three classes, whole rupees, 1 to MAX_BRUNCH_PRICE. */
export function validateBrunchPrices(input: unknown): { ok: true; prices: BrunchPrices } | { ok: false; error: string } {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : null;
  if (!src) return { ok: false, error: 'Please enter a price for each class.' };
  const prices = {} as BrunchPrices;
  for (const c of STUDENT_CATEGORIES) {
    const raw = src[c];
    const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim()) : raw;
    if (!isValidBrunchPrice(n)) {
      return { ok: false, error: `${c}: enter a whole number of rupees from ₹1 to ₹${MAX_BRUNCH_PRICE}.` };
    }
    prices[c] = n;
  }
  return { ok: true, prices };
}

/** Price of one main brunch for a class ('ALL' or unknown -> null; callers pass the child's class). */
export function brunchPriceFor(category: string | null | undefined, prices: BrunchPrices): number | null {
  return STUDENT_CATEGORIES.includes(category as StudentCategory) ? prices[category as StudentCategory] : null;
}

/** A dish's own price (used for extras), or null when it has none. */
export function dishPrice(meal: { price?: unknown } | null | undefined): number | null {
  const p = Number(meal?.price);
  return meal?.price !== null && meal?.price !== undefined && meal?.price !== '' && Number.isFinite(p) && p > 0 ? p : null;
}

/**
 * Unit price of an order line: an EXTRA line costs the dish's price; a main brunch line costs its
 * class price (the class must come from the child's record on the server). Null = cannot be priced.
 */
export function mainOrExtraPrice(
  line: { kind?: unknown; studentCategory?: string | null },
  meal: { price?: unknown } | null | undefined,
  prices: BrunchPrices
): number | null {
  return line.kind === 'EXTRA' ? dishPrice(meal) : brunchPriceFor(line.studentCategory, prices);
}

/** "Secondary: ₹90 → ₹900" lines for the classes whose price changes. */
export function priceChanges(oldPrices: BrunchPrices, newPrices: BrunchPrices): string[] {
  return STUDENT_CATEGORIES.filter((c) => oldPrices[c] !== newPrices[c]).map((c) => `${c}: ₹${oldPrices[c]} → ₹${newPrices[c]}`);
}
