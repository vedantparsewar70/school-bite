import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import { getCashfreeOrder, getCashfreeOrderPayments } from '@/lib/cashfree';
import { cleanDoc, generateId } from '@/lib/firestore-db';

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

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderSnap.data() || {};

    // Authorization: User must be the parent who created the order or Staff/Admin
    if (user.role === 'PARENT' && orderData.parentId !== user.parentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If order is already verified as PAID, return immediately
    if (orderData.paymentStatus === 'PAID') {
      return NextResponse.json({
        success: true,
        verified: true,
        orderId,
        paymentStatus: 'PAID',
        orderStatus: orderData.orderStatus,
      });
    }

    // Query Cashfree API to verify current payment status
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

    const now = new Date().toISOString();

    if (isPaidOnCashfree) {
      // Find the successful payment details from Cashfree
      const successPay = cfPayments.find((p: any) => p.payment_status === 'SUCCESS') || {};
      const txnRef =
        successPay.cf_payment_id ||
        successPay.bank_reference ||
        `CF-${Date.now().toString().slice(-8)}`;

      // Map payment method
      let methodStr = 'UPI';
      const rawMethod = typeof successPay.payment_method === 'object' ? Object.keys(successPay.payment_method)[0]?.toUpperCase() : '';
      if (rawMethod.includes('CARD')) methodStr = 'CARD';
      else if (rawMethod.includes('NET') || rawMethod.includes('NB')) methodStr = 'NET_BANKING';
      else if (rawMethod.includes('UPI')) methodStr = 'UPI';

      const upiId = successPay.payment_method?.upi?.upi_id || null;
      const cardLastFour = successPay.payment_method?.card?.card_number ? successPay.payment_method.card.card_number.slice(-4) : null;
      const bankName = successPay.payment_method?.netbanking?.netbanking_bank_name || null;

      // Atomic update in Firestore
      await db.runTransaction(async (transaction) => {
        // 1. Update Order
        transaction.update(orderRef, {
          paymentStatus: 'PAID',
          orderStatus: 'CONFIRMED',
          cashfreeOrderId: cfOrder?.cf_order_id || null,
          updatedAt: now,
        });

        // 2. Check if a payment record already exists
        const paymentsSnap = await db.collection('payments').where('orderId', '==', orderId).get();
        if (paymentsSnap.empty) {
          const paymentId = generateId('PAY-');
          const payDoc = cleanDoc({
            id: paymentId,
            orderId,
            amount: Number(successPay.payment_amount || orderData.totalAmount),
            paymentMethod: methodStr,
            status: 'SUCCESS',
            transactionRef: String(txnRef),
            upiId,
            cardLastFour,
            bankName,
            createdAt: now,
          });
          transaction.set(db.collection('payments').doc(paymentId), payDoc);
        } else {
          const existingPayRef = paymentsSnap.docs[0].ref;
          transaction.update(existingPayRef, {
            status: 'SUCCESS',
            transactionRef: String(txnRef),
            paymentMethod: methodStr,
            upiId: upiId || paymentsSnap.docs[0].data()?.upiId || null,
            cardLastFour: cardLastFour || paymentsSnap.docs[0].data()?.cardLastFour || null,
            bankName: bankName || paymentsSnap.docs[0].data()?.bankName || null,
            updatedAt: now,
          });
        }
      });

      return NextResponse.json({
        success: true,
        verified: true,
        orderId,
        paymentStatus: 'PAID',
        orderStatus: 'CONFIRMED',
        transactionRef: txnRef,
      });
    }

    // Payment has not been finalized yet or failed on gateway
    return NextResponse.json({
      success: false,
      verified: false,
      orderId,
      paymentStatus: orderData.paymentStatus || 'PENDING',
      orderStatus: orderData.orderStatus || 'CONFIRMED',
      cashfreeStatus: cfOrder?.order_status || 'UNKNOWN',
    });
  } catch (error: any) {
    console.error('Error verifying order payment:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
