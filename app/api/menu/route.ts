import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTodayString } from '@/lib/utils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let whereClause: any = { isActive: true };

    if (date) {
      whereClause.date = date;
    } else if (startDate && endDate) {
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      };
    } else {
      whereClause.date = getTodayString();
    }

    const menus = await prisma.menu.findMany({
      where: whereClause,
      include: {
        meal: true,
      },
      orderBy: [
        { date: 'asc' },
        { meal: { category: 'asc' } },
        { meal: { name: 'asc' } },
      ],
    });

    return NextResponse.json({ menus });
  } catch (error) {
    console.error('Error fetching menus:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}
