import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    const payments = await prisma.payment.findMany({
      where: {
        order: {
          parentId: user.parentId,
        },
        ...(status ? { status } : {}),
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                student: true,
                meal: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const filtered = date
      ? payments.filter((p) => p.createdAt.toISOString().startsWith(date))
      : payments;

    return NextResponse.json({ payments: filtered });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
