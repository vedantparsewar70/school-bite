import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getCurrentUser } from '@/lib/auth';
import { getTodayString, isSundayDate } from '@/lib/utils';
import { dayPlan, menuEntriesOn } from '@/lib/serving-day';
import {
  AlreadyServedError,
  applyItemServe,
  itemServedAt,
  itemServedBy,
  orderServiceDates,
  ServiceDateError,
  type ServiceUpdate,
} from '@/lib/service-dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Category used on the Serve screen: the order item's, else the child's, else derived from the class. */
function categoryOf(item: any, student: any): string {
  const stored = item?.studentCategory || student?.studentCategory;
  if (stored) return String(stored);
  const grade = String(student?.grade || '').toLowerCase();
  if (grade.includes('nursery') || grade.includes('kg') || grade.includes('pre')) return 'Pre-primary';
  const n = parseInt(grade, 10);
  return Number.isFinite(n) && n > 5 ? 'Secondary' : 'Primary';
}

/**
 * Why there is no brunch on a date: Sunday, or every menu entry of the date is a holiday. Also the
 * categories with a holiday when others still have brunch (shown as "No brunch for Pre-primary").
 */
async function closedReason(date: string): Promise<{ reason: string | null; categories: Array<{ category: string; reason: string }> }> {
  const entries = await menuEntriesOn(date);
  const categories = dayPlan(entries, date)
    .categories.filter((c) => c.state === 'HOLIDAY')
    .map((c) => ({ category: c.category, reason: c.holidayReason || 'holiday' }));
  return { reason: wholeDayReason(date, entries), categories };
}

function wholeDayReason(date: string, menus: Array<{ isHoliday?: boolean; holidayReason?: string | null }>): string | null {
  if (isSundayDate(date)) return 'No brunch today (Sunday)';
  if (menus.length > 0 && menus.every((m) => m.isHoliday)) {
    const reason = menus.find((m) => m.holidayReason)?.holidayReason;
    return reason ? `No brunch today (${reason})` : 'No brunch today (holiday)';
  }
  return null;
}

