import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma, { ensureDatabaseFile } from '@/lib/prisma';
import { comparePassword, createSessionToken, TOKEN_COOKIE_NAME } from '@/lib/auth';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let step = '1_REQUEST_RECEIVED';
  let redactedEmail = '';

  try {
    console.log('[AUTH_LOGIN_TRACE] Step 1: Request reached /api/auth/login');

    step = '2_PARSE_BODY';
    const body = await req.json().catch(() => null);
    const { email, password } = body || {};

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
    console.log('[AUTH_LOGIN_TRACE] Step 3: Database connection/check started');
    const resolvedDbTarget = ensureDatabaseFile();
    const isFileTarget = resolvedDbTarget.startsWith('file:');
    console.log(`[AUTH_LOGIN_TRACE] Step 3: Database ready (type: ${isFileTarget ? 'sqlite_file' : 'external'})`);

    step = '4_USER_LOOKUP';
    console.log(`[AUTH_LOGIN_TRACE] Step 4: User lookup started for ${redactedEmail}`);
    const user = await prisma.user.findUnique({
      where: { email: emailStr },
      include: { parent: true },
    });
    console.log(`[AUTH_LOGIN_TRACE] Step 4: User lookup completed. User found: ${Boolean(user)}`);

    if (!user) {
      console.warn(`[AUTH_LOGIN_TRACE] Authentication failed: user not found in database (${redactedEmail})`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
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
    const cookieStore = await cookies();
    cookieStore.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    console.log('[AUTH_LOGIN_TRACE] Step 7: Session cookie set successfully');

    console.log('[AUTH_LOGIN_TRACE] Final response status: 200 OK');

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

    console.log('[AUTH_LOGIN_TRACE] Final response status: 500 Internal Server Error');

    return NextResponse.json(
      {
        error: 'An unexpected error occurred during login',
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
          'x-auth-failed-step': step,
          'x-auth-error-name': errorName,
        },
      }
    );
  }
}
