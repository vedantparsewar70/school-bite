import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getCashfreeOrder, getCashfreeOrderPayments } from '@/lib/cashfree';
import { fulfillTeacherOrder } from '@/lib/order-fulfillment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json().catch(() => ({}));
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // 1. Check if order is ALREADY finalized and confirmed as PAID
    const orderRef = db.collection('teacher_orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (orderSnap.exists) {
      const orderData = orderSnap.data() || {};
      if (orderData.paymentStatus === 'PAID') {
        return NextResponse.json({
          success: true,
          verified: true,
          orderId,
          paymentStatus: 'PAID',
          orderStatus: orderData.orderStatus || 'CONFIRMED',
          teacherName: orderData.teacherName,
          totalAmount: orderData.totalAmount,
        });
      }
    }

    // 2. Check pending teacher checkout
    const pendingRef = db.collection('pending_teacher_orders').doc(orderId);
    const pendingSnap = await pendingRef.get();

    if (!orderSnap.exists && !pendingSnap.exists) {
      return NextResponse.json({ error: 'Teacher order session not found' }, { status: 404 });
    }

    const pendingData = pendingSnap.exists ? pendingSnap.data() || {} : {};

    // 3. Query Cashfree API to verify authoritative payment status
    let cfOrder: any = null;
    let cfPayments: any[] = [];
    try {
      cfOrder = await getCashfreeOrder(orderId);
      cfPayments = await getCashfreeOrderPayments(orderId);
    } catch (cfErr: any) {
      console.warn('[Teacher Cashfree Verify] Error fetching Cashfree status:', cfErr.message);
    }

    const isPaid =
      cfOrder?.order_status === 'PAID' ||
      cfPayments.some((p: any) => p.payment_status === 'SUCCESS');

    // 4. ONLY create order if payment is successfully completed
    if (isPaid) {
      const successPay = cfPayments.find((p: any) => p.payment_status === 'SUCCESS') || {};
      const txnRef =
        successPay.cf_payment_id ||
        successPay.bank_reference ||
        `CF-${Date.now().toString().slice(-8)}`;

      await fulfillTeacherOrder(orderId, {
        transactionRef: String(txnRef),
        cashfreeOrderId: cfOrder?.cf_order_id || null,
      });

      const updatedSnap = await orderRef.get();
      const updatedData = updatedSnap.data() || {};

      return NextResponse.json({
        success: true,
        verified: true,
        orderId,
        paymentStatus: 'PAID',
        orderStatus: 'CONFIRMED',
        teacherName: updatedData.teacherName || pendingData.teacherName,
        totalAmount: updatedData.totalAmount || pendingData.totalAmount,
      });
    }

    // 5. Payment is incomplete, dropped, or failed: Strictly DO NOT create any order!
    return NextResponse.json({
      success: false,
      verified: false,
      orderId,
      paymentStatus: 'FAILED',
      orderStatus: 'NONE',
      message: 'Payment was not completed. Strictly no order was created.',
    });
  } catch (error: any) {
    console.error('Error verifying teacher order:', error);
    return NextResponse.json({ error: error.message || 'Failed to verify order' }, { status: 500 });
  }
}
