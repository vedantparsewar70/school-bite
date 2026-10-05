import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TOKEN_COOKIE_NAME } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    try {
      const cookieStore = await cookies();
      cookieStore.delete(TOKEN_COOKIE_NAME);
    } catch {
      // ignore
    }

    const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
    res.cookies.delete(TOKEN_COOKIE_NAME);
    return res;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}
