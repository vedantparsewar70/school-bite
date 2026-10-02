import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    const menus = await prisma.menu.findMany({
      where: date ? { date } : {},
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
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { mealId, date, availableQuantity = 50, maxQuantity = 50, orderingDeadline = '08:30' } = body;

    if (!mealId || !date) {
      return NextResponse.json({ error: 'Meal ID and date are required' }, { status: 400 });
    }

    // Upsert menu item for this meal & date
    const menu = await prisma.menu.upsert({
      where: {
        mealId_date: {
          mealId,
          date,
        },
      },
      update: {
        availableQuantity: Number(availableQuantity),
        maxQuantity: Number(maxQuantity),
        orderingDeadline: orderingDeadline || '08:30',
        isActive: true,
      },
      create: {
        mealId,
        date,
        availableQuantity: Number(availableQuantity),
        maxQuantity: Number(maxQuantity),
        orderingDeadline: orderingDeadline || '08:30',
        isActive: true,
      },
      include: { meal: true },
    });

    return NextResponse.json({ success: true, menu }, { status: 201 });
  } catch (error) {
    console.error('Error scheduling menu:', error);
    return NextResponse.json({ error: 'Failed to schedule meal' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { id, availableQuantity, maxQuantity, orderingDeadline, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Menu ID is required' }, { status: 400 });
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

    return NextResponse.json({ success: true, menu: updated });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json({ error: 'Failed to update menu' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Menu ID is required' }, { status: 400 });
    }

    await prisma.menu.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Menu item removed successfully' });
  } catch (error) {
    console.error('Error removing menu item:', error);
    return NextResponse.json({ error: 'Failed to remove menu item' }, { status: 500 });
  }
}
