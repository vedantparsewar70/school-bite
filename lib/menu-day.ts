import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { applyMonthlyMenu, STUDENT_CATEGORIES, type MonthlyMenuPlan, type StudentCategory } from './monthly-menu';
import { displayMenuEntry, effectiveMenuEntry, rankMenuEntries, type MenuEntryLike } from './menu-entries';
import { normalizeStudentCategory } from './menu-stock';
import {
  closedMessage,
  deadlineFor,
  hasOrdersMessage,
  menuEntriesFor,
  orderingClosed,
  paidOrdersFor,
  splitSharedEntry,
  usesSharedEntry,
  type MenuEntry,
  withLineClasses,
} from './menu-orders';
import { extrasOn, isExtraLine, paidExtrasRefusal, switchOffExtras } from './menu-extras';
import { brunchPriceFor, dishPrice } from './brunch-prices';
import { getBrunchPrices } from './brunch-prices-server';
import { APP_TIMEZONE, getTodayString, isSundayDate, SUNDAY_CLOSED_MESSAGE } from './utils';

/**
 * The Student Menu editor's day actions (holiday, undo holiday, portions) and its read model. Every
 * write follows lib/menu-orders.ts: only paid, not-cancelled orders count; closed days cannot change.
 */

type Result = { status: number; body: Record<string, unknown> };

const validDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

