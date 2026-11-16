import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { STUDENT_CATEGORIES, type StudentCategory } from './monthly-menu';
import { effectiveMenuEntry, rankMenuEntries, type MenuEntryLike } from './menu-entries';
import { categoryMenuDocId, normalizeStudentCategory } from './menu-stock';
import { APP_TIMEZONE, getTodayString, isDeadlinePassed } from './utils';

/**
 * Shared rules for changing a day's menu (Student Menu, Admin → Menu, older menu APIs):
 * - only paid, not-cancelled orders count as "already ordered";
 * - once ordering for the day has closed, it can no longer be added to or changed;
 * - an older entry shared by all classes is split into one entry per class (while nobody has
 *   ordered from it), so each class can then be changed on its own.
 */

export type MenuEntry = MenuEntryLike & {
  id: string;
  holidayReason?: string | null;
  orderingDeadline?: string | null;
  maxQuantity?: number;
  availableQuantity?: number;
};

type Reader = (target: any) => Promise<any>;

export const DEFAULT_DEADLINE = '08:30';

export const hasOrdersMessage = (n: number) =>
  `${n} ${n === 1 ? 'child has' : 'children have'} already ordered this. Ask the admin to cancel and refund those orders first.`;

/**
 * Paid, not-cancelled orders for these menu entries on this date: how many children, and how many
 * portions. An order line counts when it was bought from one of the entries, or (older lines without
 * an entry ID) is the same dish for one of the categories. A line with no category is counted.
 */
export async function paidOrdersFor(
  read: Reader,
  firestore: Firestore,
  date: string,
  entries: Array<MenuEntryLike & { id: string }>,
  categories: string[]
): Promise<{ children: number; portions: number }> {
  if (entries.length === 0) return { children: 0, portions: 0 };
  const ids = new Set(entries.map((m) => m.id));
  const mealIds = new Set(entries.map((m) => m.mealId).filter(Boolean) as string[]);
  const cats = new Set(categories.map((c) => normalizeStudentCategory(c)));
  const itemsSnap = await read(firestore.collection('orderItems').where('date', '==', date));
  const lines = (itemsSnap.docs as Array<{ id: string; data: () => any }>)
    .map((d) => ({ ...d.data(), id: d.id }))
    .filter((it: any) => {
      if (it.menuId) return ids.has(String(it.menuId));
      if (!it.mealId || !mealIds.has(String(it.mealId))) return false;
      const itemCat = normalizeStudentCategory(it.studentCategory);
      return itemCat === 'ALL' || cats.has(itemCat);
    });
  const orderIds = Array.from(new Set(lines.map((it: any) => String(it.orderId))));
  const paid = new Set<string>();
  for (const orderId of orderIds) {
    const snap = await read(firestore.collection('orders').doc(orderId));
    const o = snap.exists ? snap.data() : null;
    if (o && o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED') paid.add(orderId);
  }
  const active = lines.filter((it: any) => paid.has(String(it.orderId)));
  return {
    children: new Set(active.map((it: any) => String(it.studentId || it.id))).size,
    portions: active.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0),
  };
}

export async function paidChildrenFor(
  read: Reader,
  firestore: Firestore,
  date: string,
  entries: Array<MenuEntryLike & { id: string }>,
  categories: string[]
): Promise<number> {
  return (await paidOrdersFor(read, firestore, date, entries, categories)).children;
}

/** The ordering deadline that applies to a class on a date (its dish's, or 08:30). */
export function deadlineFor(entries: MenuEntry[], date: string, category: string): string {
  const e = effectiveMenuEntry(entries, date, category) as MenuEntry | null;
  const t = e && !e.isHoliday && typeof e.orderingDeadline === 'string' && /^\d{1,2}:\d{2}$/.test(e.orderingDeadline) ? e.orderingDeadline : null;
  return t ? t.padStart(5, '0') : DEFAULT_DEADLINE;
}

