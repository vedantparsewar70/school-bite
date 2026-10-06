import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const grade = searchParams.get('class');
    const division = searchParams.get('division');
    const mealId = searchParams.get('mealId');
    const orderStatus = searchParams.get('orderStatus');
    const paymentStatus = searchParams.get('paymentStatus');
    const allergyFilter = searchParams.get('allergyFilter'); // 'ALL' | 'WITH_ALERTS' | 'NO_ALERTS'
    const search = searchParams.get('search')?.toLowerCase().trim();

    let orders: any[] = [];

    // Performance optimization: when filtered by meal date (e.g. today or tomorrow for staff),
    // target only the orderItems for that date rather than downloading all historical school orders!
    if (date) {
      const itemsForDate = await prisma.orderItem.findMany({
        where: { date },
      });
      const matchingOrderIds = Array.from(new Set(itemsForDate.map((it: any) => it.orderId)));

      if (matchingOrderIds.length === 0) {
        return NextResponse.json({ orders: [] });
      }

      orders = await prisma.order.findMany({
        where: { id: { in: matchingOrderIds } },
        include: {
          parent: {
            include: { user: true },
          },
          items: {
            include: {
              student: true,
              meal: true,
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Query recent orders with sensible ceiling for admin history view
      orders = await prisma.order.findMany({
        take: 100,
        include: {
          parent: {
            include: { user: true },
          },
          items: {
            include: {
              student: true,
              meal: true,
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    let filtered = orders;

    // Filter by orderStatus
    if (orderStatus && orderStatus !== 'ALL') {
      filtered = filtered.filter((o) => o.orderStatus === orderStatus);
    }

    // Filter by paymentStatus
    if (paymentStatus && paymentStatus !== 'ALL') {
      filtered = filtered.filter((o) => o.paymentStatus === paymentStatus);
    }

    // Filter by date (meal date on order items)
    if (date) {
      filtered = filtered.filter((o) => o.items && o.items.some((it: any) => it.date === date));
    }

    // Filter by meal
    if (mealId) {
      filtered = filtered.filter((o) => o.items && o.items.some((it: any) => it.mealId === mealId));
    }

    // Filter by class/grade
    if (grade) {
      filtered = filtered.filter((o) => o.items && o.items.some((it: any) => it.student?.grade === grade));
    }

    // Filter by division
    if (division) {
      filtered = filtered.filter((o) => o.items && o.items.some((it: any) => it.student?.division === division));
    }

    // Filter by allergy alert presence
    if (allergyFilter === 'WITH_ALERTS') {
      filtered = filtered.filter((o) => o.items.some((it: any) => it.hasAllergyAlert === true));
    } else if (allergyFilter === 'NO_ALERTS') {
      filtered = filtered.filter((o) => !o.items.some((it: any) => it.hasAllergyAlert === true));
    }

    if (search) {
      filtered = filtered.filter((o) => {
        const matchOrderId = o.id.toLowerCase().includes(search);
        const matchParent = o.parent?.user?.name?.toLowerCase().includes(search);
        const matchStudent = (o.items || []).some(
          (it: any) =>
            it.student?.name?.toLowerCase().includes(search) ||
            it.student?.studentId?.toLowerCase().includes(search) ||
            it.meal?.name?.toLowerCase().includes(search)
        );
        return matchOrderId || matchParent || matchStudent;
      });
    }

    const formattedOrders = filtered.map((order: any) => {
      const hasAnyAllergyAlert = (order.items || []).some((it: any) => it.hasAllergyAlert === true);

      return {
        id: order.id,
        parentId: order.parentId,
        parentName: order.parent?.user?.name || 'Parent',
        parentEmail: order.parent?.user?.email || '',
        parentPhone: order.parent?.user?.phone || null,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        hasAnyAllergyAlert,
        notes: order.notes,
        createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : new Date(order.createdAt).toISOString(),
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          studentId: item.studentId,
          studentName: item.student?.name || 'Student',
          studentGrade: item.student?.grade || '',
          studentDivision: item.student?.division || '',
          studentRollNo: item.student?.rollNo || '',
          allergies: item.student?.allergies || null,
          hasAllergyAlert: Boolean(item.hasAllergyAlert),
          conflictAllergens: item.conflictAllergens || item.student?.allergies || null,
          mealId: item.mealId,
          mealName: item.meal?.name || 'Meal',
          mealCategory: item.meal?.category || 'General',
          isVegetarian: Boolean(item.meal?.isVegetarian),
          date: item.date,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        payments: (order.payments || []).map((p: any) => ({
          id: p.id,
          orderId: p.orderId,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          status: p.status,
          transactionRef: p.transactionRef,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString(),
        })),
      };
    });

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }

    const body = await req.json();
    const { orderId, orderStatus } = body;

    if (!orderId || !orderStatus) {
      return NextResponse.json({ error: 'Order ID and new orderStatus are required' }, { status: 400 });
    }

    const validStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED'];
    if (!validStatuses.includes(orderStatus)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}
