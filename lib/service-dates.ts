/**
 * Per-date service state for parent orders.
 *
 * One paid order can cover several service dates (one payment, one refund ID). Preparation and
 * handover are tracked per date in `order.serviceDates[date]`, so giving Monday's meal never marks
 * Tuesday's meal as given. The order-level `orderStatus` is derived: it is the least advanced
 * status across the order's dates, so an order is COLLECTED only when every date was handed over.
 *
 * Orders saved before per-date tracking have no `serviceDates`; their order-level status applies
 * to every date (that is what it meant when it was written). No migration is needed: the first
 * per-date write copies that status to every date, then changes only the requested one.
 */

export const SERVICE_STEPS = ['CONFIRMED', 'PREPARING', 'READY', 'COLLECTED'] as const;
export type ServiceStatus = (typeof SERVICE_STEPS)[number];

/** Handover of one child's order item on one date (per-child tracking). */
export interface ItemServeState {
  servedAt: string | null;
  servedBy?: string | null;
  undoneAt?: string | null;
  undoneBy?: string | null;
}

export interface ServiceDateState {
  status: ServiceStatus;
  /** First handover on this date (kept after an undo, for the audit trail and cancellation rules). */
  collectedAt?: string | null;
  collectedBy?: string | null;
  revertedAt?: string | null;
  revertedBy?: string | null;
  updatedAt?: string | null;
  /**
   * Per-child handover, keyed by order item ID. Absent on orders handed over before per-child
   * tracking: then a COLLECTED date means every child on it was served.
   */
  items?: Record<string, ItemServeState> | null;
}

export class ServiceDateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ServiceDateError';
    this.status = status;
  }
}

/** The order fields this module reads (a Firestore order document satisfies it). */
export interface ServiceOrder {
  orderStatus?: string;
  paymentStatus?: string;
  collectedAt?: string | null;
  serviceDates?: Record<string, Partial<ServiceDateState>> | null;
}

export function isServiceStatus(value: unknown): value is ServiceStatus {
  return SERVICE_STEPS.includes(value as ServiceStatus);
}

/** Sorted, distinct service dates of an order's items. */
export function orderServiceDates(items: Array<{ date?: string | null }>): string[] {
  return Array.from(new Set(items.map((it) => it.date).filter((d): d is string => Boolean(d)))).sort();
}

function legacyStatus(order: ServiceOrder): ServiceStatus {
  return isServiceStatus(order.orderStatus) ? order.orderStatus : 'CONFIRMED';
}

/** Status of one service date: CANCELLED for a cancelled order, otherwise the date's own status. */
export function serviceStatusFor(order: ServiceOrder, date: string): ServiceStatus | 'CANCELLED' {
  if (order.orderStatus === 'CANCELLED') return 'CANCELLED';
  const entry = order.serviceDates?.[date];
  return isServiceStatus(entry?.status) ? entry.status : legacyStatus(order);
}

/** Per-date state for every date, filling dates without an entry from the legacy order status. */
export function serviceStatesFor(order: ServiceOrder, dates: string[]): Record<string, ServiceDateState> {
  const states: Record<string, ServiceDateState> = {};
  for (const date of dates) {
    const entry = order.serviceDates?.[date];
    states[date] = entry && isServiceStatus(entry.status) ? { ...entry, status: entry.status } : { status: legacyStatus(order) };
  }
  return states;
}

/** Least advanced status across the dates (COLLECTED only when every date is collected). */
export function overallServiceStatus(states: Record<string, ServiceDateState>): ServiceStatus {
  const indexes = Object.values(states).map((s) => SERVICE_STEPS.indexOf(s.status));
  return indexes.length ? SERVICE_STEPS[Math.min(...indexes)] : 'CONFIRMED';
}

/**
 * The service date a status change applies to. A single-date order may omit it (older screens
 * and scripts do); a multi-date order must name it, so one click can never cover several days.
 */
export function resolveServiceDate(dates: string[], requested: unknown): string {
  if (typeof requested === 'string' && requested) {
    if (!dates.includes(requested)) {
      throw new ServiceDateError(`This order has no meal on ${requested}.`, 400);
    }
    return requested;
  }
  if (dates.length === 1) return dates[0];
  if (dates.length === 0) throw new ServiceDateError('This order has no meals to update.', 400);
  throw new ServiceDateError('This order covers several days. Choose the service date to update.', 400);
}

