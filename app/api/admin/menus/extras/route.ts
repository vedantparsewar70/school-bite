import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { addExtra, removeExtra, setExtraPortions } from '@/lib/menu-extras';

export const dynamic = 'force-dynamic';

/**
 * Student Menu extras (staff and admin).
 * Body: { action: 'add' | 'remove' | 'portions', date, studentCategory ('ALL' only for add), mealId, portions? }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const { action, date, studentCategory, mealId, portions } = body || {};
    const result =
      action === 'add'
        ? await addExtra({ date, studentCategory, mealId, portions, actorId: user.id })
        : action === 'remove'
          ? await removeExtra({ date, studentCategory, mealId, actorId: user.id })
          : action === 'portions'
            ? await setExtraPortions({ date, studentCategory, mealId, portions, actorId: user.id })
            : { status: 400, body: { error: 'Unknown action.' } };
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Error changing extras:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The extra could not be saved. Please try again.' }, { status: 500 });
  }
}
