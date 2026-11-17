import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { validateBrunchPrices, validateDefaultPortions } from '@/lib/brunch-prices';
import { getBrunchPrices, getDefaultPortions, saveBrunchPrices, saveDefaultPortions } from '@/lib/brunch-prices-server';

export const dynamic = 'force-dynamic';

const staffOrAdmin = (user: { role?: string } | null) => Boolean(user && (user.role === 'ADMIN' || user.role === 'STAFF'));

/**
 * Student Menu settings card (staff and admin): brunch prices by class and default portions per
 * class (for new main menu entries). Price changes apply to new orders only.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!staffOrAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  try {
    const [prices, defaultPortions] = await Promise.all([getBrunchPrices(), getDefaultPortions()]);
    return NextResponse.json({ prices, defaultPortions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error loading brunch prices:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Could not load the brunch prices. Please try again.' }, { status: 500 });
  }
}

/**
 * Body: { prices: { 'Pre-primary', Primary, Secondary } } (whole rupees, 1 to 500)
 *   and/or { defaultPortions: { 'Pre-primary', Primary, Secondary } } (whole numbers, 1 to 2000).
 */
export async function PUT(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || !staffOrAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const hasPrices = body && body.prices !== undefined;
  const hasPortions = body && body.defaultPortions !== undefined;
  if (!hasPrices && !hasPortions) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  // Both are checked before anything is written.
  const prices = hasPrices ? validateBrunchPrices(body.prices) : null;
  if (prices && !prices.ok) return NextResponse.json({ error: prices.error }, { status: 400 });
  const portions = hasPortions ? validateDefaultPortions(body.defaultPortions) : null;
  if (portions && !portions.ok) return NextResponse.json({ error: portions.error }, { status: 400 });
  try {
    if (prices?.ok) await saveBrunchPrices(prices.prices, user.id);
    if (portions?.ok) await saveDefaultPortions(portions.portions, user.id);
    try {
      const { notifyMenuUpdated } = await import('@/lib/sync-events');
      await notifyMenuUpdated();
    } catch {
      // non-blocking
    }
    const [savedPrices, defaultPortions] = await Promise.all([getBrunchPrices(), getDefaultPortions()]);
    return NextResponse.json({
      success: true,
      prices: savedPrices,
      defaultPortions,
      message: prices?.ok ? 'Brunch prices saved. They apply to new orders only.' : 'Default portions saved. They apply to new menu entries.',
    });
  } catch (error) {
    console.error('Error saving brunch prices:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The settings could not be saved. Please try again.' }, { status: 500 });
  }
}
