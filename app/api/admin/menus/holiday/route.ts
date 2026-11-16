import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markHoliday, undoHoliday } from '@/lib/menu-day';

export const dynamic = 'force-dynamic';

/**
 * Student Menu "Mark as holiday" / "Undo holiday" (staff and admin).
 * Body: { date, studentCategory: 'ALL' | class, action: 'mark' | 'undo', reason? }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const { date, studentCategory, action, reason } = body || {};
    const result =
      action === 'undo'
        ? await undoHoliday({ date, studentCategory, actorId: user.id })
        : action === 'mark'
          ? await markHoliday({ date, studentCategory, reason, actorId: user.id })
          : { status: 400, body: { error: 'Unknown action.' } };
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Error changing holiday:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The holiday could not be saved. Please try again.' }, { status: 500 });
  }
}
