/**
 * The cart shows the price the server will charge. `/api/parent/cart/validate` returns each
 * line's current `serverPrice`; a price saved in the cart earlier may be out of date.
 *
 * Prices are keyed per child and line type: a main brunch costs the child's class price (two
 * children in different classes can have the same dish on the same day), an extra its dish price.
 */
export type ServerPriceMap = Record<string, number>;

type LineKey = { studentId?: string | null; mealId: string; date: string; kind?: string | null };

export const cartPriceKey = (line: LineKey) =>
  `${line.studentId || ''}__${line.mealId}__${line.date}__${line.kind === 'EXTRA' ? 'EXTRA' : 'MAIN'}`;

/** Current prices from a cart-validate response (lines with no usable price are left out). */
export function serverPricesFrom(items: unknown): ServerPriceMap {
  const map: ServerPriceMap = {};
  if (!Array.isArray(items)) return map;
  for (const it of items as Array<LineKey & { serverPrice?: unknown }>) {
    const price = Number(it?.serverPrice);
    if (it?.mealId && it?.date && Number.isFinite(price) && price > 0) map[cartPriceKey(it)] = price;
  }
  return map;
}

/** Unit price to display for a cart line: the server's current price when known. */
export function displayUnitPrice(item: LineKey & { mealPrice: number }, prices: ServerPriceMap): number {
  return prices[cartPriceKey(item)] ?? item.mealPrice;
}

export function displayCartTotal(items: Array<LineKey & { mealPrice: number; quantity: number }>, prices: ServerPriceMap): number {
  return items.reduce((sum, it) => sum + displayUnitPrice(it, prices) * it.quantity, 0);
}