function categoriesOf(studentCategory: unknown): StudentCategory[] {
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

/** "Mark as holiday" for one class or all: the monthly import's holiday rules (refused if ordered). */
export async function markHoliday(
  input: { date: unknown; studentCategory: unknown; reason: unknown; actorId: string },
  firestore: Firestore = db
): Promise<Result> {
  const { date, studentCategory, reason, actorId } = input;
  if (!validDate(date)) return { status: 400, body: { error: 'Please choose a valid date.' } };
  if (isSundayDate(date)) return { status: 400, body: { error: SUNDAY_CLOSED_MESSAGE, code: 'SUNDAY_CLOSED' } };
  const categories = categoriesOf(studentCategory);
  if (categories.length === 0) return { status: 400, body: { error: 'Please choose Pre-primary, Primary, Secondary or all classes.' } };
  const text = typeof reason === 'string' ? reason.trim().replace(/\s+/g, ' ') : '';
  if (text.length < 2 || text.length > 80) return { status: 400, body: { error: 'Please write a short reason (2 to 80 characters).' } };

  const current = await menuEntriesFor((t) => t.get(), firestore, date);
  const closed = categories.find((cat) => orderingClosed(current, date, cat));
  if (closed) return { status: 400, body: { error: closedMessage(current, date, closed), code: 'ORDERING_CLOSED' } };
  if (categories.length < STUDENT_CATEGORIES.length && categories.some((cat) => usesSharedEntry(current, date, cat))) {
    const split = await splitSharedEntry(date, actorId, firestore);
    if (split.status !== 200) return split;
  }

  const cells = Object.fromEntries(
    STUDENT_CATEGORIES.map((cat) => [cat, categories.includes(cat) ? { kind: 'HOLIDAY', reason: text, merged: false } : { kind: 'BLANK' }])
  ) as MonthlyMenuPlan['days'][number]['cells'];
  const plan: MonthlyMenuPlan = { title: null, month: date.slice(0, 7), issues: [], days: [{ row: 0, date, dayLabel: date, weekday: null, cells, errors: [] }] };
  const options = { replaceUnordered: true, actorId, fileName: `manual holiday: ${categories.join(', ')} ${date}` };

  const extrasBlock = await paidExtrasRefusal(date, categories, firestore);
  if (extrasBlock) return extrasBlock;

  const preview = await applyMonthlyMenu(plan, { ...options, dryRun: true }, firestore);
  const outcomes = categories.map((cat) => ({ cat, outcome: preview.days[0].cells[cat].outcome as string }));
  const blocked = outcomes.filter((o) => o.outcome === 'conflict-has-orders').map((o) => o.cat);
  if (blocked.length) return refusal(firestore, date, blocked, categories);
  if (outcomes.some((o) => o.outcome === 'skip-past')) return { status: 400, body: { error: 'This date has already passed.' } };
  if (!outcomes.every((o) => ['create', 'replace', 'unchanged'].includes(o.outcome))) {
    return { status: 409, body: { error: 'This day could not be marked as a holiday. Please refresh and try again.' } };
  }

  const result = await applyMonthlyMenu(plan, options, firestore);
  const final = categories.map((cat) => ({ cat, outcome: result.days[0].cells[cat].outcome as string }));
  const lateBlocked = final.filter((o) => o.outcome === 'conflict-has-orders').map((o) => o.cat);
  if (lateBlocked.length) return refusal(firestore, date, lateBlocked, categories);
  if (!final.every((o) => ['create', 'replace', 'unchanged'].includes(o.outcome))) {
    return { status: 409, body: { error: 'This day changed meanwhile. Please refresh and try again.' } };
  }
  await switchOffExtras(date, categories, actorId, firestore);
  await notify();
  return { status: 200, body: { success: true, message: `${date} is a holiday for ${categories.length === 3 ? 'all classes' : categories.join(', ')}.` } };
}

async function refusal(firestore: Firestore, date: string, blocked: StudentCategory[], requested: StudentCategory[]): Promise<Result> {
  const entries = await menuEntriesFor((t) => t.get(), firestore, date);
  const live = new Map<string, MenuEntryLike & { id: string }>();
  for (const cat of blocked) for (const m of rankMenuEntries(entries, date, cat)) live.set(m.id, m);
  const { children } = await paidOrdersFor((t) => t.get(), firestore, date, Array.from(live.values()), blocked);
  const message = hasOrdersMessage(Math.max(children, 1));
  return {
    status: 409,
    body: { error: requested.length > 1 ? `${blocked.join(', ')}: ${message}` : message, code: 'HAS_ORDERS', children, blockedCategories: blocked },
  };
}

/**
 * "Undo holiday": the class (or all) goes back to "Nothing on sale". Holiday entries are never
 * ordered from, so they are removed; a shared holiday keeps applying to the other classes.
 */
export async function undoHoliday(
  input: { date: unknown; studentCategory: unknown; actorId: string },
  firestore: Firestore = db
): Promise<Result> {
  const { date, studentCategory, actorId } = input;
  if (!validDate(date)) return { status: 400, body: { error: 'Please choose a valid date.' } };
  const categories = categoriesOf(studentCategory);
  if (categories.length === 0) return { status: 400, body: { error: 'Please choose Pre-primary, Primary, Secondary or all classes.' } };
  if (date < getTodayString(APP_TIMEZONE)) return { status: 400, body: { error: 'This date has already passed.' } };

  const current = await menuEntriesFor((t) => t.get(), firestore, date);
  if (categories.length < STUDENT_CATEGORIES.length && categories.some((cat) => usesSharedEntry(current, date, cat))) {
    const split = await splitSharedEntry(date, actorId, firestore);
    if (split.status !== 200) return split;
  }

  const removed = await firestore.runTransaction(async (tx) => {
    const entries = await menuEntriesFor((t) => tx.get(t), firestore, date);
    const ids = new Set<string>();
    for (const cat of categories) {
      for (const m of rankMenuEntries(entries, date, cat)) if (m.isHoliday && (categories.length === 3 || normalizeStudentCategory(m.studentCategory) !== 'ALL')) ids.add(m.id);
    }
    for (const id of ids) tx.delete(firestore.collection('menus').doc(id));
    return ids.size;
  });
  if (removed) await notify();
  return { status: 200, body: { success: true, removed, message: removed ? 'Holiday removed. Nothing is on sale yet.' : 'This day was not a holiday.' } };
}

/**
 * Portions for the class's dish: the total; what is left is the total minus what is already ordered
 * (paid, not cancelled). Never below what is already ordered. Checked and written together, so a
 * payment at the same moment is counted.
 */
export async function setPortions(
  input: { date: unknown; studentCategory: unknown; portions: unknown; actorId: string },
  firestore: Firestore = db
): Promise<Result> {
  const { date, studentCategory, portions, actorId } = input;
  if (!validDate(date)) return { status: 400, body: { error: 'Please choose a valid date.' } };
  const categories = categoriesOf(studentCategory);
  if (categories.length !== 1) return { status: 400, body: { error: 'Please choose Pre-primary, Primary or Secondary.' } };
  const n = Number(portions);
  if (portions === '' || portions === null || !Number.isInteger(n) || n < 0 || n > 10000) {
    return { status: 400, body: { error: 'Portions must be a whole number from 0 to 10000.' } };
  }
  const cat = categories[0];

  return firestore.runTransaction(async (tx): Promise<Result> => {
    const read = (t: any) => tx.get(t);
    const entries = await menuEntriesFor(read, firestore, date);
    if (orderingClosed(entries, date, cat)) return { status: 400, body: { error: closedMessage(entries, date, cat), code: 'ORDERING_CLOSED' } };
    const entry = effectiveMenuEntry(entries, date, cat) as MenuEntry | null;
    if (!entry || entry.isHoliday || entry.isActive === false) {
      return { status: 404, body: { error: `Nothing is on sale for ${cat} on ${date}.` } };
    }
    const shared = normalizeStudentCategory(entry.studentCategory) === 'ALL';
    const { portions: ordered } = await paidOrdersFor(read, firestore, date, [entry], shared ? [...STUDENT_CATEGORIES] : [cat]);
    if (n < ordered) {
      return {
        status: 409,
        body: { error: `${ordered} ${ordered === 1 ? 'portion is' : 'portions are'} already ordered. Portions can't be set lower than that.`, code: 'BELOW_ORDERED', ordered },
      };
    }
    tx.set(
      firestore.collection('menus').doc(entry.id),
      { maxQuantity: n, availableQuantity: n - ordered, updatedAt: new Date().toISOString(), updatedBy: actorId },
      { merge: true }
    );
    return { status: 200, body: { success: true, maxQuantity: n, availableQuantity: n - ordered, ordered } };
  }).then(async (r) => {
    if (r.status === 200) await notify();
    return r;
  });
}

// --- Read model for the editor ---------------------------------------------------------------

export type DayStatus = 'ALL' | 'SOME' | 'NONE' | 'HOLIDAY' | 'SUNDAY';

export interface ClassCard {
  category: StudentCategory;
  state: 'ON_SALE' | 'NOT_ON_SALE' | 'HOLIDAY';
  entryId: string | null;
  mealId: string | null;
  mealName: string | null;
  price: number | null;
  isVegetarian: boolean | null;
  holidayReason: string | null;
  /** Paid, not-cancelled portions and children. */
  ordered: number;
  children: number;
  maxQuantity: number | null;
  availableQuantity: number | null;
  deadline: string;
  /** An older entry shared by all classes (changing one class splits it). */
  shared: boolean;
  /** Other live entries for this class that parents do not see. */
  duplicates: number;
  /** Add / change / holiday / portions allowed (not past, not Sunday, ordering still open). */
  editable: boolean;
  /** Remove allowed (not past, and something is on sale). */
  removable: boolean;
  /** Optional extras on sale for this class and day (lib/menu-extras.ts). */
  extras: ExtraCard[];
}

export interface ExtraCard {
  mealId: string;
  mealName: string;
  price: number | null;
  isVegetarian: boolean | null;
  maxQuantity: number;
  availableQuantity: number;
  ordered: number;
  children: number;
}

export interface MenuDay {
  date: string;
  weekday: string;
  isSunday: boolean;
  isPast: boolean;
  isToday: boolean;
  status: DayStatus;
  classes: ClassCard[];
}

export async function menuDays(from: string, days: number, firestore: Firestore = db, now: Date = new Date()): Promise<MenuDay[]> {
  const today = getTodayString(APP_TIMEZONE, now);
  const start = Date.parse(`${from}T00:00:00Z`);
  const dates = Array.from({ length: days }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));

  const brunchPrices = await getBrunchPrices(firestore);
  const [menuSnap, itemSnap, extras] = await Promise.all([
    firestore.collection('menus').where('date', 'in', dates).get(),
    firestore.collection('orderItems').where('date', 'in', dates).get(),
    extrasOn(dates, firestore),
  ]);
  const entries = menuSnap.docs.map((d) => ({ ...(d.data() as MenuEntry), id: d.id }));
  const items = itemSnap.docs.map((d) => ({ ...(d.data() as any), id: d.id }));
  const orderIds = Array.from(new Set(items.map((it) => String(it.orderId)).filter(Boolean)));
  const mealIds = Array.from(new Set([...entries.map((m) => m.mealId), ...extras.map((e) => e.mealId)].filter(Boolean) as string[]));
  const [orderSnaps, mealSnaps] = await Promise.all([
    orderIds.length ? firestore.getAll(...orderIds.map((id) => firestore.collection('orders').doc(id))) : Promise.resolve([]),
    mealIds.length ? firestore.getAll(...mealIds.map((id) => firestore.collection('meals').doc(id))) : Promise.resolve([]),
  ]);
  const paid = new Set(orderSnaps.filter((o) => o.exists && o.data()?.paymentStatus === 'PAID' && o.data()?.orderStatus !== 'CANCELLED').map((o) => o.id));
  const meals = new Map(mealSnaps.filter((m) => m.exists).map((m) => [m.id, m.data() as any]));
  // Main-dish counts never include extras; extras are counted per extra entry.
  // Older lines without a class count for their child's class only (as in Prepare and Serve).
  const paidItems = await withLineClasses((t) => t.get(), firestore, items.filter((it) => paid.has(String(it.orderId)) && !isExtraLine(it)));
  const paidExtras = items.filter((it) => paid.has(String(it.orderId)) && isExtraLine(it));

  return dates.map((date) => {
    const dayEntries = entries.filter((m) => m.date === date);
    const isSunday = isSundayDate(date);
    const isPast = date < today;
    const classes: ClassCard[] = STUDENT_CATEGORIES.map((category) => {
      // The same entry parents see (and checkout accepts).
      const live = effectiveMenuEntry(dayEntries, date, category) as MenuEntry | null;
      const shown = (live || displayMenuEntry(dayEntries, date, category)) as MenuEntry | null;
      const onSale = Boolean(live && !live.isHoliday && live.isActive !== false && !isSunday);
      const holiday = Boolean(live?.isHoliday);
      const shared = Boolean(live && normalizeStudentCategory(live.studentCategory) === 'ALL');
      const meal = onSale && live?.mealId ? meals.get(live.mealId) : null;
      // Every live entry of this class counts (older duplicate entries too), as Prepare does.
      const classEntries = rankMenuEntries(dayEntries, date, category);
      const classEntryIds = new Map(classEntries.map((m) => [m.id, normalizeStudentCategory(m.studentCategory)]));
      const lines = live
        ? paidItems.filter((it) => {
            const lineCat = normalizeStudentCategory(it.studentCategory);
            if (it.menuId) {
              if (!classEntryIds.has(it.menuId)) return false;
              return classEntryIds.get(it.menuId) !== 'ALL' || lineCat === category || lineCat === 'ALL';
            }
            return it.mealId === live.mealId && (lineCat === category || lineCat === 'ALL');
          })
        : [];
      const closed = orderingClosed(dayEntries, date, category, now);
      return {
        category,
        state: holiday ? 'HOLIDAY' : onSale ? 'ON_SALE' : 'NOT_ON_SALE',
        entryId: live?.id ?? null,
        mealId: onSale ? live!.mealId || null : null,
        mealName: meal?.name ? String(meal.name) : onSale ? 'Dish' : null,
        // Main brunch: the class price (not the dish's), shown whenever a dish is on sale.
        price: onSale ? brunchPriceFor(category, brunchPrices) : null,
        isVegetarian: meal ? meal.isVegetarian !== false : null,
        holidayReason: holiday ? live!.holidayReason || 'Holiday' : null,
        ordered: lines.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0),
        children: new Set(lines.map((it) => String(it.studentId || it.id))).size,
        maxQuantity: onSale && shown && Number.isFinite(Number(shown.maxQuantity)) ? Number(shown.maxQuantity) : null,
        availableQuantity: onSale && shown && Number.isFinite(Number(shown.availableQuantity)) ? Number(shown.availableQuantity) : null,
        deadline: deadlineFor(dayEntries, date, category),
        shared,
        duplicates: Math.max(0, rankMenuEntries(dayEntries, date, category).length - 1),
        editable: !isSunday && !closed,
        removable: !isPast && onSale,
        extras: extras
          .filter((e) => e.date === date && e.isActive !== false && normalizeStudentCategory(e.studentCategory) === category)
          .map((e) => {
            const m = meals.get(e.mealId);
            const lines = paidExtras.filter((it) => it.menuExtraId === e.id);
            return {
              mealId: e.mealId,
              mealName: m?.name ? String(m.name) : 'Extra',
              price: dishPrice(m),
              isVegetarian: m ? m.isVegetarian !== false : null,
              maxQuantity: Number(e.maxQuantity ?? 0),
              availableQuantity: Number(e.availableQuantity ?? 0),
              ordered: lines.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0),
              children: new Set(lines.map((it) => String(it.studentId || it.id))).size,
            };
          })
          .sort((a, b) => a.mealName.localeCompare(b.mealName)),
      };
    });
    const open = classes.filter((c) => c.state !== 'HOLIDAY');
    const onSale = open.filter((c) => c.state === 'ON_SALE').length;
    const status: DayStatus = isSunday
      ? 'SUNDAY'
      : open.length === 0
        ? 'HOLIDAY'
        : onSale === open.length
          ? 'ALL'
          : onSale === 0
            ? 'NONE'
            : 'SOME';
    return {
      date,
      weekday: new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
      isSunday,
      isPast,
      isToday: date === today,
      status,
      classes,
    };
  });
}

export const MENU_DAYS_DEFAULT = 14;
