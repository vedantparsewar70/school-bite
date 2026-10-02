import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getTodayString } from '@/lib/utils';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getTodayString();

    // Fetch all active order items for this date
    const items = await prisma.orderItem.findMany({
      where: {
        date,
        order: {
          orderStatus: { not: 'CANCELLED' },
        },
      },
      include: {
        meal: true,
        student: {
          include: {
            studentAllergies: {
              include: { allergy: true },
            },
          },
        },
        order: true,
      },
      orderBy: [
        { student: { grade: 'asc' } },
        { student: { division: 'asc' } },
        { student: { rollNo: 'asc' } },
      ],
    });

    // Aggregate meal counts
    const mealCountsMap = new Map<string, { mealId: string; mealName: string; category: string; count: number; isVegetarian: boolean }>();
    let totalMeals = 0;
    let allergyAlertsCount = 0;

    for (const it of items) {
      totalMeals += it.quantity;
      if (it.hasAllergyAlert) {
        allergyAlertsCount += it.quantity;
      }

      const existing = mealCountsMap.get(it.mealId);
      if (existing) {
        existing.count += it.quantity;
      } else {
        mealCountsMap.set(it.mealId, {
          mealId: it.mealId,
          mealName: it.meal.name,
          category: it.meal.category,
          count: it.quantity,
          isVegetarian: it.meal.isVegetarian,
        });
      }
    }

    // Breakdown by Class/Division
    const classBreakdownMap = new Map<string, number>();
    for (const it of items) {
      const key = `Class ${it.student.grade}-${it.student.division}`;
      classBreakdownMap.set(key, (classBreakdownMap.get(key) || 0) + it.quantity);
    }

    const studentList = items.map((it) => {
      const studentAllergies = it.student.studentAllergies.map((sa) => sa.allergy.name);
      if (it.student.allergies && studentAllergies.length === 0) {
        it.student.allergies.split(/[,;]/).forEach((p) => {
          const t = p.trim();
          if (t && !studentAllergies.includes(t)) studentAllergies.push(t);
        });
      }

      return {
        orderItemId: it.id,
        orderId: it.orderId,
        studentName: it.student.name,
        studentId: it.student.studentId,
        grade: it.student.grade,
        division: it.student.division,
        rollNo: it.student.rollNo,
        allergies: studentAllergies.join(', ') || it.student.allergies || null,
        hasAllergyAlert: it.hasAllergyAlert,
        conflictAllergens: it.conflictAllergens || it.student.allergies || null,
        mealName: it.meal.name,
        category: it.meal.category,
        isVegetarian: it.meal.isVegetarian,
        quantity: it.quantity,
        orderStatus: it.order.orderStatus,
      };
    });

    return NextResponse.json({
      date,
      totalMeals,
      totalOrders: items.length,
      allergyAlertsCount,
      mealCounts: Array.from(mealCountsMap.values()).sort((a, b) => b.count - a.count),
      classBreakdown: Array.from(classBreakdownMap.entries()).map(([cls, count]) => ({
        classDivision: cls,
        count,
      })),
      studentList,
    });
  } catch (error) {
    console.error('Error fetching kitchen data:', error);
    return NextResponse.json({ error: 'Failed to fetch kitchen data' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { date, status, orderIds }: { date?: string; status: 'PREPARING' | 'READY' | 'COLLECTED'; orderIds?: string[] } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    let affectedCount = 0;

    if (orderIds && orderIds.length > 0) {
      const res = await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { orderStatus: status },
      });
      affectedCount = res.count;
    } else if (date) {
      const items = await prisma.orderItem.findMany({
        where: {
          date,
          order: { orderStatus: { not: 'CANCELLED' } },
        },
        select: { orderId: true },
      });

      const uniqueOrderIds = Array.from(new Set(items.map((i) => i.orderId)));
      const res = await prisma.order.updateMany({
        where: { id: { in: uniqueOrderIds } },
        data: { orderStatus: status },
      });
      affectedCount = res.count;
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${affectedCount} orders to ${status}`,
    });
  } catch (error) {
    console.error('Error updating kitchen orders:', error);
    return NextResponse.json({ error: 'Failed to update kitchen orders' }, { status: 500 });
  }
}
