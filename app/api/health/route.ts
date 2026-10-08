import { NextResponse } from 'next/server';
import { getFirebaseConfigStatus, db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configStatus = getFirebaseConfigStatus();
  let dbConnected = false;
  let dbError: string | null = null;
  let userCount = 0;

  if (configStatus.configured) {
    try {
      const snap = await db.collection('users').limit(1).get();
      dbConnected = true;
      userCount = snap.size;
    } catch (err: any) {
      dbError = err?.message || String(err);
    }
  }

  return NextResponse.json({
    status: configStatus.configured && dbConnected ? 'HEALTHY' : 'MISCONFIGURED',
    timestamp: new Date().toISOString(),
    firebase: {
      isConfigured: configStatus.configured,
      isConnectedToDatabase: dbConnected,
      databaseError: dbError,
      initializationError: configStatus.initError,
    },
    environment: configStatus.envStatus,
    instructions: !configStatus.configured
      ? 'In your Vercel Project Settings -> Environment Variables, add FIREBASE_SERVICE_ACCOUNT_KEY with your service account JSON and make sure "Production" and "Preview" environments are selected, then Redeploy.'
      : undefined,
  });
}
