import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const parents = await prisma.parent.findMany({
      include: {
        user: true,
        students: {
          orderBy: { name: 'asc' },
        },
        orders: {
          select: { id: true, totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedParents = parents.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      email: p.user.email,
      phone: p.user.phone,
      walletBalance: p.walletBalance,
      childrenCount: p.students.length,
      ordersCount: p.orders.length,
      totalSpent: p.orders.reduce((sum, o) => sum + o.totalAmount, 0),
      createdAt: p.createdAt.toISOString(),
      students: p.students.map((s) => ({
        id: s.id,
        name: s.name,
        grade: s.grade,
        division: s.division,
        rollNo: s.rollNo,
        studentId: s.studentId,
        allergies: s.allergies,
        isVegetarian: s.isVegetarian,
        isActive: s.isActive,
      })),
    }));

    return NextResponse.json({ parents: formattedParents });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
