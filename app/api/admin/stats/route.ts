import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getTodayString, getOffsetDateString } from '@/lib/utils';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }

    const todayStr = getTodayString();
    const tomorrowStr = getOffsetDateString(1);

    // 1. Check if tomorrow's menu is published
    const tomorrowMenus = await prisma.menu.findMany({
      where: {
        date: tomorrowStr,
        isActive: true,
      },
      include: { meal: true },
    });
    const isTomorrowMenuPublished = tomorrowMenus.length > 0;
    const tomorrowPublishedCount = tomorrowMenus.length;

    // 2. Fetch tomorrow's active items for production count
    const tomorrowItems = await prisma.orderItem.findMany({
      where: {
        date: tomorrowStr,
        order: {
          orderStatus: { not: 'CANCELLED' },
        },
      },
      include: { meal: true },
    });

    const tomorrowMealCountsMap = new Map<string, { mealName: string; count: number; category: string; isVegetarian: boolean }>();
    for (const it of tomorrowItems) {
      const existing = tomorrowMealCountsMap.get(it.mealId);
      if (existing) {
        existing.count += it.quantity;
      } else {
        tomorrowMealCountsMap.set(it.mealId, {
          mealName: it.meal.name,
          count: it.quantity,
          category: it.meal.category,
          isVegetarian: it.meal.isVegetarian,
        });
      }
    }
    const tomorrowProduction = Array.from(tomorrowMealCountsMap.values()).sort((a, b) => b.count - a.count);
    const tomorrowTotalMeals = tomorrowItems.reduce((sum: number, it: any) => sum + it.quantity, 0);

    // 3. Fetch today's items for comparison if needed
    const todayItems = await prisma.orderItem.findMany({
      where: {
        date: todayStr,
        order: {
          orderStatus: { not: 'CANCELLED' },
        },
      },
      include: { meal: true },
    });
    const todayTotalMeals = todayItems.reduce((sum: number, it: any) => sum + it.quantity, 0);

    // 4. All active orders & totals
    const allActiveOrders = await prisma.order.findMany({
      where: {
        orderStatus: { not: 'CANCELLED' },
      },
      include: {
        items: true,
      },
    });

    const totalOrders = allActiveOrders.length;
    const totalOrderValue = allActiveOrders.reduce((sum: number, o: any) => sum + o.totalAmount, 0);
    const allActiveItems = allActiveOrders.flatMap((o: any) => o.items || []);
    const totalItems = allActiveItems.reduce((sum: number, it: any) => sum + it.quantity, 0);
    const studentsOrdered = new Set(allActiveItems.map((it: any) => it.studentId)).size;

    // 5. Recent orders for compact preview
    const recentOrders = await prisma.order.findMany({
      take: 5,
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
      },
    });

    const formattedRecentOrders = recentOrders.map((o: any) => ({
      id: o.id,
      parentName: o.parent?.user?.name || 'Parent',
      totalAmount: o.totalAmount,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
      items: (o.items || []).map((it: any) => ({
        mealName: it.meal?.name || 'Meal',
        studentName: it.student?.name || 'Student',
        grade: it.student?.grade || '',
        division: it.student?.division || '',
        date: it.date,
        quantity: it.quantity,
      })),
    }));

    return NextResponse.json({
      stats: {
        totalOrders,
        studentsOrdered,
        totalItems,
        totalOrderValue,
        todayTotalMeals,
        tomorrowTotalMeals,
        nextMealDate: tomorrowStr,
        isTomorrowMenuPublished,
        tomorrowPublishedCount,
      },
      tomorrowProduction,
      recentOrders: formattedRecentOrders,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
