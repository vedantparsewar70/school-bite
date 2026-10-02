import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ensureDatabaseFile } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureDatabaseFile();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
