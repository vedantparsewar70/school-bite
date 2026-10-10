import { NextResponse } from 'next/server';
import { verifyCashfreeWebhookSignature } from '@/lib/cashfree';
import { db } from '@/lib/firebase-admin';
import { fulfillParentOrder, fulfillTeacherOrder } from '@/lib/order-fulfillment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-webhook-signature') || '';
    const timestamp = req.headers.get('x-webhook-timestamp') || '';

    // Verify webhook signature: Must be present and cryptographically valid
    if (!signature || !timestamp) {
      console.warn('[Cashfree Webhook] Missing required x-webhook-signature or x-webhook-timestamp header');
      return NextResponse.json({ error: 'Missing required webhook signature headers' }, { status: 401 });
    }

    const isValid = verifyCashfreeWebhookSignature(rawBody, signature, timestamp);
    if (!isValid) {
      console.warn('[Cashfree Webhook] Invalid webhook signature detected');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
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

    // Only fulfill and create orders on verified SUCCESS events
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

      // Check if this is a Teacher order
      const isTeacherId = orderId.startsWith('TCH-') || orderId.startsWith('TORD-');
      const pendingTeacherSnap = await db.collection('pending_teacher_orders').doc(orderId).get();

      if (isTeacherId || pendingTeacherSnap.exists) {
        await fulfillTeacherOrder(orderId, {
          transactionRef: String(txnRef),
          cashfreeOrderId: orderObj.cf_order_id || null,
        });
        console.log(`[Cashfree Webhook] Teacher Order ${orderId} successfully confirmed via webhook!`);
      } else {
        await fulfillParentOrder(orderId, {
          transactionRef: String(txnRef),
          paymentMethod: methodStr,
          upiId,
          cardLastFour,
          bankName,
          cashfreeOrderId: orderObj.cf_order_id || null,
          amount: Number(paymentObj.payment_amount || 0),
        });
        console.log(`[Cashfree Webhook] Parent Order ${orderId} successfully confirmed via webhook!`);
      }
    } else {
      // Payment failed or incomplete: Strictly DO NOT create any order!
      console.log(`[Cashfree Webhook] Non-success event (${eventType}) for order ${orderId}. Strictly no order created.`);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    console.error('[Cashfree Webhook Error]:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
}
