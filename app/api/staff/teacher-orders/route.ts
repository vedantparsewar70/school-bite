import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getCurrentUser } from '@/lib/auth';
import { getTodayString } from '@/lib/utils';
import { formatServeTime } from '@/lib/service-dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getTodayString();
    const search = searchParams.get('search')?.toLowerCase().trim();

    let query = db.collection('teacher_orders').where('date', '==', date);
    const snap = await query.get();

    let orders = snap.docs.map((d) => d.data());

    // Strictly filter for completed PAID orders only
    // Admin → Teacher orders also lists cancelled/refunded ones (?withCancelled=1); everyone else sees paid only.
    const withCancelled = user.role === 'ADMIN' && searchParams.get('withCancelled') === '1';
    orders = orders.filter((o: any) =>
      withCancelled ? ['PAID', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED'].includes(o.paymentStatus) : o.paymentStatus === 'PAID'
    );

    // Sort by latest created
    orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (search) {
      orders = orders.filter((o: any) => {
        const matchName = (o.teacherName || '').toLowerCase().includes(search);
        const matchId = (o.id || '').toLowerCase().includes(search);
        const matchItems = (o.items || []).some((it: any) =>
          (it.mealName || '').toLowerCase().includes(search)
        );
        return matchName || matchId || matchItems;
      });
    }

    if (user.role === 'STAFF') {
      const trimmed = orders.map((o: any) => ({
        id: o.id,
        teacherName: o.teacherName || null,
        teacherPhone: o.teacherPhone || null,
        date: o.date,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        collectedAt: o.collectedAt || null,
        notes: o.notes || null,
        createdAt: o.createdAt,
        items: (o.items || []).map((it: any) => ({ mealId: it.mealId, mealName: it.mealName, quantity: it.quantity })),
      }));
      return NextResponse.json({ orders: trimmed });
    }
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching teacher orders for staff:', error);
    return NextResponse.json({ error: 'Failed to fetch teacher orders' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { orderId, orderStatus = 'GIVEN' } = body;

    if (typeof orderId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(orderId)) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }
    // CANCELLED: an administrator cancels the paid order and refunds it in full (same no-double-refund
    // logic as parent orders). Staff cannot cancel or refund.
    if (orderStatus === 'CANCELLED') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only an administrator can cancel and refund a teacher order.' }, { status: 403 });
      }
      const { cancelTeacherOrderWithRefund, OrderCancellationError } = await import('@/lib/order-cancellation');
      try {
        const result = await cancelTeacherOrderWithRefund({ orderId, cancelledBy: user.id });
        try {
          const { notifyTeacherOrdersUpdated } = await import('@/lib/sync-events');
          await notifyTeacherOrdersUpdated();
        } catch {
          // non-blocking
        }
        return NextResponse.json({ success: true, ...result });
      } catch (err) {
        if (err instanceof OrderCancellationError) return NextResponse.json({ error: err.message }, { status: err.status });
        throw err;
      }
    }
    // GIVEN = handed over; CONFIRMED = undo a mistaken handover.
    if (orderStatus !== 'GIVEN' && orderStatus !== 'CONFIRMED') {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
    }

    const ref = db.collection('teacher_orders').doc(orderId);
    const outcome = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) return { status: 404, error: 'Order not found' };
      const orderData = snap.data() || {};
      if (orderData.paymentStatus !== 'PAID') {
        return { status: 400, error: 'Cannot change an unpaid teacher order.' };
      }
      const now = new Date().toISOString();
      if (orderStatus === 'GIVEN') {
        if (orderData.orderStatus === 'GIVEN' || orderData.orderStatus === 'COLLECTED') {
          return {
            status: 409,
            error: orderData.collectedAt ? `Already served at ${formatServeTime(orderData.collectedAt)}` : 'This order has already been given.',
          };
        }
        // Staff serve only today's meals; an administrator can correct another day.
        if (user.role === 'STAFF' && orderData.date && orderData.date !== getTodayString()) {
          return { status: 403, error: 'Only today’s meals can be served.' };
        }
        transaction.update(ref, { orderStatus: 'GIVEN', collectedAt: now, collectedBy: user.id, updatedAt: now });
      } else {
        // Staff may undo only on the day itself; older corrections are for an administrator.
        if (user.role === 'STAFF' && orderData.date && orderData.date !== getTodayString()) {
          return { status: 403, error: 'Only today’s handovers can be undone. Ask an administrator.' };
        }
        // Undo keeps the original collectedAt as an audit trail.
        transaction.update(ref, { orderStatus: 'CONFIRMED', updatedAt: now, revertedAt: now, revertedBy: user.id });
      }
      return null;
    });
    if (outcome) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    try {
      const { notifyTeacherOrdersUpdated, notifyOrdersUpdated } = await import('@/lib/sync-events');
      await Promise.all([notifyTeacherOrdersUpdated(), notifyOrdersUpdated()]);
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true, orderId, orderStatus });
  } catch (error) {
    console.error('Error updating teacher order status:', error);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}
