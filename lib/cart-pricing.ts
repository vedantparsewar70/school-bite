/**
 * The cart shows the price the server will charge. `/api/parent/cart/validate` returns each
 * line's current `serverPrice`; a price saved in the cart earlier may be out of date.
 */
export type ServerPriceMap = Record<string, number>;

export const cartPriceKey = (mealId: string, date: string) => `${mealId}__${date}`;

/** Current prices from a cart-validate response (lines with no usable price are left out). */
export function serverPricesFrom(items: unknown): ServerPriceMap {
  const map: ServerPriceMap = {};
  if (!Array.isArray(items)) return map;
  for (const it of items as Array<{ mealId?: string; date?: string; serverPrice?: unknown }>) {
    const price = Number(it?.serverPrice);
    if (it?.mealId && it?.date && Number.isFinite(price) && price > 0) map[cartPriceKey(it.mealId, it.date)] = price;
  }
  return map;
}

/** Unit price to display for a cart line: the server's current price when known. */
export function displayUnitPrice(item: { mealId: string; date: string; mealPrice: number }, prices: ServerPriceMap): number {
  return prices[cartPriceKey(item.mealId, item.date)] ?? item.mealPrice;
}

export function displayCartTotal(
  items: Array<{ mealId: string; date: string; mealPrice: number; quantity: number }>,
  prices: ServerPriceMap
): number {
  return items.reduce((sum, it) => sum + displayUnitPrice(it, prices) * it.quantity, 0);
}
