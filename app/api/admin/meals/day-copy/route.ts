import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { editDishForDay } from '@/lib/menu-day-copy';

export const dynamic = 'force-dynamic';

/**
 * "Edit for this day" (staff and admin): a copy of the dish used only on that date for the chosen
 * classes. Body: { date, studentCategory ('ALL' or a class), mealId, name, price, isVegetarian, description? }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const result = await editDishForDay({ ...(body || {}), actorId: user.id });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Error editing dish for a day:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The dish could not be saved. Please try again.' }, { status: 500 });
  }
}
