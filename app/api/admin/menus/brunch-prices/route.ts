import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { validateBrunchPrices } from '@/lib/brunch-prices';
import { getBrunchPrices, saveBrunchPrices } from '@/lib/brunch-prices-server';

export const dynamic = 'force-dynamic';

const staffOrAdmin = (user: { role?: string } | null) => Boolean(user && (user.role === 'ADMIN' || user.role === 'STAFF'));

/** Brunch prices by class (Student Menu page, staff and admin). Changes apply to new orders only. */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!staffOrAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  try {
    return NextResponse.json({ prices: await getBrunchPrices() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error loading brunch prices:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Could not load the brunch prices. Please try again.' }, { status: 500 });
  }
}

/** Body: { prices: { 'Pre-primary': n, Primary: n, Secondary: n } } (whole rupees, 1 to 500). */
export async function PUT(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || !staffOrAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const result = validateBrunchPrices(body?.prices);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  try {
    await saveBrunchPrices(result.prices, user.id);
    try {
      const { notifyMenuUpdated } = await import('@/lib/sync-events');
      await notifyMenuUpdated();
    } catch {
      // non-blocking
    }
    return NextResponse.json({ success: true, prices: result.prices, message: 'Brunch prices saved. They apply to new orders only.' });
  } catch (error) {
    console.error('Error saving brunch prices:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The prices could not be saved. Please try again.' }, { status: 500 });
  }
}
