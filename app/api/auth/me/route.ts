import { NextResponse } from 'next/server';
import {
  createSessionToken,
  getCurrentUser,
  readSessionToken,
  sessionMaxAgeSeconds,
  STAFF_SESSION_RENEW_AFTER_SECONDS,
  TOKEN_COOKIE_NAME,
  verifySessionToken,
} from '@/lib/auth';
import type { UserRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req, { throwOnUnavailable: true });
    if (!user) {
      return NextResponse.json({ user: null });
    }
    const response = NextResponse.json({ user });

    // Sliding staff session: while the canteen phone is in use, a sign-in older than a day is
    // renewed for another 30 days. The role comes from the database (above), never from the token.
    if (user.role === 'STAFF') {
      const token = await readSessionToken(req);
      const claims = token ? await verifySessionToken(token) : null;
      const age = claims?.iat ? Math.floor(Date.now() / 1000) - claims.iat : 0;
      if (claims && age > STAFF_SESSION_RENEW_AFTER_SECONDS) {
        const fresh = await createSessionToken({ userId: user.id, email: user.email, name: user.name, role: user.role as UserRole });
        const proto = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https://') ? 'https' : 'http');
        response.cookies.set({
          name: TOKEN_COOKIE_NAME,
          value: fresh,
          httpOnly: true,
          secure: proto === 'https',
          sameSite: 'lax',
          path: '/',
          maxAge: sessionMaxAgeSeconds('STAFF'),
        });
      }
    }
    return response;
  } catch (error) {
    // e.g. the database is briefly unreachable: not a sign-out, so the client keeps its session.
    console.error('Error fetching current user:', error);
    return NextResponse.json({ user: null, error: 'Session check temporarily unavailable' }, { status: 503 });
  }
}
