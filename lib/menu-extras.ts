import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { invalidateStaticCache } from './firestore-db';
import { STUDENT_CATEGORIES, type StudentCategory } from './monthly-menu';
import { effectiveMenuEntry } from './menu-entries';
import { menuCategorySlug, normalizeStudentCategory } from './menu-stock';
import { closedMessage, deadlineFor, hasOrdersMessage, menuEntriesFor, orderingClosed, type MenuEntry } from './menu-orders';
import { APP_TIMEZONE, getTodayString, isDeadlinePassed, isSundayDate, SUNDAY_CLOSED_MESSAGE } from './utils';
import { dishPrice } from './brunch-prices';

/**
 * EXTRAS: optional add-ons (Banana, Buttermilk…) on top of a class's main brunch for a day.
 *
 * Stored in their own collection `menuExtras` (never in `menus`), so the one-main-dish-per-day rule,
 * the monthly import, holidays and every main-dish check stay exactly as they are; the import never
 * reads or writes extras. An extra entry is one dish for one class on one date:
 *   menuExtras/extra_<date>_<class>_<mealId> { date, studentCategory, mealId, isActive,
 *     maxQuantity, availableQuantity, orderingDeadline, updatedAt, updatedBy }
 * Name, price, veg flag and allergens come from the dish (an extra keeps its dish price; the main
 * brunch is priced by class, lib/brunch-prices.ts). Order lines for an
 * extra carry kind: 'EXTRA' and menuExtraId (menuId null); main lines are unchanged.
 *
 * Rules: an extra is ordered only for a child who has that day's main brunch (same cart or an
 * earlier paid order), at most 3 of each extra per child per day, before the class's main-dish
 * deadline, never on Sundays, holidays or past days. Paid, not-cancelled orders protect it.
 */

export const EXTRA_KIND = 'EXTRA';
export const MAX_EXTRA_PER_CHILD = 3;
export const EXTRAS_COLLECTION = 'menuExtras';

export const isExtraLine = (it: { kind?: unknown } | null | undefined) => it?.kind === EXTRA_KIND;
export const extraDocId = (date: string, category: string, mealId: string) => `extra_${date}_${menuCategorySlug(category)}_${mealId}`;

export interface ExtraEntry {
  id: string;
  date: string;
  studentCategory: string;
  mealId: string;
  isActive?: boolean;
  maxQuantity?: number;
  availableQuantity?: number;
  orderingDeadline?: string;
}

type Result = { status: number; body: Record<string, unknown> };
type Reader = (target: any) => Promise<any>;

const validDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

function classesOf(studentCategory: unknown): StudentCategory[] {
  if (studentCategory === 'ALL') return [...STUDENT_CATEGORIES];
  const c = normalizeStudentCategory(typeof studentCategory === 'string' ? studentCategory : null);
  return STUDENT_CATEGORIES.includes(c as StudentCategory) ? [c as StudentCategory] : [];
}

async function notify() {
  try {
    const { notifyMenuUpdated } = await import('./sync-events');
    await notifyMenuUpdated();
  } catch {
    // non-blocking
  }
}

/** Extras for these dates (single-field `in` queries, at most 30 dates each: no composite index). */
export async function extrasOn(dates: string[], firestore: Firestore = db): Promise<ExtraEntry[]> {
  const unique = Array.from(new Set(dates.filter(Boolean)));
  const out: ExtraEntry[] = [];
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await firestore.collection(EXTRAS_COLLECTION).where('date', 'in', unique.slice(i, i + 30)).get();
    out.push(...snap.docs.map((d) => ({ ...(d.data() as ExtraEntry), id: d.id })));
  }
  return out;
}

/** Paid, not-cancelled order lines on a date (both main and extra lines). */
export async function paidLinesOn(read: Reader, firestore: Firestore, date: string): Promise<any[]> {
  const snap = await read(firestore.collection('orderItems').where('date', '==', date));
  const lines = (snap.docs as Array<{ id: string; data: () => any }>).map((d) => ({ ...d.data(), id: d.id }));
  const orderIds = Array.from(new Set(lines.map((it) => String(it.orderId || '')).filter(Boolean)));
  const paid = new Set<string>();
  for (const id of orderIds) {
    const o = await read(firestore.collection('orders').doc(id));
    const data = o.exists ? o.data() : null;
    if (data && data.paymentStatus === 'PAID' && data.orderStatus !== 'CANCELLED') paid.add(id);
  }
  return lines.filter((it) => paid.has(String(it.orderId)));
}

