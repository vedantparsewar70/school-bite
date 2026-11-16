import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { STUDENT_CATEGORIES, type StudentCategory } from './monthly-menu';
import { effectiveMenuEntry, rankMenuEntries, type MenuEntryLike } from './menu-entries';
import { normalizeStudentCategory } from './menu-stock';
import { closedMessage, hasOrdersMessage, menuEntriesFor, orderingClosed, paidOrdersFor, type MenuEntry } from './menu-orders';
import { publishDish } from './menu-publish';
import { invalidateStaticCache } from './firestore-db';
import { isSundayDate, SUNDAY_CLOSED_MESSAGE } from './utils';

/**
 * "Edit for this day": a copy of the dish (new name, price or veg flag) used only on one date for the
 * chosen classes. Other days keep the original. Same rules as Change dish (refused while paid orders
 * exist; not on closed days, holidays or Sundays). Copies are marked dayOnly, so the monthly import
 * never matches them by name and they stay out of the normal dish lists.
 */

type Result = { status: number; body: Record<string, unknown> };

export async function editDishForDay(
  input: {
    date: unknown;
    studentCategory: unknown;
    mealId: unknown;
    name: unknown;
    price: unknown;
    isVegetarian: unknown;
    description?: unknown;
    actorId: string;
  },
  firestore: Firestore = db
): Promise<Result> {
  const { date, studentCategory, mealId, actorId } = input;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { status: 400, body: { error: 'Please choose a valid date.' } };
  if (isSundayDate(date)) return { status: 400, body: { error: SUNDAY_CLOSED_MESSAGE, code: 'SUNDAY_CLOSED' } };
  const classes: StudentCategory[] =
    studentCategory === 'ALL'
      ? [...STUDENT_CATEGORIES]
      : STUDENT_CATEGORIES.includes(normalizeStudentCategory(String(studentCategory || '')) as StudentCategory)
        ? [normalizeStudentCategory(String(studentCategory)) as StudentCategory]
        : [];
  if (classes.length === 0) return { status: 400, body: { error: 'Please choose Pre-primary, Primary, Secondary or all classes.' } };
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 100) return { status: 400, body: { error: 'Please write the dish name (2 to 100 characters).' } };
  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0 || price > 10000) return { status: 400, body: { error: 'Please enter a price above ₹0 (up to ₹10,000).' } };
  if (typeof input.isVegetarian !== 'boolean') return { status: 400, body: { error: 'Veg or non-veg must be chosen.' } };
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 300) : '';
  if (typeof mealId !== 'string' || !mealId) return { status: 400, body: { error: 'Please choose the dish to copy.' } };

  const sourceSnap = await firestore.collection('meals').doc(mealId).get();
  const source = sourceSnap.data();
  if (!sourceSnap.exists || !source?.name) return { status: 404, body: { error: 'That dish is not in the dish list.' } };

  // Checked before anything is written, so a refusal never leaves a stray copy behind.
  const read = (t: any) => t.get();
  const entries = await menuEntriesFor(read, firestore, date);
  for (const cat of classes) {
    if (orderingClosed(entries, date, cat)) return { status: 400, body: { error: closedMessage(entries, date, cat), code: 'ORDERING_CLOSED' } };
    if ((effectiveMenuEntry(entries, date, cat) as MenuEntry | null)?.isHoliday) {
      return { status: 400, body: { error: `${cat}: ${date} is a holiday.`, code: 'HOLIDAY' } };
    }
  }
  const blocked: StudentCategory[] = [];
  let children = 0;
  for (const cat of classes) {
    const live = rankMenuEntries(entries, date, cat) as Array<MenuEntryLike & { id: string }>;
    const n = (await paidOrdersFor(read, firestore, date, live, [cat])).children;
    if (n > 0) {
      blocked.push(cat);
      children += n;
    }
  }
  if (blocked.length) {
    const message = hasOrdersMessage(children);
    return {
      status: 409,
      body: { error: classes.length > 1 ? `${blocked.join(', ')}: ${message}` : message, code: 'HAS_ORDERS', children, blockedCategories: blocked },
    };
  }

  const now = new Date().toISOString();
  const fields = { name, price, isVegetarian: input.isVegetarian, description: description || null, updatedAt: now, updatedBy: actorId };

  // Already a copy for this day, used by exactly these classes: edit it in place.
  const usingSource = STUDENT_CATEGORIES.filter((cat) => (effectiveMenuEntry(entries, date, cat) as MenuEntry | null)?.mealId === mealId);
  if (source.dayOnly === true && source.dayOnlyDate === date && usingSource.length > 0 && usingSource.every((c) => classes.includes(c)) && classes.every((c) => usingSource.includes(c))) {
    await firestore.collection('meals').doc(mealId).set(fields, { merge: true });
    invalidateStaticCache('meals'); // direct write: drop the cached dish list so parents see it now
    try {
      const { notifyMenuUpdated } = await import('./sync-events');
      await notifyMenuUpdated();
    } catch {
      // non-blocking
    }
    return { status: 200, body: { success: true, mealId, message: `${name} saved for ${date}. Other days keep the original dish.` } };
  }

  const copyId = `meal_day_${date.replace(/-/g, '')}_${crypto.randomBytes(4).toString('hex')}`;
  await firestore.collection('meals').doc(copyId).set({
    id: copyId,
    ...fields,
    category: source.category || 'LUNCH',
    allergens: source.allergens || null,
    ingredients: source.ingredients || null,
    dayOnly: true,
    dayOnlyDate: date,
    copyOf: source.copyOf || mealId,
    createdAt: now,
    createdBy: actorId,
  });
  invalidateStaticCache('meals');
  const published = await publishDish({ date, studentCategory: classes.length === 3 ? 'ALL' : classes[0], mealId: copyId, replace: true, actorId }, firestore);
  if (published.status !== 200) {
    await firestore.collection('meals').doc(copyId).delete();
    invalidateStaticCache('meals');
    return published;
  }
  return { status: 200, body: { success: true, mealId: copyId, message: `${name} is on sale for ${classes.length === 3 ? 'all 3 classes' : classes[0]} on ${date}. Other days keep the original dish.` } };
}
