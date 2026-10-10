import { NextResponse } from 'next/server';
import { getSyncVersions } from '@/lib/sync-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const versions = await getSyncVersions();
    return NextResponse.json(versions, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching sync versions:', error);
    return NextResponse.json(
      {
        menuVersion: Date.now(),
        ordersVersion: Date.now(),
        teacherOrdersVersion: Date.now(),
        timestamp: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
