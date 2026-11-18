import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { effectiveMenuEntry, type MenuEntryLike } from './menu-entries';
import { APP_TIMEZONE, getOffsetDateString, getTodayString, isDeadlinePassed, isSundayDate, nextNonSundayDateString } from './utils';
import { cutoffFor, DEFAULT_ORDERING_CUTOFF } from './ordering-cutoff';
import { loadOrderingCutoff } from './ordering-cutoff-server';

/**
 * Which categories have brunch on a date, and until when parents can still order. Used by the
 * kitchen (Prepare) and Serve screens, and to find the next serving day.
 */

export const SERVING_CATEGORIES = ['Pre-primary', 'Primary', 'Secondary'] as const;
/** Kept for older callers: the code default of the "Ordering closes at" setting. */
export const DEFAULT_ORDERING_DEADLINE = DEFAULT_ORDERING_CUTOFF;

export interface MenuDayEntry extends MenuEntryLike {
  holidayReason?: string | null;
  orderingDeadline?: string | null;
}

export interface CategoryDay {
  category: string;
  /** OPEN: a dish is on sale. HOLIDAY: no brunch for this category. NONE: nothing published. */
  state: 'OPEN' | 'HOLIDAY' | 'NONE';
  holidayReason: string | null;
  deadline: string | null;
}

export interface DayPlan {
  date: string;
  isSunday: boolean;
  categories: CategoryDay[];
  /** True when at least one category has a dish on sale (and it is not a Sunday). */
  isServingDay: boolean;
  /** Orders close at the "Ordering closes at" setting (07:00 unless the admin changed it). */
  deadline: string;
}

const validTime = (t: unknown) => (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, '0') : null);

export function dayPlan(entries: MenuDayEntry[], date: string): DayPlan {
  const isSunday = isSundayDate(date);
  const categories: CategoryDay[] = SERVING_CATEGORIES.map((category) => {
    const entry = effectiveMenuEntry(entries, date, category) as MenuDayEntry | null;
    if (entry?.isHoliday) {
      return { category, state: 'HOLIDAY', holidayReason: entry.holidayReason ? String(entry.holidayReason) : null, deadline: null };
    }
    if (entry && entry.mealId && !isSunday) {
      return { category, state: 'OPEN', holidayReason: null, deadline: cutoffFor(validTime(entry.orderingDeadline)) };
    }
    return { category, state: 'NONE', holidayReason: null, deadline: null };
  });
  const deadlines = categories.map((c) => c.deadline).filter(Boolean) as string[];
  return {
    date,
    isSunday,
    categories,
    isServingDay: !isSunday && categories.some((c) => c.state === 'OPEN'),
    deadline: deadlines.sort().pop() || cutoffFor(null),
  };
}

/**
 * FINAL once ordering has closed for the date (the counts will not change), else OPEN.
 */
export function cutoffState(date: string, deadline: string, now: Date = new Date()): 'FINAL' | 'OPEN' {
  const today = getTodayString(APP_TIMEZONE, now);
  if (date < today) return 'FINAL';
  return isDeadlinePassed(date, deadline, now) ? 'FINAL' : 'OPEN';
}

export async function menuEntriesOn(date: string, firestore: Firestore = db): Promise<MenuDayEntry[]> {
  await loadOrderingCutoff(firestore);
  const snap = await firestore.collection('menus').where('date', '==', date).get();
  return snap.docs.map((d) => ({ ...(d.data() as MenuDayEntry), id: d.id }));
}

/**
 * The next date after today on which any category has a dish on sale: skips Sundays, holidays and
 * dates with nothing published. Looks 30 days ahead; falls back to the next non-Sunday.
 */
export async function nextServingDay(firestore: Firestore = db): Promise<string> {
  const dates = Array.from({ length: 30 }, (_, i) => getOffsetDateString(i + 1, APP_TIMEZONE)).filter((d) => !isSundayDate(d));
  const snap = await firestore.collection('menus').where('date', 'in', dates).get();
  const entries = snap.docs.map((d) => ({ ...(d.data() as MenuDayEntry), id: d.id }));
  for (const date of dates) {
    if (dayPlan(entries.filter((m) => m.date === date), date).isServingDay) return date;
  }
  return nextNonSundayDateString(APP_TIMEZONE);
}
