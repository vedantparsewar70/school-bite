import { NextResponse } from 'next/server';
import { verifyCashfreeWebhookSignature } from '@/lib/cashfree';
import { db } from '@/lib/firebase-admin';
import { cleanDoc, generateId } from '@/lib/firestore-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-webhook-signature') || '';
    const timestamp = req.headers.get('x-webhook-timestamp') || '';

    // Verify webhook signature if signature header is provided
    if (signature && timestamp) {
      const isValid = verifyCashfreeWebhookSignature(rawBody, signature, timestamp);
      if (!isValid) {
        console.warn('[Cashfree Webhook] Invalid webhook signature detected');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const eventType = payload.type || payload.event || '';
    const orderObj = payload.data?.order || {};
    const paymentObj = payload.data?.payment || {};
    const orderId = orderObj.order_id;

    if (!orderId) {
      return NextResponse.json({ received: true, message: 'No order_id present' });
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      console.warn(`[Cashfree Webhook] Order ${orderId} not found in Firestore`);
      return NextResponse.json({ received: true, message: 'Order not found' });
    }

    const orderData = orderSnap.data() || {};
    const now = new Date().toISOString();

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || paymentObj.payment_status === 'SUCCESS') {
      const txnRef =
        paymentObj.cf_payment_id ||
        paymentObj.bank_reference ||
        `CF-${Date.now().toString().slice(-8)}`;

      let methodStr = 'UPI';
      const rawMethod = typeof paymentObj.payment_method === 'object' ? Object.keys(paymentObj.payment_method)[0]?.toUpperCase() : '';
      if (rawMethod.includes('CARD')) methodStr = 'CARD';
      else if (rawMethod.includes('NET') || rawMethod.includes('NB')) methodStr = 'NET_BANKING';
      else if (rawMethod.includes('UPI')) methodStr = 'UPI';

      const upiId = paymentObj.payment_method?.upi?.upi_id || null;
      const cardLastFour = paymentObj.payment_method?.card?.card_number ? paymentObj.payment_method.card.card_number.slice(-4) : null;
      const bankName = paymentObj.payment_method?.netbanking?.netbanking_bank_name || null;

      await db.runTransaction(async (transaction) => {
        // 1. Mark order as PAID
        transaction.update(orderRef, {
          paymentStatus: 'PAID',
          orderStatus: 'CONFIRMED',
          cashfreeOrderId: orderObj.cf_order_id || null,
          updatedAt: now,
        });

        // 2. Check if payment record exists
        const paymentsSnap = await db.collection('payments').where('orderId', '==', orderId).get();
        if (paymentsSnap.empty) {
          const paymentId = generateId('PAY-');
          const payDoc = cleanDoc({
            id: paymentId,
            orderId,
            amount: Number(paymentObj.payment_amount || orderData.totalAmount),
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

      console.log(`[Cashfree Webhook] Order ${orderId} successfully confirmed via webhook!`);
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
      console.log(`[Cashfree Webhook] Payment failed event for order ${orderId}`);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    console.error('[Cashfree Webhook Error]:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
}
