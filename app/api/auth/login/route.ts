import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma, { ensureDatabaseFile } from '@/lib/prisma';
import { comparePassword, createSessionToken, TOKEN_COOKIE_NAME } from '@/lib/auth';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let normalizedEmail = '';
  try {
    ensureDatabaseFile();

    const body = await req.json();
    const { email, password } = body || {};

    if (!email || !password) {
      console.warn('[AUTH_LOGIN] Missing email or password in login request');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    normalizedEmail = String(email).toLowerCase().trim();
    console.log(`[AUTH_LOGIN] Login attempt started for: "${normalizedEmail}"`);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { parent: true },
    });

    if (!user) {
      console.warn(`[AUTH_LOGIN] Authentication failed: user not found for "${normalizedEmail}"`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`[AUTH_LOGIN] User account resolved for "${normalizedEmail}" (role: ${user.role}). Validating credentials...`);

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      console.warn(`[AUTH_LOGIN] Authentication failed: invalid password for "${normalizedEmail}"`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`[AUTH_LOGIN] Password validated successfully for "${normalizedEmail}". Creating session token...`);

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      parentId: user.parent?.id,
    });

    const cookieStore = await cookies();
    cookieStore.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    console.log(`[AUTH_LOGIN] Session cookie set successfully for "${normalizedEmail}". Login complete.`);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        parentId: user.parent?.id,
        walletBalance: user.parent?.walletBalance ?? 0,
      },
    });
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;

    // Log diagnostic failure details in Vercel Runtime Logs without leaking sensitive information
    console.error(`[AUTH_LOGIN_ERROR] Exception occurred during login for "${normalizedEmail || 'unknown'}"`, {
      errorName,
      errorMessage,
      errorCode,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'An unexpected error occurred during login' },
      { status: 500 }
    );
  }
}
