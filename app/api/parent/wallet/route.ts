import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, paymentMethod = 'UPI' } = await req.json();
    const rechargeAmount = Number(amount);

    if (!rechargeAmount || rechargeAmount <= 0) {
      return NextResponse.json({ error: 'Invalid recharge amount' }, { status: 400 });
    }

    const updated = await prisma.parent.update({
      where: { id: user.parentId },
      data: {
        walletBalance: { increment: rechargeAmount },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully added ₹${rechargeAmount} to your wallet`,
      walletBalance: updated.walletBalance,
    });
  } catch (error) {
    console.error('Error recharging wallet:', error);
    return NextResponse.json({ error: 'Failed to recharge wallet' }, { status: 500 });
  }
}
