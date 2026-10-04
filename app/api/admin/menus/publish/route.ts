import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
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

    // 2. Enable selected meals (upserting if not yet in database for that date)
    for (const mealId of selectedMealIds) {
      const existing = existingMealIdMap.get(mealId);
      if (existing) {
        await prisma.menu.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      } else {
        await prisma.menu.upsert({
          where: {
            mealId_date: { mealId, date },
          },
          update: { isActive: true },
          create: {
            mealId,
            date,
            availableQuantity: 50,
            maxQuantity: 50,
            orderingDeadline: '08:30',
            isActive: true,
          },
        });
      }
    }

    // 3. Disable any menu items for this date that are NOT in selectedMealIds
    for (const existing of existingMenus) {
      if (!selectedMealIds.includes(existing.mealId)) {
        await prisma.menu.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
      }
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
