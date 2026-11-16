import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { setPortions } from '@/lib/menu-day';

export const dynamic = 'force-dynamic';

/** Student Menu portions for one class's dish: never below what is already ordered. Body: { date, studentCategory, portions } */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const { date, studentCategory, portions } = body || {};
    const result = await setPortions({ date, studentCategory, portions, actorId: user.id });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Error setting portions:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Portions could not be saved. Please try again.' }, { status: 500 });
  }
}
