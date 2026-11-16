import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

import { getStudentCategory } from '@/lib/october-2026-timetable';
import { effectiveEntries, hasOrdersMessage, paidChildrenFor, publishDish, withdrawDish } from '@/lib/menu-publish';
import { normalizeStudentCategory } from '@/lib/menu-stock';
import { STUDENT_CATEGORIES } from '@/lib/monthly-menu';

/**
 * Portion edits on an existing entry follow the Student Menu rules: not once ordering for the day
 * has closed, and the total never below what is already ordered (paid, not cancelled).
 */
async function portionEditRefusal(id: string, maxQuantity: unknown): Promise<NextResponse | null> {
  const { db } = await import('@/lib/firebase-admin');
  const { menuEntriesFor, orderingClosed, closedMessage, paidOrdersFor } = await import('@/lib/menu-orders');
  const snap = await db.collection('menus').doc(id).get();
  const entry = snap.exists ? (snap.data() as any) : null;
  if (!entry?.date) return null;
  const entries = await menuEntriesFor((t) => t.get(), db, String(entry.date));
  const cat = normalizeStudentCategory(entry.studentCategory);
  const cats = cat === 'ALL' ? [...STUDENT_CATEGORIES] : [cat];
  const closedCat = cats.find((c) => orderingClosed(entries, String(entry.date), c));
  if (closedCat) {
    return NextResponse.json({ error: closedMessage(entries, String(entry.date), closedCat), code: 'ORDERING_CLOSED' }, { status: 400 });
  }
  if (maxQuantity !== undefined) {
    const { portions } = await paidOrdersFor((t) => t.get(), db, String(entry.date), [{ ...entry, id: snap.id }], cats);
    if (Number(maxQuantity) < portions) {
      return NextResponse.json(
        { error: `${portions} ${portions === 1 ? 'portion is' : 'portions are'} already ordered. Portions can't be set lower than that.`, code: 'BELOW_ORDERED' },
        { status: 409 }
      );
    }
  }
  return null;
}

/** Portions must be whole numbers from 0 to 10,000; anything else is rejected, never stored as NaN. */
function invalidQuantity(...values: unknown[]): boolean {
  return values.some((v) => {
    if (v === undefined || v === null) return false;
    const n = Number(v);
    return v === '' || !Number.isInteger(n) || n < 0 || n > 10000;
  });
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const category = searchParams.get('category') || searchParams.get('studentCategory');

    let whereClause: any = date ? { date } : {};
    if (category && category !== 'ALL') {
      const normalizedCat = getStudentCategory(undefined, category);
      whereClause.studentCategory = { in: [normalizedCat, category, 'ALL'] };
    }

    const menus = await prisma.menu.findMany({
      where: whereClause,
      include: { meal: true },
      orderBy: [{ date: 'desc' }, { meal: { name: 'asc' } }],
    });

    return NextResponse.json({ menus });
  } catch (error) {
    console.error('Error fetching admin menus:', error);
    return NextResponse.json({ error: 'Failed to fetch menus' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }

    const body = await req.json();
    const { mealId, date, availableQuantity, maxQuantity, orderingDeadline = '08:30' } = body;

    if (!mealId || !date) {
      return NextResponse.json({ error: 'Meal ID and date are required' }, { status: 400 });
    }
    if (invalidQuantity(availableQuantity, maxQuantity)) {
      return NextResponse.json({ error: 'Quantity must be a whole number between 0 and 10000' }, { status: 400 });
    }

    // Same rules as every other menu tool: one dish per date and category (lib/menu-publish.ts).
    // Re-scheduling a dish that is already on the menu keeps its entry and remaining stock unless a
    // quantity is explicitly supplied.
    const target = body.studentCategory || body.category;
    const cat = !target || target === 'ALL' ? 'ALL' : getStudentCategory(undefined, String(target));
    const published = await publishDish({ date, studentCategory: cat, mealId, replace: body.replace, actorId: user.id });
    if (published.status !== 200) return NextResponse.json(published.body, { status: published.status });

    const entryIds = await effectiveEntries(date, cat);
    const edits = {
      ...(availableQuantity !== undefined ? { availableQuantity: Number(availableQuantity) } : {}),
      ...(maxQuantity !== undefined ? { maxQuantity: Number(maxQuantity) } : {}),
      ...(body.orderingDeadline !== undefined ? { orderingDeadline: orderingDeadline || '08:30' } : {}),
    };
    let menu = null;
    if (availableQuantity !== undefined || maxQuantity !== undefined) {
      for (const id of entryIds) {
        const refused = await portionEditRefusal(id, maxQuantity);
        if (refused) return refused;
      }
    }
    for (const id of entryIds) {
      menu = Object.keys(edits).length
        ? await prisma.menu.update({ where: { id }, data: edits, include: { meal: true } })
        : await prisma.menu.findUnique({ where: { id }, include: { meal: true } });
    }

    return NextResponse.json({ success: true, menu }, { status: 201 });
  } catch (error) {
    console.error('Error scheduling menu:', error);
    return NextResponse.json({ error: 'Failed to schedule meal' }, { status: 500 });
  }
}

