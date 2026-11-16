import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { menuDays, MENU_DAYS_DEFAULT } from '@/lib/menu-day';
import { getTodayString } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * The Student Menu editor's days: for each date, each class's dish exactly as parents see it
 * (same entry selection as the parent menu), portions ordered / left, and what can be changed.
 * Query: from=YYYY-MM-DD (default today), days (1 to 21, default 14). No money totals or parent data.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const today = getTodayString();
    const fromParam = searchParams.get('from') || today;
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && !Number.isNaN(Date.parse(`${fromParam}T00:00:00Z`)) ? fromParam : today;
    const n = Number(searchParams.get('days') || MENU_DAYS_DEFAULT);
    const days = Number.isInteger(n) && n >= 1 && n <= 21 ? n : MENU_DAYS_DEFAULT;
    return NextResponse.json({ today, days: await menuDays(from, days) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error loading menu days:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Could not load the menu. Please try again.' }, { status: 500 });
  }
}
