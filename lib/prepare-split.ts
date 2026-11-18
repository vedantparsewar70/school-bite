/**
 * Staff Prepare: the per-class split of one dish ("Primary 35 · Secondary 25"), read from the
 * kitchen API's existing `byCategory` data (no extra request, no new logic on the server).
 * Safe for client components.
 */

export type ByCategory = Array<{ category: string; total: number; dishes: Array<{ mealName: string; quantity: number }> }>;

const CLASS_ORDER = ['Pre-primary', 'Primary', 'Secondary'];

/** The classes that ordered this dish, in class order, with their quantities (zeros left out). */
export function dishSplit(mealName: string, byCategory: ByCategory | undefined | null): Array<{ category: string; quantity: number }> {
  const out: Array<{ category: string; quantity: number }> = [];
  for (const group of byCategory || []) {
    const quantity = group.dishes.filter((d) => d.mealName === mealName).reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
    if (quantity > 0) out.push({ category: group.category, quantity });
  }
  const rank = (c: string) => {
    const i = CLASS_ORDER.indexOf(c);
    return i === -1 ? CLASS_ORDER.length : i;
  };
  return out.sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));
}

/** "Primary 35 · Secondary 25" ('' when no class data). */
export const dishSplitLabel = (split: Array<{ category: string; quantity: number }>) =>
  split.map((s) => `${s.category} ${s.quantity}`).join(' · ');
