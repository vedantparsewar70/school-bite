import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { menuDays } from '@/lib/menu-day';
import { getTodayString } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/**
 * Month view of the Student Menu: every date of the month with each class's dish (or Holiday /
 * Sunday / Nothing on sale). Query: month=YYYY-MM, at most 6 months before or after this month.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  const today = getTodayString();
  const month = new URL(req.url).searchParams.get('month') || today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Please choose a month (YYYY-MM).' }, { status: 400 });
  if (Math.abs(monthIndex(month) - monthIndex(today.slice(0, 7))) > 6) {
    return NextResponse.json({ error: 'Months up to 6 before or after this month can be shown.' }, { status: 400 });
  }
  try {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // Two halves: Firestore "in" queries take at most 30 values.
    const first = await menuDays(`${month}-01`, 15);
    const second = await menuDays(`${month}-16`, daysInMonth - 15);
    return NextResponse.json({ month, today, days: [...first, ...second] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error loading menu month:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Could not load the month. Please try again.' }, { status: 500 });
  }
}