export interface ServiceUpdate {
  serviceDates: Record<string, ServiceDateState>;
  orderStatus: ServiceStatus;
  collectedAt?: string;
  updatedAt: string;
}

/**
 * Computes the writes for moving one service date to `status`. Pure: the caller reads the order
 * and its items inside a transaction and applies the returned fields.
 * - Only paid, non-cancelled orders move forward (CONFIRMED is the undo and is always allowed).
 * - A date already given cannot be given again (409); a given date can only be reverted to CONFIRMED.
 * - Reverting keeps the original handover time and records who reverted it.
 * - `order.collectedAt` keeps the first handover of any date, so staff can never cancel and refund
 *   an order once any part of it was handed over (see cancelOrderWithRefund).
 */
export function applyServiceStatus(
  order: ServiceOrder,
  dates: string[],
  date: string,
  status: ServiceStatus,
  actorId: string,
  now: string
): ServiceUpdate {
  if (order.orderStatus === 'CANCELLED') {
    throw new ServiceDateError('This order has already been cancelled and cannot be modified.');
  }
  if (status !== 'CONFIRMED' && order.paymentStatus !== 'PAID') {
    throw new ServiceDateError('Cannot mark an unpaid, pending or refunded order as prepared or collected.');
  }

  const states = serviceStatesFor(order, dates);
  const current = states[date];
  if (current.status === 'COLLECTED') {
    if (status === 'COLLECTED') {
      throw new ServiceDateError(`The meal for ${date} has already been marked as given.`, 409);
    }
    if (status !== 'CONFIRMED') {
      throw new ServiceDateError('Collected orders can only be reverted back to active.');
    }
    // Undoing the whole date also undoes every child on it.
    const items = current.items ? mapItems(current.items, (it) => (it.servedAt ? { ...it, servedAt: null, undoneAt: now, undoneBy: actorId } : it)) : null;
    states[date] = { ...current, status, revertedAt: now, revertedBy: actorId, updatedAt: now, ...(items ? { items } : {}) };
  } else if (status === 'COLLECTED') {
    // Giving the whole date serves every child on it that was not served yet.
    const items = current.items ? mapItems(current.items, (it) => (it.servedAt ? it : { ...it, servedAt: now, servedBy: actorId })) : null;
    states[date] = { ...current, status, collectedAt: now, collectedBy: actorId, updatedAt: now, ...(items ? { items } : {}) };
  } else {
    states[date] = { ...current, status, updatedAt: now };
  }

  const update: ServiceUpdate = { serviceDates: states, orderStatus: overallServiceStatus(states), updatedAt: now };
  if (status === 'COLLECTED' && !order.collectedAt) update.collectedAt = now;
  return update;
}

// ---------------------------------------------------------------- Per-child handover

function mapItems(items: Record<string, ItemServeState>, fn: (it: ItemServeState) => ItemServeState): Record<string, ItemServeState> {
  return Object.fromEntries(Object.entries(items).map(([id, it]) => [id, fn(it)]));
}

/**
 * When the child's meal (one order item) was handed over on `date`, or null if not yet.
 * Orders handed over before per-child tracking have no `items` map: a COLLECTED date then means
 * every child on it was served, at the date's handover time.
 */
export function itemServedAt(order: ServiceOrder, date: string, orderItemId: string): string | null {
  if (order.orderStatus === 'CANCELLED') return null;
  const entry = order.serviceDates?.[date];
  if (entry?.items) return entry.items[orderItemId]?.servedAt || null;
  if (serviceStatusFor(order, date) !== 'COLLECTED') return null;
  return entry?.collectedAt || order.collectedAt || LEGACY_SERVED;
}

/** Placeholder time for very old handovers that recorded no time. */
export const LEGACY_SERVED = '1970-01-01T00:00:00.000Z';

/** Who handed the child's meal over (null when unknown or not served). */
export function itemServedBy(order: ServiceOrder, date: string, orderItemId: string): string | null {
  const entry = order.serviceDates?.[date];
  if (entry?.items) return entry.items[orderItemId]?.servedAt ? entry.items[orderItemId]?.servedBy || null : null;
  return itemServedAt(order, date, orderItemId) ? entry?.collectedBy || null : null;
}

