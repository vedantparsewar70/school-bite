import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { normalizeStudentCategory } from '@/lib/menu-stock';
import { STUDENT_CATEGORIES, type StudentCategory } from '@/lib/monthly-menu';
import { withdrawDish } from '@/lib/menu-publish';

export const dynamic = 'force-dynamic';

/**
 * Staff → Student Menu and Admin → Menu "Unpublish": takes the dish off sale for one date and one
 * category. Refused while any child has a paid, active order for it (lib/menu-publish.ts).
 *
 * Body: { date, studentCategory }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const { date, studentCategory, category } = body || {};
    // One category only; an unknown value is refused, never guessed.
    const cat = normalizeStudentCategory(typeof (studentCategory || category) === 'string' ? studentCategory || category : null);
    if (!STUDENT_CATEGORIES.includes(cat as StudentCategory)) {
      return NextResponse.json({ error: 'Please choose Pre-primary, Primary or Secondary.' }, { status: 400 });
    }
    const result = await withdrawDish({ date, studentCategory: cat, actorId: user.id });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Error unpublishing menu:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The menu could not be unpublished. Please try again.' }, { status: 500 });
  }
}
