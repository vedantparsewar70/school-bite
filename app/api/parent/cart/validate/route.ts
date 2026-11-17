import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { validateCartAvailability } from '@/lib/availability';
import { getStudentCategory } from '@/lib/student-category';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'PARENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { cartItems } = body;

    if (!cartItems || !Array.isArray(cartItems)) {
      return NextResponse.json({ error: 'cartItems array is required' }, { status: 400 });
    }

    // Each line's class (and so its brunch price) comes from the child's own record, never from the
    // browser; a child who is not this parent's gets no class (shown as unavailable at checkout).
    const students = user.parentId
      ? await prisma.student.findMany({ where: { parentId: user.parentId, isActive: true } })
      : [];
    const categoryOf = new Map(students.map((s: any) => [s.id, getStudentCategory(s.grade, s.studentCategory)]));
    const lines = cartItems.map((it: any) => {
      const { studentCategory, ...rest } = it || {};
      void studentCategory;
      const cat = categoryOf.get(String(rest.studentId || ''));
      return cat ? { ...rest, studentCategory: cat } : rest;
    });

    const validation = await validateCartAvailability(lines);

    return NextResponse.json({
      valid: validation.valid,
      items: validation.items,
      firstUnavailableItem: validation.firstUnavailableItem,
      errorMessage: validation.errorMessage,
    });
  } catch (error) {
    console.error('Error validating cart availability:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Failed to validate cart availability' }, { status: 500 });
  }
}