/**
 * The Serve list for one date: ONE ROW PER CHILD. Only paid, not cancelled orders, only that date's
 * meals. No prices, payments or parent contact details. A child with several dishes (or orders) on
 * the date is one row; it counts as served once every one of those meals was handed over.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const today = getTodayString();
    const requested = new URL(req.url).searchParams.get('date');
    const date = requested && ISO_DATE.test(requested) ? requested : today;

    const [itemsSnap, closed] = await Promise.all([
      db.collection('orderItems').where('date', '==', date).get(),
      closedReason(date),
    ]);
    const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const orderIds = Array.from(new Set(items.map((it) => String(it.orderId))));
    const studentIds = Array.from(new Set(items.map((it) => String(it.studentId))));
    const [orderSnaps, studentSnaps] = await Promise.all([
      orderIds.length ? db.getAll(...orderIds.map((id) => db.collection('orders').doc(id))) : Promise.resolve([]),
      studentIds.length ? db.getAll(...studentIds.map((id) => db.collection('students').doc(id))) : Promise.resolve([]),
    ]);
    const orders = new Map(orderSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as any]));
    const students = new Map(studentSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as any]));

    type Row = {
      key: string;
      studentId: string;
      studentName: string;
      grade: string;
      division: string;
      rollNo: string;
      studentCategory: string;
      meals: Array<{ orderItemId: string; orderId: string; mealName: string; quantity: number; servedAt: string | null; isExtra: boolean }>;
      hasAllergyAlert: boolean;
      allergens: string | null;
      servedAt: string | null;
      servedBy: string | null;
    };
    const rows = new Map<string, Row>();
    for (const it of items) {
      const order = orders.get(String(it.orderId));
      if (!order || order.paymentStatus !== 'PAID' || order.orderStatus === 'CANCELLED') continue;
      const student = students.get(String(it.studentId)) || {};
      const key = String(it.studentId);
      const row =
        rows.get(key) ||
        ({
          key,
          studentId: key,
          studentName: student.name || 'Student',
          grade: student.grade && student.grade !== '-' ? String(student.grade) : '',
          division: student.division && student.division !== '-' ? String(student.division) : '',
          rollNo: student.rollNo && student.rollNo !== '-' ? String(student.rollNo) : '',
          studentCategory: categoryOf(it, student),
          meals: [],
          hasAllergyAlert: false,
          allergens: null,
          servedAt: null,
          servedBy: null,
        } as Row);
      const servedAt = itemServedAt(order, date, it.id);
      row.meals.push({
        orderItemId: it.id,
        orderId: String(it.orderId),
        mealName: it.mealName || 'Meal',
        quantity: Number(it.quantity || 1),
        servedAt,
        isExtra: it.kind === 'EXTRA',
      });
      if (it.hasAllergyAlert) {
        row.hasAllergyAlert = true;
        const a = it.conflictAllergens || student.allergies || null;
        if (a && !(row.allergens || '').includes(a)) row.allergens = row.allergens ? `${row.allergens}, ${a}` : a;
      }
      if (servedAt) {
        const by = itemServedBy(order, date, it.id);
        if (!row.servedAt || servedAt > row.servedAt) {
          row.servedAt = servedAt;
          row.servedBy = by;
        }
      }
      rows.set(key, row);
    }

    // Meal names that are missing on older order lines come from the meal catalog.
    const missing = Array.from(new Set(Array.from(rows.values()).flatMap((r) => r.meals).filter((m) => m.mealName === 'Meal').map((m) => m.orderItemId)));
    if (missing.length) {
      const mealIds = Array.from(new Set(items.filter((it) => missing.includes(it.id)).map((it) => String(it.mealId))));
      const mealSnaps = await db.getAll(...mealIds.map((id) => db.collection('meals').doc(id)));
      const names = new Map(mealSnaps.filter((s) => s.exists).map((s) => [s.id, String(s.data()?.name || 'Meal')]));
      const byItem = new Map(items.map((it) => [it.id, names.get(String(it.mealId)) || 'Meal']));
      for (const r of rows.values()) for (const m of r.meals) if (m.mealName === 'Meal') m.mealName = byItem.get(m.orderItemId) || 'Meal';
    }

    const list = Array.from(rows.values()).map((r) => {
      // A child is served only when every one of their meals on this date was handed over.
      const allServed = r.meals.every((m) => m.servedAt);
      // Main brunch first, then the extras: one tick serves them all.
      r.meals.sort((a, b) => Number(a.isExtra) - Number(b.isExtra));
      return { ...r, served: allServed, servedAt: allServed ? r.servedAt : null, servedBy: allServed ? r.servedBy : null };
    });
    list.sort((a, b) => a.studentName.localeCompare(b.studentName, 'en', { sensitivity: 'base' }));

    return NextResponse.json({
      date,
      today,
      closedReason: closed.reason,
      // Holidays for some categories only (the whole day is covered by closedReason).
      closedCategories: closed.reason ? [] : closed.categories,
      rows: list,
      totals: { children: list.length, served: list.filter((r) => r.served).length },
    });
  } catch (error) {
    console.error('Error loading serve list:', error);
    return NextResponse.json({ error: 'Could not load the serve list. Please try again.' }, { status: 500 });
  }
}

/**
 * Tick (serve) or undo ONE CHILD's meals on one date: body { date, orderItemIds, action }.
 * Runs in one transaction over the affected orders, so two phones ticking at the same moment stay
 * consistent: the second gets 409 "Already served at HH:MM". Staff can serve and undo only today.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { date, orderItemIds, action } = body as { date?: unknown; orderItemIds?: unknown; action?: unknown };
    if (typeof date !== 'string' || !ISO_DATE.test(date)) {
      return NextResponse.json({ error: 'A valid date is required.' }, { status: 400 });
    }
    if (action !== 'serve' && action !== 'undo') {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
    const ids = Array.isArray(orderItemIds) ? Array.from(new Set(orderItemIds.filter((x): x is string => typeof x === 'string' && x.length > 0))) : [];
    if (ids.length === 0 || ids.length > 20) {
      return NextResponse.json({ error: 'Choose the meals to update.' }, { status: 400 });
    }
    if (user.role === 'STAFF' && date !== getTodayString()) {
      return NextResponse.json(
        { error: action === 'undo' ? 'Only today’s handovers can be undone. Ask an administrator.' : 'Only today’s meals can be served.' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      // --- Reads (all before any write) ---
      const itemSnaps = [];
      for (const id of ids) itemSnaps.push(await transaction.get(db.collection('orderItems').doc(id)));
      const byOrder = new Map<string, string[]>();
      for (const snap of itemSnaps) {
        if (!snap.exists) throw new ServiceDateError('This meal was not found. Please refresh.', 404);
        const it = snap.data() as any;
        if (it.date !== date) throw new ServiceDateError(`This meal is not for ${date}.`, 400);
        const list = byOrder.get(String(it.orderId)) || [];
        list.push(snap.id);
        byOrder.set(String(it.orderId), list);
      }
      const loaded: Array<{ orderId: string; order: any; allItems: Array<{ id: string; date: string }>; requested: string[] }> = [];
      for (const [orderId, requested] of byOrder) {
        const orderSnap = await transaction.get(db.collection('orders').doc(orderId));
        if (!orderSnap.exists) throw new ServiceDateError('This order was not found. Please refresh.', 404);
        const all = await transaction.get(db.collection('orderItems').where('orderId', '==', orderId));
        loaded.push({
          orderId,
          order: orderSnap.data(),
          allItems: all.docs.map((d: any) => ({ id: d.id, date: d.data().date })),
          requested,
        });
      }

      // --- Compute ---
      const updates: Array<{ orderId: string; update: ServiceUpdate }> = [];
      let alreadyServed: AlreadyServedError | null = null;
      for (const l of loaded) {
        const dates = orderServiceDates(l.allItems);
        const dateItemIds = l.allItems.filter((i) => i.date === date).map((i) => i.id);
        try {
          updates.push({ orderId: l.orderId, update: applyItemServe(l.order, dates, date, dateItemIds, l.requested, action, user.id, now) });
        } catch (err) {
          if (err instanceof AlreadyServedError) alreadyServed = alreadyServed || err;
          else throw err;
        }
      }
      // Every requested meal was already served (another phone, or a double tap).
      if (updates.length === 0 && alreadyServed) throw alreadyServed;

      // --- Writes ---
      for (const u of updates) transaction.update(db.collection('orders').doc(u.orderId), { ...u.update });
    });

    try {
      const { notifyOrdersUpdated } = await import('@/lib/sync-events');
      await notifyOrdersUpdated();
    } catch {
      // non-blocking
    }
    return NextResponse.json({ success: true, action, servedAt: action === 'serve' ? now : null });
  } catch (error: any) {
    if (error instanceof AlreadyServedError) {
      return NextResponse.json(
        { error: error.message, code: 'ALREADY_SERVED', servedAt: error.servedAt, servedBy: error.servedBy },
        { status: 409 }
      );
    }
    if (error instanceof ServiceDateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating handover:', error);
    return NextResponse.json({ error: 'Could not save. Check the connection and try again.' }, { status: 500 });
  }
}