/** Older batch publish (PATCH, and PUT with selectedMealIds): one dish for all categories, or none. */
async function handleBatchPublish(date: string, selectedMealIds: string[], actorId: string, replace?: unknown) {
  const mealIds = Array.from(new Set(selectedMealIds.filter((id) => typeof id === 'string' && id)));
  if (mealIds.length > 1) {
    return NextResponse.json(
      { error: 'Each class category has one dish per day. Select exactly one dish to publish.', code: 'ONE_DISH_PER_DAY' },
      { status: 400 }
    );
  }
  const result =
    mealIds.length === 1
      ? await publishDish({ date, studentCategory: 'ALL', mealId: mealIds[0], replace, actorId })
      : await withdrawDish({ date, studentCategory: 'ALL', actorId });
  if (result.status !== 200) return NextResponse.json(result.body, { status: result.status });

  try {
    const { recordMenuPublication } = await import('@/lib/menu-schedule');
    await recordMenuPublication(date, mealIds);
  } catch (e) {
    console.error('Failed to record publication in handleBatchPublish:', e instanceof Error ? e.name : e);
  }

  const updatedMenus = await prisma.menu.findMany({
    where: { date },
    include: { meal: true },
  });
  return NextResponse.json({ ...result.body, menus: updatedMenus });
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }

    const body = await req.json();
    const { id, availableQuantity, maxQuantity, orderingDeadline, isActive, date, selectedMealIds } = body;

    // Handle batch publishing for a given date (admin only, as in PATCH)
    if (date && Array.isArray(selectedMealIds)) {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }
      return await handleBatchPublish(date, selectedMealIds, user.id, body.replace);
    }

    if (!id) {
      return NextResponse.json({ error: 'Menu ID is required' }, { status: 400 });
    }
    if (invalidQuantity(availableQuantity, maxQuantity)) {
      return NextResponse.json({ error: 'Quantity must be a whole number between 0 and 10000' }, { status: 400 });
    }

    if (availableQuantity !== undefined || maxQuantity !== undefined || orderingDeadline !== undefined) {
      const refused = await portionEditRefusal(String(id), maxQuantity);
      if (refused) return refused;
    }

    // Switching an entry off is unpublishing it: the same rule as the Unpublish button applies.
    if (isActive !== undefined && !Boolean(isActive)) {
      const { db } = await import('@/lib/firebase-admin');
      const snap = await db.collection('menus').doc(String(id)).get();
      const entry = snap.exists ? (snap.data() as any) : null;
      if (entry?.date && entry.isActive !== false) {
        const cat = normalizeStudentCategory(entry.studentCategory);
        const children = await paidChildrenFor(
          (t) => t.get(),
          db,
          String(entry.date),
          [{ ...entry, id: snap.id }],
          cat === 'ALL' ? [...STUDENT_CATEGORIES] : [cat]
        );
        if (children > 0) {
          return NextResponse.json({ error: hasOrdersMessage(children), code: 'HAS_ORDERS', children }, { status: 409 });
        }
      }
    }

    const updated = await prisma.menu.update({
      where: { id },
      data: {
        availableQuantity: availableQuantity !== undefined ? Number(availableQuantity) : undefined,
        maxQuantity: maxQuantity !== undefined ? Number(maxQuantity) : undefined,
        orderingDeadline: orderingDeadline !== undefined ? orderingDeadline : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: { meal: true },
    });

    try {
      const { notifyMenuUpdated } = await import('@/lib/sync-events');
      await notifyMenuUpdated();
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true, menu: updated });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json({ error: 'Failed to update menu' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Menu ID is required' }, { status: 400 });
    }

    // A menu entry that paid, active orders were placed for cannot be deleted (withdraw it instead).
    const { db } = await import('@/lib/firebase-admin');
    const menuSnap = await db.collection('menus').doc(id).get();
    if (menuSnap.exists) {
      const menu = menuSnap.data() || {};
      const [byMenuId, byDate] = await Promise.all([
        db.collection('orderItems').where('menuId', '==', id).get(),
        menu.date ? db.collection('orderItems').where('date', '==', menu.date).get() : Promise.resolve({ docs: [] as any[] }),
      ]);
      const lines = [
        ...byMenuId.docs.map((d: any) => d.data()),
        ...byDate.docs.map((d: any) => d.data()).filter((it: any) => !it.menuId && it.kind !== 'EXTRA' && it.mealId === menu.mealId),
      ];
      const orderIds = Array.from(new Set(lines.map((it: any) => String(it.orderId))));
      if (orderIds.length > 0) {
        const orders = await db.getAll(...orderIds.map((oid) => db.collection('orders').doc(oid)));
        const active = orders.some((o) => o.exists && o.data()?.paymentStatus === 'PAID' && o.data()?.orderStatus !== 'CANCELLED');
        if (active) {
          return NextResponse.json(
            { error: 'This menu entry already has orders, so it cannot be deleted. Ask the admin to cancel and refund those orders first.', code: 'HAS_ORDERS' },
            { status: 409 }
          );
        }
      }
    }

    await prisma.menu.delete({ where: { id } });

    try {
      const { notifyMenuUpdated } = await import('@/lib/sync-events');
      await notifyMenuUpdated();
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true, message: 'Menu item removed successfully' });
  } catch (error) {
    console.error('Error removing menu item:', error);
    return NextResponse.json({ error: 'Failed to remove menu item' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { date, selectedMealIds } = body;

    if (!date || !Array.isArray(selectedMealIds)) {
      return NextResponse.json({ error: 'Date and selectedMealIds array are required' }, { status: 400 });
    }

    return await handleBatchPublish(date, selectedMealIds, user.id, body.replace);
  } catch (error) {
    console.error('Error publishing menu:', error);
    return NextResponse.json({ error: 'Failed to publish menu' }, { status: 500 });
  }
}

