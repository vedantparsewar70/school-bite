import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getCurrentUser } from '@/lib/auth';
import { getTodayString } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
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
    orders = orders.filter((o: any) => o.paymentStatus === 'PAID');

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

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching teacher orders for staff:', error);
    return NextResponse.json({ error: 'Failed to fetch teacher orders' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { orderId, orderStatus = 'GIVEN' } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const ref = db.collection('teacher_orders').doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await ref.update({
      orderStatus,
      collectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, orderId, orderStatus });
  } catch (error) {
    console.error('Error updating teacher order status:', error);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}
