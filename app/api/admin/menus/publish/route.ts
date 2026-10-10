import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }

    const body = await req.json();
    const { date, selectedMealIds } = body;

    if (!date || !Array.isArray(selectedMealIds)) {
      return NextResponse.json({ error: 'Date and selectedMealIds array are required' }, { status: 400 });
    }

    // 1. Fetch all existing menus for this date
    const existingMenus = await prisma.menu.findMany({
      where: { date },
    });

    const existingMealIdMap = new Map(existingMenus.map((m: any) => [m.mealId, m]));

    const now = new Date().toISOString();

    // 2. Concurrently enable selected meals & disable unselected meals
    const enablePromises = selectedMealIds.map((mealId: string) => {
      const existing = existingMealIdMap.get(mealId);
      if (existing) {
        return prisma.menu.update({
          where: { id: existing.id },
          data: { isActive: true, updatedAt: now },
        });
      } else {
        return prisma.menu.upsert({
          where: {
            mealId_date: { mealId, date },
          },
          update: { isActive: true, updatedAt: now },
          create: {
            mealId,
            date,
            availableQuantity: 50,
            maxQuantity: 50,
            orderingDeadline: '08:30',
            isActive: true,
            updatedAt: now,
          },
        });
      }
    });

    const disablePromises = existingMenus
      .filter((existing: any) => !selectedMealIds.includes(existing.mealId))
      .map((existing: any) =>
        prisma.menu.update({
          where: { id: existing.id },
          data: { isActive: false, updatedAt: now },
        })
      );

    await Promise.all([...enablePromises, ...disablePromises]);

    // Record authoritative publication in menu_publishes collection
    try {
      const { recordMenuPublication } = await import('@/lib/menu-schedule');
      await recordMenuPublication(date, selectedMealIds);
    } catch (e) {
      console.error('Failed to record menu publication:', e);
    }

    // Invalidate menu cache and notify live sync system so parents immediately see updated menu
    try {
      const { clearMenuCache } = await import('@/app/api/menu/route');
      clearMenuCache();
    } catch {
      // ignore
    }

    try {
      const { notifyMenuUpdated } = await import('@/lib/sync-events');
      await notifyMenuUpdated();
    } catch {
      // ignore
    }

    const updatedMenus = await prisma.menu.findMany({
      where: { date },
      include: { meal: true },
    });

    return NextResponse.json({
      success: true,
      message: `Menu for ${date} published successfully with ${selectedMealIds.length} active items.`,
      menus: updatedMenus,
      publishedCount: selectedMealIds.length,
    });
  } catch (error) {
    console.error('Error publishing menu:', error);
    return NextResponse.json({ error: 'Failed to publish menu' }, { status: 500 });
  }
}
