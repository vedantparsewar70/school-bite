import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getTodayString } from '@/lib/utils';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const todayStr = getTodayString();

    const [totalParents, totalStudents, totalMeals] = await Promise.all([
      prisma.parent.count(),
      prisma.student.count({ where: { isActive: true } }),
      prisma.meal.count(),
    ]);

    // Today's orders & revenue
    const todayItems = await prisma.orderItem.findMany({
      where: {
        date: todayStr,
        order: {
          orderStatus: { not: 'CANCELLED' },
        },
      },
      include: {
        meal: true,
      },
    });

    const todayRevenue = todayItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const todayOrdersCount = new Set(todayItems.map((i) => i.orderId)).size;
    const studentsServedCount = new Set(todayItems.map((i) => i.studentId)).size;
    const todayAllergyAlertsCount = todayItems.filter((i) => i.hasAllergyAlert).reduce((sum, i) => sum + i.quantity, 0);
    const todayAllergyOrdersCount = new Set(todayItems.filter((i) => i.hasAllergyAlert).map((i) => i.orderId)).size;

    // All-time meals sold
    const allActiveItems = await prisma.orderItem.findMany({
      where: {
        order: { orderStatus: { not: 'CANCELLED' } },
      },
    });
    const totalMealsSold = allActiveItems.reduce((sum, i) => sum + i.quantity, 0);
    const totalRevenue = allActiveItems.reduce((sum, i) => sum + i.totalPrice, 0);

    // Pending orders (CONFIRMED or PREPARING)
    const pendingOrdersCount = await prisma.order.count({
      where: {
        orderStatus: { in: ['CONFIRMED', 'PREPARING'] },
      },
    });

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
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
    });

    const formattedRecentOrders = recentOrders.map((o) => ({
      id: o.id,
      parentName: o.parent.user.name,
      parentEmail: o.parent.user.email,
      totalAmount: o.totalAmount,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      hasAnyAllergyAlert: o.items.some((it) => it.hasAllergyAlert),
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((it) => ({
        mealName: it.meal.name,
        mealCategory: it.meal.category,
        studentName: it.student.name,
        grade: it.student.grade,
        division: it.student.division,
        hasAllergyAlert: it.hasAllergyAlert,
        conflictAllergens: it.conflictAllergens,
        date: it.date,
        quantity: it.quantity,
      })),
    }));

    return NextResponse.json({
      stats: {
        totalParents,
        totalStudents,
        totalMeals,
        todayOrdersCount,
        todayRevenue,
        pendingOrdersCount,
        totalMealsSold,
        totalRevenue,
        studentsServedCount,
        todayAllergyAlertsCount,
        todayAllergyOrdersCount,
      },
      recentOrders: formattedRecentOrders,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
