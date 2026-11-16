import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { applyMonthlyMenu, dishKey, STUDENT_CATEGORIES, type MonthlyMenuPlan, type StudentCategory } from './monthly-menu';
import { rankMenuEntries, type MenuEntryLike } from './menu-entries';
import { normalizeStudentCategory } from './menu-stock';
import { isSundayDate, SUNDAY_CLOSED_MESSAGE } from './utils';

/**
 * The single way to put a catalog dish on the menu for one date: Staff → Kitchen, Admin → Menu and
 * the older menu API all call this, and it runs the monthly import's rules for that day. So every
 * tool keeps one menu per date and student category:
 * - the recipe's own ID and price are used (no new recipe);
 * - entries created by any tool are checked, not just the standard ID;
 * - an entry with orders is never changed;
 * - a different entry without orders is replaced only when `replace` is true (others are switched
 *   off, never deleted);
 * - an entry shared by all categories is only replaced for all categories at once.
 */
export interface PublishDishInput {
  date: unknown;
  /** One category, or 'ALL' for every category. */
  studentCategory: unknown;
  mealId: unknown;
  replace?: unknown;
  actorId: string;
}

export interface PublishDishResult {
  status: number;
  body: Record<string, unknown>;
}

const CATEGORY_LABEL = (cats: StudentCategory[]) => (cats.length === STUDENT_CATEGORIES.length ? 'all categories' : cats.join(', '));

export async function publishDish(input: PublishDishInput, firestore: Firestore = db): Promise<PublishDishResult> {
  const { date, studentCategory, mealId, replace, actorId } = input;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return { status: 400, body: { error: 'Please choose a valid date.' } };
  }
  if (isSundayDate(date)) {
    return { status: 400, body: { error: SUNDAY_CLOSED_MESSAGE, code: 'SUNDAY_CLOSED' } };
  }
  const categories: StudentCategory[] =
    studentCategory === 'ALL' ? [...STUDENT_CATEGORIES] : STUDENT_CATEGORIES.includes(studentCategory as StudentCategory) ? [studentCategory as StudentCategory] : [];
  if (categories.length === 0) {
    return { status: 400, body: { error: 'Please choose Pre-primary, Primary, Secondary or all categories.' } };
  }
  if (typeof mealId !== 'string' || !mealId) {
    return { status: 400, body: { error: 'Please choose a recipe from the catalog.' } };
  }

  const mealSnap = await firestore.collection('meals').doc(mealId).get();
  const meal = mealSnap.data();
  if (!mealSnap.exists || !meal?.name) {
    return { status: 404, body: { error: 'That recipe is not in the catalog.' } };
  }
  const name = String(meal.name);

  const cells = Object.fromEntries(
    STUDENT_CATEGORIES.map((cat) => [cat, categories.includes(cat) ? { kind: 'MEAL', dish: name, merged: false } : { kind: 'BLANK' }])
  ) as MonthlyMenuPlan['days'][number]['cells'];
  const plan: MonthlyMenuPlan = {
    title: null,
    month: date.slice(0, 7),
    issues: [],
    days: [{ row: 0, date, dayLabel: date, weekday: null, cells, errors: [] }],
  };
  const options = { replaceUnordered: replace === true, actorId, fileName: `manual: ${CATEGORY_LABEL(categories)} ${date}` };

  // Check first: the import matches recipes by name, so it must resolve to exactly this recipe.
  const preview = await applyMonthlyMenu(plan, { ...options, dryRun: true }, firestore);
  const dish = preview.dishes.find((d) => d.key === dishKey(name));
  if (!dish || dish.mealId !== mealId) {
    return { status: 409, body: { error: 'Another catalog recipe has the same name. Rename one of them in the catalog first.' } };
  }
  if (dish.problems.length > 0) {
    return { status: 409, body: { error: `This recipe cannot be published yet: ${dish.problems.join('; ')}.` } };
  }

  const cellsOf = (result: typeof preview) => categories.map((cat) => ({ cat, ...result.days[0].cells[cat] }));
  const planned = cellsOf(preview);
  const where = (outcome: string) => planned.filter((c) => c.outcome === outcome);
  const list = (items: typeof planned) => items.map((c) => `${c.cat}${c.existingMealName ? ` (${c.existingMealName})` : ''}`).join(', ');

  if (where('skip-past').length) return { status: 400, body: { error: 'This date has already passed.' } };
  if (where('conflict-has-orders').length) {
    return {
      status: 409,
      body: { error: `Already ordered, so it cannot be changed: ${list(where('conflict-has-orders'))} on ${date}.`, code: 'HAS_ORDERS' },
    };
  }
  if (where('conflict-shared').length) {
    return {
      status: 409,
      body: {
        error: `${date} has one dish for all categories (${where('conflict-shared')[0].existingMealName}). Publish for all categories to replace it.`,
        code: 'SHARED_ENTRY',
      },
    };
  }
  if (where('conflict-differs').length) {
    const differing = where('conflict-differs');
    return {
      status: 409,
      body: {
        error: `Already on the menu for ${date}: ${list(differing)}. Confirm to replace (no orders yet).`,
        code: 'NEEDS_REPLACE',
        existingMealName: differing[0].existingMealName || null,
      },
    };
  }
  if (planned.every((c) => c.outcome === 'unchanged')) {
    return { status: 200, body: { success: true, outcome: 'unchanged', message: `${name} is already on the menu for ${CATEGORY_LABEL(categories)} on ${date}.` } };
  }
  if (!planned.every((c) => ['create', 'replace', 'unchanged'].includes(c.outcome))) {
    return { status: 400, body: { error: 'This menu could not be updated.' } };
  }

  // The write re-checks everything (an order may have arrived since the check above).
  const result = await applyMonthlyMenu(plan, options, firestore);
  const final = cellsOf(result);
  if (!result.written || !final.every((c) => ['create', 'replace', 'unchanged'].includes(c.outcome))) {
    return { status: 409, body: { error: 'This menu changed meanwhile and was not fully updated. Please refresh and try again.' } };
  }

  try {
    const { notifyMenuUpdated } = await import('./sync-events');
    await notifyMenuUpdated();
  } catch {
    // non-blocking
  }

  const outcome = final.some((c) => c.outcome === 'replace') ? 'replace' : 'create';
  return {
    status: 200,
    body: { success: true, outcome, message: `${name} is now on the menu for ${CATEGORY_LABEL(categories)} on ${date}. Parents can order it.` },
  };
}