/** True when some, but not all, children on a date were handed over. */
export function isPartlyServed(order: ServiceOrder, date: string): boolean {
  const items = order.serviceDates?.[date]?.items;
  if (!items) return false;
  const all = Object.values(items);
  const served = all.filter((it) => it.servedAt).length;
  return served > 0 && served < all.length;
}

/** HH:MM in IST (the canteen's clock), e.g. "11:42". */
export function formatServeTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || iso === LEGACY_SERVED) return 'an earlier time';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** Raised when a child's meal was already handed over; carries when and by whom. */
export class AlreadyServedError extends ServiceDateError {
  servedAt: string;
  servedBy: string | null;
  constructor(servedAt: string, servedBy: string | null) {
    super(`Already served at ${formatServeTime(servedAt)}`, 409);
    this.name = 'AlreadyServedError';
    this.servedAt = servedAt;
    this.servedBy = servedBy;
  }
}

/**
 * Serves or un-serves some children's items of ONE order on ONE date. Pure: the caller reads the
 * order and the order's items inside a transaction and writes the returned fields.
 * - `dateItemIds`: every item of this order on `date`. The first per-child write records all of
 *   them, so undoing one child of an older whole-order handover keeps the others served.
 * - serve: throws AlreadyServedError when every requested item is already served; otherwise serves
 *   the ones that are not yet served.
 * - undo: un-serves the requested items (no change for items that were not served).
 * - The date becomes COLLECTED once every child on it is served; undoing a child of a COLLECTED
 *   date moves it back to CONFIRMED. `collectedAt` on the date and the order keeps the first
 *   handover, so a partly served order can never be cancelled and refunded by staff or parents.
 */
export function applyItemServe(
  order: ServiceOrder,
  dates: string[],
  date: string,
  dateItemIds: string[],
  itemIds: string[],
  action: 'serve' | 'undo',
  actorId: string,
  now: string
): ServiceUpdate {
  if (order.orderStatus === 'CANCELLED') {
    throw new ServiceDateError('This order has been cancelled. Do not hand over this meal.');
  }
  if (order.paymentStatus !== 'PAID') {
    throw new ServiceDateError('This order is not paid. Do not hand over this meal.');
  }
  if (!dates.includes(date)) throw new ServiceDateError(`This order has no meal on ${date}.`, 400);
  for (const id of itemIds) {
    if (!dateItemIds.includes(id)) throw new ServiceDateError(`This meal is not for ${date}.`, 400);
  }

  const states = serviceStatesFor(order, dates);
  const current = states[date];
  const items: Record<string, ItemServeState> = {};
  for (const id of dateItemIds) {
    if (current.items?.[id]) {
      items[id] = { ...current.items[id] };
    } else {
      const servedAt = itemServedAt(order, date, id);
      items[id] = { servedAt, servedBy: servedAt ? current.collectedBy || null : null };
    }
  }

  if (action === 'serve') {
    const pending = itemIds.filter((id) => !items[id].servedAt);
    if (pending.length === 0) {
      const first = itemIds.map((id) => items[id]).sort((a, b) => String(a.servedAt).localeCompare(String(b.servedAt)))[0];
      throw new AlreadyServedError(String(first.servedAt), first.servedBy || null);
    }
    for (const id of pending) items[id] = { ...items[id], servedAt: now, servedBy: actorId };
  } else {
    for (const id of itemIds) {
      if (items[id].servedAt) items[id] = { ...items[id], servedAt: null, undoneAt: now, undoneBy: actorId };
    }
  }

  const allServed = dateItemIds.every((id) => items[id].servedAt);
  const anyServed = dateItemIds.some((id) => items[id].servedAt);
  let next: ServiceDateState = { ...current, items, updatedAt: now };
  if (allServed) {
    next = { ...next, status: 'COLLECTED', collectedAt: current.collectedAt || now, collectedBy: current.collectedBy || actorId };
  } else if (current.status === 'COLLECTED') {
    next = { ...next, status: 'CONFIRMED', revertedAt: now, revertedBy: actorId };
  }
  if (anyServed && !next.collectedAt) next = { ...next, collectedAt: now, collectedBy: actorId };
  states[date] = next;

  const update: ServiceUpdate = { serviceDates: states, orderStatus: overallServiceStatus(states), updatedAt: now };
  if (anyServed && !order.collectedAt) update.collectedAt = now;
  return update;
}
