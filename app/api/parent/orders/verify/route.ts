import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import { getCashfreeOrder, getCashfreeOrderPayments } from '@/lib/cashfree';
import { fulfillParentOrder } from '@/lib/order-fulfillment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json().catch(() => ({}));
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // 1. Check if order is ALREADY finalized and confirmed as PAID
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (orderSnap.exists) {
      const orderData = orderSnap.data() || {};
      if (user.role === 'PARENT' && orderData.parentId !== user.parentId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (orderData.paymentStatus === 'PAID') {
        return NextResponse.json({
          success: true,
          verified: true,
          orderId,
          paymentStatus: 'PAID',
          orderStatus: orderData.orderStatus || 'CONFIRMED',
        });
      }
    }

    // 2. Check pending checkout session
    const pendingRef = db.collection('pending_orders').doc(orderId);
    const pendingSnap = await pendingRef.get();

    if (!orderSnap.exists && !pendingSnap.exists) {
      return NextResponse.json({ error: 'Checkout session or order not found' }, { status: 404 });
    }

    const pendingData = pendingSnap.exists ? pendingSnap.data() || {} : {};
    if (user.role === 'PARENT' && pendingData.parentId && pendingData.parentId !== user.parentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Query Cashfree API to verify authoritative payment status
    let cfOrder: any = null;
    let cfPayments: any[] = [];
    try {
      cfOrder = await getCashfreeOrder(orderId);
      cfPayments = await getCashfreeOrderPayments(orderId);
    } catch (cfErr: any) {
      console.warn('[Cashfree Verify] Could not retrieve Cashfree order status:', cfErr.message);
    }

    const isPaidOnCashfree =
      cfOrder?.order_status === 'PAID' ||
      cfPayments.some((p: any) => p.payment_status === 'SUCCESS');

    // 4. ONLY create order if payment is successfully completed
    if (isPaidOnCashfree) {
      const successPay = cfPayments.find((p: any) => p.payment_status === 'SUCCESS') || {};
      const txnRef =
        successPay.cf_payment_id ||
        successPay.bank_reference ||
        `CF-${Date.now().toString().slice(-8)}`;

      let methodStr = 'UPI';
      const rawMethod = typeof successPay.payment_method === 'object' ? Object.keys(successPay.payment_method)[0]?.toUpperCase() : '';
      if (rawMethod.includes('CARD')) methodStr = 'CARD';
      else if (rawMethod.includes('NET') || rawMethod.includes('NB')) methodStr = 'NET_BANKING';
      else if (rawMethod.includes('UPI')) methodStr = 'UPI';

      const upiId = successPay.payment_method?.upi?.upi_id || null;
      const cardLastFour = successPay.payment_method?.card?.card_number ? successPay.payment_method.card.card_number.slice(-4) : null;
      const bankName = successPay.payment_method?.netbanking?.netbanking_bank_name || null;

      const fulfillResult = await fulfillParentOrder(orderId, {
        transactionRef: String(txnRef),
        paymentMethod: methodStr,
        upiId,
        cardLastFour,
        bankName,
        cashfreeOrderId: cfOrder?.cf_order_id || null,
        amount: Number(successPay.payment_amount || pendingData.totalAmount || 0),
      });

      return NextResponse.json({
        success: true,
        verified: true,
        orderId: fulfillResult.orderId,
        paymentStatus: 'PAID',
        orderStatus: 'CONFIRMED',
        transactionRef: String(txnRef),
      });
    }

    // 5. Payment is incomplete, dropped, or failed: Strictly DO NOT create any order!
    return NextResponse.json({
      success: false,
      verified: false,
      orderId,
      paymentStatus: 'FAILED',
      orderStatus: 'NONE',
      cashfreeStatus: cfOrder?.order_status || 'NOT_COMPLETED',
      message: 'Payment was not completed. Strictly no order was created.',
    });
  } catch (error: any) {
    console.error('Error verifying order payment:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
