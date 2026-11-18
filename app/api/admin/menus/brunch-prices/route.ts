import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { validateBrunchPrices, validateDefaultPortions } from '@/lib/brunch-prices';
import { getBrunchPrices, getDefaultPortions, saveBrunchPrices, saveDefaultPortions } from '@/lib/brunch-prices-server';
import { validCutoff } from '@/lib/ordering-cutoff';
import { getOrderingCutoff, saveOrderingCutoff } from '@/lib/ordering-cutoff-server';

export const dynamic = 'force-dynamic';

const staffOrAdmin = (user: { role?: string } | null) => Boolean(user && (user.role === 'ADMIN' || user.role === 'STAFF'));

/**
 * Student Menu settings card (staff and admin): brunch prices by class, default portions per class
 * (for new main menu entries) and "Ordering closes at" (one cutoff for parents; ADMIN only to change).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!staffOrAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  try {
    const [prices, defaultPortions, orderingCutoff] = await Promise.all([getBrunchPrices(), getDefaultPortions(), getOrderingCutoff()]);
    return NextResponse.json({ prices, defaultPortions, orderingCutoff }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error loading brunch prices:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Could not load the brunch prices. Please try again.' }, { status: 500 });
  }
}

/**
 * Body: { prices: { 'Pre-primary', Primary, Secondary } } (whole rupees, 1 to 500)
 *   and/or { defaultPortions: { 'Pre-primary', Primary, Secondary } } (whole numbers, 1 to 2000)
 *   and/or { orderingCutoff: 'HH:MM' } (a real time; ADMIN only).
 */
export async function PUT(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || !staffOrAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const hasPrices = body && body.prices !== undefined;
  const hasPortions = body && body.defaultPortions !== undefined;
  const hasCutoff = body && body.orderingCutoff !== undefined;
  if (!hasPrices && !hasPortions && !hasCutoff) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  if (hasCutoff && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only the admin can change when ordering closes.' }, { status: 403 });
  }
  const cutoff = hasCutoff ? validCutoff(body.orderingCutoff) : null;
  if (hasCutoff && !cutoff) return NextResponse.json({ error: 'Please enter a real time (HH:MM, 00:00 to 23:59).' }, { status: 400 });
  // Both are checked before anything is written.
  const prices = hasPrices ? validateBrunchPrices(body.prices) : null;
  if (prices && !prices.ok) return NextResponse.json({ error: prices.error }, { status: 400 });
  const portions = hasPortions ? validateDefaultPortions(body.defaultPortions) : null;
  if (portions && !portions.ok) return NextResponse.json({ error: portions.error }, { status: 400 });
  try {
    if (prices?.ok) await saveBrunchPrices(prices.prices, user.id);
    if (portions?.ok) await saveDefaultPortions(portions.portions, user.id);
    if (cutoff) await saveOrderingCutoff(cutoff, user.id);
    try {
      const { notifyMenuUpdated } = await import('@/lib/sync-events');
      await notifyMenuUpdated();
    } catch {
      // non-blocking
    }
    const [savedPrices, defaultPortions, orderingCutoff] = await Promise.all([getBrunchPrices(), getDefaultPortions(), getOrderingCutoff()]);
    return NextResponse.json({
      success: true,
      prices: savedPrices,
      defaultPortions,
      orderingCutoff,
      message: prices?.ok
        ? 'Brunch prices saved. They apply to new orders only.'
        : portions?.ok
          ? 'Default portions saved. They apply to new menu entries.'
          : `Ordering now closes at ${orderingCutoff} on the meal day.`,
    });
  } catch (error) {
    console.error('Error saving brunch prices:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The settings could not be saved. Please try again.' }, { status: 500 });
  }
}
