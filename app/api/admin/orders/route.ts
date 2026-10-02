import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const grade = searchParams.get('class');
    const division = searchParams.get('division');
    const mealId = searchParams.get('mealId');
    const orderStatus = searchParams.get('orderStatus');
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search')?.toLowerCase().trim();

    // Query orders with items
    const orders = await prisma.order.findMany({
      where: {
        ...(orderStatus ? { orderStatus } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        items: {
          some: {
            ...(date ? { date } : {}),
            ...(mealId ? { mealId } : {}),
            student: {
              ...(grade ? { grade } : {}),
              ...(division ? { division } : {}),
            },
          },
        },
      },
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

    let filtered = orders;
    if (search) {
      filtered = orders.filter((o) => {
        const matchOrderId = o.id.toLowerCase().includes(search);
        const matchParent = o.parent.user.name.toLowerCase().includes(search);
        const matchStudent = o.items.some(
          (it) =>
            it.student.name.toLowerCase().includes(search) ||
            it.student.studentId.toLowerCase().includes(search) ||
            it.meal.name.toLowerCase().includes(search)
        );
        return matchOrderId || matchParent || matchStudent;
      });
    }

    const formattedOrders = filtered.map((order) => ({
      id: order.id,
      parentId: order.parentId,
      parentName: order.parent.user.name,
      parentEmail: order.parent.user.email,
      parentPhone: order.parent.user.phone,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        studentId: item.studentId,
        studentName: item.student.name,
        studentGrade: item.student.grade,
        studentDivision: item.student.division,
        studentRollNo: item.student.rollNo,
        allergies: item.student.allergies,
        mealId: item.mealId,
        mealName: item.meal.name,
        mealCategory: item.meal.category,
        isVegetarian: item.meal.isVegetarian,
        date: item.date,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      payments: order.payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        status: p.status,
        transactionRef: p.transactionRef,
        createdAt: p.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
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
