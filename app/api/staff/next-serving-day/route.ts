import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { nextServingDay } from '@/lib/serving-day';
import { getTodayString } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** The next date after today with brunch for any category (skips Sundays, holidays, unpublished dates). */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  try {
    return NextResponse.json({ today: getTodayString(), date: await nextServingDay() });
  } catch (error) {
    console.error('Error finding next serving day:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Could not work out the next serving day.' }, { status: 500 });
  }
}