const extraLinesFor = (lines: any[], ids: Set<string>) => lines.filter((it) => isExtraLine(it) && ids.has(String(it.menuExtraId)));
const summary = (lines: any[]) => ({
  children: new Set(lines.map((it) => String(it.studentId || it.id))).size,
  portions: lines.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0),
});

const extrasMessage = (n: number) =>
  `${n} ${n === 1 ? 'child has' : 'children have'} already ordered extras for this day. Ask the admin to cancel and refund those orders first.`;

// --- Staff actions -----------------------------------------------------------------------------

/** "Add extra" for one class or all 3: needs the class's main dish on sale and ordering still open. */
export async function addExtra(
  input: { date: unknown; studentCategory: unknown; mealId: unknown; portions: unknown; actorId: string },
  firestore: Firestore = db
): Promise<Result> {
  const { date, studentCategory, mealId, portions, actorId } = input;
  if (!validDate(date)) return { status: 400, body: { error: 'Please choose a valid date.' } };
  if (isSundayDate(date)) return { status: 400, body: { error: SUNDAY_CLOSED_MESSAGE, code: 'SUNDAY_CLOSED' } };
  const classes = classesOf(studentCategory);
  if (classes.length === 0) return { status: 400, body: { error: 'Please choose Pre-primary, Primary, Secondary or all classes.' } };
  if (typeof mealId !== 'string' || !mealId) return { status: 400, body: { error: 'Please choose a dish.' } };
  const n = Number(portions);
  if (!Number.isInteger(n) || n < 1 || n > 10000) return { status: 400, body: { error: 'Portions must be a whole number from 1 to 10000.' } };

  const mealSnap = await firestore.collection('meals').doc(mealId).get();
  const meal = mealSnap.data();
  if (!mealSnap.exists || !meal?.name || mealId === 'meal_holiday_no_brunch') return { status: 404, body: { error: 'That dish is not in the dish list.' } };
  // An extra is sold at the dish's own price (the main brunch is priced by class).
  if (dishPrice(meal) === null) return { status: 400, body: { error: `Set ${meal.name}'s extra price first (Dishes → Edit everywhere).`, code: 'NO_EXTRA_PRICE' } };

  const entries = await menuEntriesFor((t) => t.get(), firestore, date);
  for (const cat of classes) {
    if (orderingClosed(entries, date, cat)) return { status: 400, body: { error: closedMessage(entries, date, cat), code: 'ORDERING_CLOSED' } };
    const main = effectiveMenuEntry(entries, date, cat) as MenuEntry | null;
    if (main?.isHoliday) return { status: 400, body: { error: `${cat}: ${date} is a holiday, so extras can't be added.`, code: 'HOLIDAY' } };
    if (!main || main.isActive === false) {
      return { status: 400, body: { error: `${cat}: add the main dish for ${date} first. Extras go with the main brunch.`, code: 'NO_MAIN_DISH' } };
    }
    if (main.mealId === mealId) return { status: 400, body: { error: `${cat}: ${meal.name} is already the main dish for this day.` } };
  }

  const result = await firestore.runTransaction(async (tx): Promise<Result> => {
    const read: Reader = (t) => tx.get(t);
    const ids = classes.map((cat) => extraDocId(date, cat, mealId));
    const snaps: Array<{ exists: boolean; data: () => any }> = [];
    for (const id of ids) snaps.push(await read(firestore.collection(EXTRAS_COLLECTION).doc(id)));
    const lines = await paidLinesOn(read, firestore, date);
    const now = new Date().toISOString();
    classes.forEach((cat, i) => {
      const ordered = summary(extraLinesFor(lines, new Set([ids[i]]))).portions;
      const max = Math.max(n, ordered);
      const prev = snaps[i].exists ? snaps[i].data() : null;
      tx.set(firestore.collection(EXTRAS_COLLECTION).doc(ids[i]), {
        id: ids[i],
        date,
        studentCategory: cat,
        mealId,
        isActive: true,
        maxQuantity: max,
        availableQuantity: max - ordered,
        orderingDeadline: deadlineFor(entries, date, cat),
        createdAt: prev?.createdAt || now,
        updatedAt: now,
        updatedBy: actorId,
      });
    });
    tx.set(firestore.collection('meals').doc(mealId), { isExtra: true }, { merge: true });
    return { status: 200, body: { success: true, message: `${meal.name} added as an extra for ${classes.length === 3 ? 'all 3 classes' : classes[0]} on ${date}.` } };
  });
  if (result.status === 200) {
    invalidateStaticCache('meals'); // the dish is now marked as an extra
    await notify();
  }
  return result;
}

