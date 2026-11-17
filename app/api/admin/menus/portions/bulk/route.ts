import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { validateBulkPortions } from '@/lib/brunch-prices';
import { bulkSetPortions } from '@/lib/menu-day';

export const dynamic = 'force-dynamic';

/**
 * "Apply portions to upcoming days" (staff and admin): sets the portions of every upcoming main
 * menu entry for the chosen classes; never below what is already ordered; extras untouched.
 * Body: { classes: ['Pre-primary' | 'Primary' | 'Secondary', ...], portions: 1..2000 }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Staff access required' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const v = validateBulkPortions(body || {});
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const r = await bulkSetPortions({ classes: v.classes, portions: v.portions, actorId: user.id });
    return NextResponse.json({
      success: true,
      updatedDays: r.updatedDays.length,
      updatedEntries: r.updated.length,
      skipped: r.skipped,
      message: `Updated ${r.updatedDays.length} ${r.updatedDays.length === 1 ? 'day' : 'days'}, skipped ${r.skipped.length}.`,
    });
  } catch (error) {
    console.error('Error applying portions:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Portions could not be applied. Some days may already be updated; please check and try again.' }, { status: 500 });
  }
}