/** Past dates, and today once its ordering deadline has passed, can no longer be changed. */
export function orderingClosed(entries: MenuEntry[], date: string, category: string, now: Date = new Date()): boolean {
  const today = getTodayString(APP_TIMEZONE, now);
  if (date < today) return true;
  if (date > today) return false;
  return isDeadlinePassed(date, deadlineFor(entries, date, category), now);
}

export function closedMessage(entries: MenuEntry[], date: string, category: string): string {
  const today = getTodayString(APP_TIMEZONE);
  return date < today
    ? 'This date has already passed.'
    : `Ordering for today closed at ${deadlineFor(entries, date, category)}, so today's menu can no longer be changed.`;
}

export async function menuEntriesFor(read: Reader, firestore: Firestore, date: string): Promise<MenuEntry[]> {
  const snap = await read(firestore.collection('menus').where('date', '==', date));
  return (snap.docs as Array<{ id: string; data: () => any }>).map((d) => ({ ...(d.data() as MenuEntry), id: d.id }));
}

const isShared = (m: MenuEntryLike | null | undefined) => Boolean(m) && normalizeStudentCategory(m!.studentCategory) === 'ALL';

/**
 * Turns an older entry shared by all classes into one entry per class (same dish or holiday, same
 * deadline and portions), so each class can be changed on its own. Refused while anybody has a paid
 * order from it. Does nothing when the day has no shared entry in use.
 */
export async function splitSharedEntry(
  date: string,
  actorId: string,
  firestore: Firestore = db
): Promise<{ status: number; body: Record<string, unknown> }> {
  return firestore.runTransaction(async (tx) => {
    const read: Reader = (t) => tx.get(t);
    const entries = await menuEntriesFor(read, firestore, date);
    const usedBy = new Map<string, StudentCategory[]>();
    for (const cat of STUDENT_CATEGORIES) {
      const e = rankMenuEntries(entries, date, cat)[0];
      if (e && isShared(e)) usedBy.set(e.id, [...(usedBy.get(e.id) || []), cat]);
    }
    if (usedBy.size === 0) return { status: 200, body: { split: 0 } };

    const shared = entries.filter((m) => usedBy.has(m.id));
    const standard = STUDENT_CATEGORIES.map((c) => entries.find((m) => m.id === categoryMenuDocId(date, c))).filter(Boolean) as MenuEntry[];
    const { children } = await paidOrdersFor(read, firestore, date, [...shared, ...standard], [...STUDENT_CATEGORIES]);
    if (children > 0) {
      return {
        status: 409,
        body: {
          error: `This day's dish is shared by all 3 classes. ${hasOrdersMessage(children)}`,
          code: 'HAS_ORDERS',
          children,
        },
      };
    }

    const now = new Date().toISOString();
    for (const s of shared) {
      for (const cat of usedBy.get(s.id) || []) {
        const id = categoryMenuDocId(date, cat);
        const max = Number.isFinite(Number(s.maxQuantity)) ? Number(s.maxQuantity) : 50;
        tx.set(firestore.collection('menus').doc(id), {
          id,
          date,
          studentCategory: cat,
          mealId: s.mealId || '',
          isHoliday: Boolean(s.isHoliday),
          holidayReason: s.isHoliday ? s.holidayReason || null : null,
          availableQuantity: s.isHoliday ? 0 : max,
          maxQuantity: max,
          orderingDeadline: s.orderingDeadline || DEFAULT_DEADLINE,
          isActive: !s.isHoliday,
          source: 'split-shared',
          splitFrom: s.id,
          createdAt: now,
          updatedAt: now,
          updatedBy: actorId,
        });
      }
      // Retired: no longer live for anyone (a holiday entry is live while it is a holiday).
      tx.set(firestore.collection('menus').doc(s.id), { isActive: false, isHoliday: false, replacedBy: 'split-per-class', updatedAt: now }, { merge: true });
    }
    return { status: 200, body: { split: shared.length } };
  });
}

/** True when the class's current entry for the date is an older entry shared by all classes. */
export function usesSharedEntry(entries: MenuEntry[], date: string, category: string): boolean {
  return isShared(rankMenuEntries(entries, date, category)[0]);
}