/**
 * Children with a paid, active order for these menu entries on this date. An order line counts when
 * it was bought from one of the entries, or (older lines without an entry ID) is the same dish for one
 * of the categories. A line with no category is counted, to be safe.
 */
export async function paidChildrenFor(
  read: (target: any) => Promise<any>,
  firestore: Firestore,
  date: string,
  entries: Array<MenuEntryLike & { id: string }>,
  categories: string[]
): Promise<number> {
  if (entries.length === 0) return 0;
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
  return new Set(lines.filter((it: any) => paid.has(String(it.orderId))).map((it: any) => String(it.studentId || it.id))).size;
}

export const hasOrdersMessage = (n: number) =>
  `${n} ${n === 1 ? 'child has' : 'children have'} already ordered this. Ask the admin to cancel and refund those orders first.`;

/**
 * Takes the dish off sale for one date (one category, or 'ALL'): the live entries are switched off,
 * never deleted, so history stays as it is. Refused while any child has a paid, active order for it
 * (the admin cancels and refunds those first). Checked and written in one transaction, so an order
 * paid at the same moment is never left without a menu. A dish shared by all categories can only be
 * switched off for all categories at once.
 */
export async function withdrawDish(
  input: { date: unknown; studentCategory: unknown; actorId: string },
  firestore: Firestore = db
): Promise<PublishDishResult> {
  const { date, studentCategory, actorId } = input;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: 400, body: { error: 'Please choose a valid date.' } };
  }
  const all = studentCategory === 'ALL';
  const categories: StudentCategory[] = all
    ? [...STUDENT_CATEGORIES]
    : STUDENT_CATEGORIES.includes(studentCategory as StudentCategory) ? [studentCategory as StudentCategory] : [];
  if (categories.length === 0) {
    return { status: 400, body: { error: 'Please choose Pre-primary, Primary, Secondary or all categories.' } };
  }

  const result = await firestore.runTransaction(async (tx): Promise<PublishDishResult & { switchedOff?: number }> => {
    const read = (target: any) => tx.get(target);
    const snap = await read(firestore.collection('menus').where('date', '==', date));
    const entries = (snap.docs as Array<{ id: string; data: () => any }>).map((d) => ({ ...(d.data() as MenuEntryLike), id: d.id }));
    const toSwitchOff = new Map<string, MenuEntryLike & { id: string }>();
    for (const cat of categories) {
      for (const m of rankMenuEntries(entries, date, cat)) {
        if (m.isHoliday) continue;
        if (!all && normalizeStudentCategory(m.studentCategory) === 'ALL') {
          return {
            status: 409,
            body: { error: `${date} has one dish for all categories. It can only be unpublished for all categories at once.`, code: 'SHARED_ENTRY' },
          };
        }
        toSwitchOff.set(m.id, m);
      }
    }
    if (toSwitchOff.size === 0) return { status: 200, body: {}, switchedOff: 0 };

    const children = await paidChildrenFor(read, firestore, date, Array.from(toSwitchOff.values()), categories);
    if (children > 0) {
      return { status: 409, body: { error: hasOrdersMessage(children), code: 'HAS_ORDERS', children } };
    }

    const now = new Date().toISOString();
    for (const id of toSwitchOff.keys()) {
      tx.set(firestore.collection('menus').doc(id), { isActive: false, updatedAt: now, withdrawnBy: actorId, withdrawnAt: now }, { merge: true });
    }
    return { status: 200, body: {}, switchedOff: toSwitchOff.size };
  });
  if (result.status !== 200) return { status: result.status, body: result.body };

  if (result.switchedOff) {
    try {
      const { notifyMenuUpdated } = await import('./sync-events');
      await notifyMenuUpdated();
    } catch {
      // non-blocking
    }
  }
  return {
    status: 200,
    body: {
      success: true,
      outcome: 'withdrawn',
      withdrawn: result.switchedOff || 0,
      message: result.switchedOff
        ? `Menu for ${CATEGORY_LABEL(categories)} on ${date} is no longer on sale.`
        : `Nothing was on sale for ${CATEGORY_LABEL(categories)} on ${date}.`,
    },
  };
}

/** The menu entries now in effect for the date and categories (to apply quantity/deadline edits). */
export async function effectiveEntries(date: string, studentCategory: unknown, firestore: Firestore = db) {
  const categories = studentCategory === 'ALL' || !studentCategory ? [...STUDENT_CATEGORIES] : [studentCategory as StudentCategory];
  const snap = await firestore.collection('menus').where('date', '==', date).get();
  const entries = snap.docs.map((d) => ({ ...(d.data() as MenuEntryLike), id: d.id }));
  const ids = new Set<string>();
  for (const cat of categories) {
    const entry = rankMenuEntries(entries, date, cat)[0];
    if (entry && !entry.isHoliday) ids.add(entry.id);
  }
  return Array.from(ids);
}