/** "Remove" an extra for one class: refused while anybody has a paid order for it. */
export async function removeExtra(
  input: { date: unknown; studentCategory: unknown; mealId: unknown; actorId: string },
  firestore: Firestore = db
): Promise<Result> {
  const { date, studentCategory, mealId, actorId } = input;
  if (!validDate(date)) return { status: 400, body: { error: 'Please choose a valid date.' } };
  const classes = classesOf(studentCategory);
  if (classes.length !== 1 || typeof mealId !== 'string') return { status: 400, body: { error: 'Please choose one class and one extra.' } };
  if (date < getTodayString(APP_TIMEZONE)) return { status: 400, body: { error: 'This date has already passed.' } };
  const id = extraDocId(date, classes[0], mealId);

  const result = await firestore.runTransaction(async (tx): Promise<Result> => {
    const read: Reader = (t) => tx.get(t);
    const snap = await read(firestore.collection(EXTRAS_COLLECTION).doc(id));
    if (!snap.exists || snap.data()?.isActive === false) return { status: 404, body: { error: 'This extra is not on sale.' } };
    const { children } = summary(extraLinesFor(await paidLinesOn(read, firestore, date), new Set([id])));
    if (children > 0) return { status: 409, body: { error: hasOrdersMessage(children), code: 'HAS_ORDERS', children } };
    tx.set(firestore.collection(EXTRAS_COLLECTION).doc(id), { isActive: false, updatedAt: new Date().toISOString(), updatedBy: actorId }, { merge: true });
    return { status: 200, body: { success: true, message: 'Extra removed. Parents can no longer order it.' } };
  });
  if (result.status === 200) await notify();
  return result;
}

/** Portions for an extra: never below what is already ordered; not once ordering has closed. */
export async function setExtraPortions(
  input: { date: unknown; studentCategory: unknown; mealId: unknown; portions: unknown; actorId: string },
  firestore: Firestore = db
): Promise<Result> {
  const { date, studentCategory, mealId, portions, actorId } = input;
  if (!validDate(date)) return { status: 400, body: { error: 'Please choose a valid date.' } };
  const classes = classesOf(studentCategory);
  if (classes.length !== 1 || typeof mealId !== 'string') return { status: 400, body: { error: 'Please choose one class and one extra.' } };
  const n = Number(portions);
  if (portions === '' || portions === null || !Number.isInteger(n) || n < 0 || n > 10000) {
    return { status: 400, body: { error: 'Portions must be a whole number from 0 to 10000.' } };
  }
  const cat = classes[0];
  const id = extraDocId(date, cat, mealId);

  const result = await firestore.runTransaction(async (tx): Promise<Result> => {
    const read: Reader = (t) => tx.get(t);
    const entries = await menuEntriesFor(read, firestore, date);
    if (orderingClosed(entries, date, cat)) return { status: 400, body: { error: closedMessage(entries, date, cat), code: 'ORDERING_CLOSED' } };
    const snap = await read(firestore.collection(EXTRAS_COLLECTION).doc(id));
    if (!snap.exists || snap.data()?.isActive === false) return { status: 404, body: { error: 'This extra is not on sale.' } };
    const { portions: ordered } = summary(extraLinesFor(await paidLinesOn(read, firestore, date), new Set([id])));
    if (n < ordered) {
      return {
        status: 409,
        body: { error: `${ordered} ${ordered === 1 ? 'portion is' : 'portions are'} already ordered. Portions can't be set lower than that.`, code: 'BELOW_ORDERED' },
      };
    }
    tx.set(firestore.collection(EXTRAS_COLLECTION).doc(id), { maxQuantity: n, availableQuantity: n - ordered, updatedAt: new Date().toISOString(), updatedBy: actorId }, { merge: true });
    return { status: 200, body: { success: true, maxQuantity: n, availableQuantity: n - ordered, ordered } };
  });
  if (result.status === 200) await notify();
  return result;
}

/**
 * Before a holiday or Remove on the main dish: refused while any child has a paid extra for those
 * classes on that day (extras go with the main brunch).
 */
export async function paidExtrasRefusal(date: string, classes: string[], firestore: Firestore = db): Promise<Result | null> {
  const extras = (await extrasOn([date], firestore)).filter((e) => classes.includes(normalizeStudentCategory(e.studentCategory)));
  if (extras.length === 0) return null;
  const lines = extraLinesFor(await paidLinesOn((t) => t.get(), firestore, date), new Set(extras.map((e) => e.id)));
  const { children } = summary(lines);
  return children > 0 ? { status: 409, body: { error: extrasMessage(children), code: 'HAS_ORDERS', children } } : null;
}

