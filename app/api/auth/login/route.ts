import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { comparePassword, hashPassword, createSessionToken, TOKEN_COOKIE_NAME } from '@/lib/auth';
import { UserRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  let step = '1_REQUEST_RECEIVED';
  let redactedEmail = '';

  try {
    console.log('[AUTH_LOGIN_TRACE] Step 1: Request reached /api/auth/login');

    step = '2_PARSE_BODY';
    const body = await req.json().catch(() => null);
    const { email, password, requestedRole } = body || {};

    if (!email || !password) {
      console.warn('[AUTH_LOGIN_TRACE] Step 2 Failed: Missing email or password in request body');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const emailStr = String(email).trim().toLowerCase();
    const atIndex = emailStr.indexOf('@');
    if (atIndex > 1) {
      redactedEmail = `${emailStr[0]}***${emailStr[atIndex - 1]}${emailStr.slice(atIndex)}`;
    } else {
      redactedEmail = '***@' + (emailStr.split('@')[1] || 'domain');
    }

    console.log(`[AUTH_LOGIN_TRACE] Step 2: Email received (${redactedEmail})`);

    step = '3_DATABASE_CHECK';
    console.log('[AUTH_LOGIN_TRACE] Step 3: Database connection check started');

    step = '4_USER_LOOKUP';
    console.log(`[AUTH_LOGIN_TRACE] Step 4: User lookup started for ${redactedEmail}`);
    let user = await prisma.user.findUnique({
      where: { email: emailStr },
      include: { parent: true },
    });

    // Auto-provision demo staff account if signing in
    if (!user && emailStr === 'staff@school.com' && password === 'Staff123') {
      const passwordHash = await hashPassword('Staff123');
      user = await prisma.user.create({
        data: {
          id: 'usr_canteen_staff_01',
          email: 'staff@school.com',
          name: 'Canteen Staff',
          role: 'STAFF',
          passwordHash,
        },
      });
    }

    // Auto-provision demo admin account if not found
    if (!user && emailStr === 'admin@school.com' && password === 'Admin123') {
      const passwordHash = await hashPassword('Admin123');
      user = await prisma.user.create({
        data: {
          id: 'usr_canteen_admin_01',
          email: 'admin@school.com',
          name: 'Canteen Admin',
          role: 'ADMIN',
          passwordHash,
        },
      });
    }

    console.log(`[AUTH_LOGIN_TRACE] Step 4: User lookup completed. User found: ${Boolean(user)}`);

    if (!user) {
      console.warn(`[AUTH_LOGIN_TRACE] Authentication failed: user not found in database (${redactedEmail})`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Role-specific enforcement if requestedRole is provided
    if (requestedRole === 'admin' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied: This login is reserved for Administrators. If you are Canteen Staff, please use Staff Login.' },
        { status: 403 }
      );
    }

    if (requestedRole === 'staff' && user.role !== 'STAFF' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied: This login is reserved for Canteen Staff.' },
        { status: 403 }
      );
    }

    step = '5_PASSWORD_VERIFY';
    console.log(`[AUTH_LOGIN_TRACE] Step 5: Password verification started for ${redactedEmail}`);
    const isValid = await comparePassword(password, user.passwordHash);
    console.log(`[AUTH_LOGIN_TRACE] Step 5: Password verification completed. Match: ${isValid}`);

    if (!isValid) {
      console.warn(`[AUTH_LOGIN_TRACE] Authentication failed: invalid password for ${redactedEmail}`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    step = '6_JWT_GENERATION';
    console.log(`[AUTH_LOGIN_TRACE] Step 6: JWT generation started for userId: ${user.id}, role: ${user.role}`);
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      parentId: user.parent?.id,
    });
    console.log('[AUTH_LOGIN_TRACE] Step 6: JWT generation completed');

    step = '7_SESSION_COOKIE';
    console.log('[AUTH_LOGIN_TRACE] Step 7: Setting session cookie');
    const proto = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https://') ? 'https' : 'http');
    const isHttps = proto === 'https';

    // Safely attempt next/headers cookie store
    try {
      const cookieStore = await cookies();
      cookieStore.set(TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    } catch (cookieErr) {
      console.warn('[AUTH_LOGIN_TRACE] Note: cookieStore.set warning:', cookieErr);
    }

    const redirectUrl =
      user.role === 'ADMIN'
        ? '/admin/dashboard'
        : user.role === 'STAFF'
        ? '/staff/kitchen'
        : '/parent/children';

    console.log('[AUTH_LOGIN_TRACE] Final response status: 200 OK');

    const response = NextResponse.json(
      {
        success: true,
        redirectUrl,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          parentId: user.parent?.id,
          walletBalance: user.parent?.walletBalance ?? 0,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );

    // Also attach cookie directly to the response object for bulletproof header delivery across all environments
    response.cookies.set({
      name: TOKEN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const rawErrorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;

    // Sanitize any credentials, connection strings, or secrets from log
    const sanitizedError = rawErrorMessage
      .replace(/(password|secret|key|token)=[^& ]+/gi, '$1=***')
      .replace(/:\/\/.*@/g, '://***@');

    console.error('[AUTH_LOGIN_ERROR] Execution failed at step:', step, {
      errorName,
      errorCode,
      errorMessage: sanitizedError,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: sanitizedError || 'An unexpected error occurred during login',
        diagnostic: {
          failedStep: step,
          errorName,
          errorCode: errorCode || null,
          details: sanitizedError,
        },
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'x-auth-failed-step': step,
          'x-auth-error-name': errorName,
        },
      }
    );
  }
}