/** After a holiday or Remove on the main dish: that day's unordered extras for those classes go off sale. */
export async function switchOffExtras(date: string, classes: string[], actorId: string, firestore: Firestore = db): Promise<number> {
  const extras = (await extrasOn([date], firestore)).filter((e) => e.isActive !== false && classes.includes(normalizeStudentCategory(e.studentCategory)));
  if (extras.length === 0) return 0;
  const batch = firestore.batch();
  const now = new Date().toISOString();
  for (const e of extras) batch.set(firestore.collection(EXTRAS_COLLECTION).doc(e.id), { isActive: false, updatedAt: now, updatedBy: actorId, switchedOffWithMain: true }, { merge: true });
  await batch.commit();
  return extras.length;
}

// --- Checkout ----------------------------------------------------------------------------------

export interface ExtraCheckLine {
  index: number;
  studentId: string;
  date: string;
  mealId: string;
  quantity: number;
  studentCategory: string;
}

/**
 * Why each extra cart line cannot be ordered (null when it can), plus its extra entry ID.
 * `mainLines`: the cart's main-dish lines (studentId + date). `menus`: the dates' menu entries.
 */
export async function checkExtraLines(
  extraLines: ExtraCheckLine[],
  mainLines: Array<{ studentId: string; date: string }>,
  menus: MenuEntry[],
  names: Map<string, string>,
  firestore: Firestore = db,
  now: Date = new Date()
): Promise<Map<number, { reason: string | null; extraId: string; availableQuantity: number; deadlinePassed: boolean }>> {
  const out = new Map<number, { reason: string | null; extraId: string; availableQuantity: number; deadlinePassed: boolean }>();
  if (extraLines.length === 0) return out;
  const dates = Array.from(new Set(extraLines.map((l) => l.date)));
  const extras = new Map((await extrasOn(dates, firestore)).map((e) => [e.id, e]));
  const earlier: any[] = [];
  for (const date of dates) earlier.push(...(await paidLinesOn((t) => t.get(), firestore, date)));

  const hasMain = new Set(mainLines.map((l) => `${l.studentId}|${l.date}`));
  for (const it of earlier) if (!isExtraLine(it)) hasMain.add(`${it.studentId}|${it.date}`);
  const perChild = new Map<string, number>();
  for (const it of earlier) if (isExtraLine(it)) perChild.set(`${it.studentId}|${it.date}|${it.mealId}`, (perChild.get(`${it.studentId}|${it.date}|${it.mealId}`) || 0) + (Number(it.quantity) || 1));
  const requested = new Map<string, number>();

  for (const line of extraLines) {
    const extraId = extraDocId(line.date, line.studentCategory, line.mealId);
    const extra = extras.get(extraId);
    const name = names.get(line.mealId) || 'This extra';
    const available = Number(extra?.availableQuantity ?? 0);
    const dayMenus = menus.filter((m) => m.date === line.date);
    const deadline = deadlineFor(dayMenus, line.date, line.studentCategory);
    const result = (reason: string | null, deadlinePassed = false) => out.set(line.index, { reason, extraId, availableQuantity: available, deadlinePassed });

    if (!extra || extra.isActive === false || extra.date !== line.date) {
      result('This extra is not available for this date/category.');
      continue;
    }
    if (isDeadlinePassed(line.date, deadline, now)) {
      result(`Ordering deadline (${deadline} AM) has passed.`, true);
      continue;
    }
    if (!hasMain.has(`${line.studentId}|${line.date}`)) {
      result(`${name} is an extra: add that day's brunch for this child too.`);
      continue;
    }
    const childKey = `${line.studentId}|${line.date}|${line.mealId}`;
    const already = perChild.get(childKey) || 0;
    if (already + line.quantity > MAX_EXTRA_PER_CHILD) {
      result(
        already > 0
          ? `At most ${MAX_EXTRA_PER_CHILD} ${name} per child per day (${already} already ordered).`
          : `At most ${MAX_EXTRA_PER_CHILD} ${name} per child per day.`
      );
      continue;
    }
    const used = requested.get(extraId) || 0;
    if (available <= 0 || available < used + line.quantity) {
      result(available <= 0 ? 'Sold out for this date.' : `Only ${available} portions remaining.`);
      continue;
    }
    perChild.set(childKey, already + line.quantity);
    requested.set(extraId, used + line.quantity);
    result(null);
  }
  return out;
}
