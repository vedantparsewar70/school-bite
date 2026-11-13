import { NextResponse } from 'next/server';
import {
  checkCashfreeWebhookSignature,
  getCashfreeMode,
  getCashfreeRefund,
  getVerifiedCashfreePayment,
  paidAtFromWebhookPayload,
  paymentDetailsFromCashfree,
} from '@/lib/cashfree';
import { db } from '@/lib/firebase-admin';
import { fulfillParentOrder, fulfillTeacherOrder } from '@/lib/order-fulfillment';
import { applyRefundStatus } from '@/lib/order-cancellation';
import { applyExceptionRefundStatus, isAutoRefundReason, refundPaymentException } from '@/lib/payment-exceptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-webhook-signature') || '';
    const timestamp = req.headers.get('x-webhook-timestamp') || '';

    // Verify webhook signature: Must be present and cryptographically valid
    if (!signature || !timestamp) {
      console.warn('[Cashfree Webhook] Rejected (401): missing header', {
        signatureHeaderPresent: Boolean(signature),
        timestampHeaderPresent: Boolean(timestamp),
      });
      return NextResponse.json({ error: 'Missing required webhook signature headers' }, { status: 401 });
    }

    const check = checkCashfreeWebhookSignature(rawBody, signature, timestamp);
    if (!check.valid) {
      // Only safe facts: never the secret, the signature value or the body.
      console.warn(`[Cashfree Webhook] Rejected (401): ${check.reason}`, { ...check.details, cashfreeMode: modeForLog() });
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn('[Cashfree Webhook] Rejected (400): body is not valid JSON', { bodyLength: rawBody.length });
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const eventType = String(payload.type || payload.event || '');

    // Refund status updates: confirm the refund with the Cashfree API before recording it.
    if (eventType.startsWith('REFUND')) {
      const refundObj = payload.data?.refund || {};
      if (refundObj.order_id && refundObj.refund_id) {
        const refundOrderId = String(refundObj.order_id);
        const refund = await getCashfreeRefund(refundOrderId, String(refundObj.refund_id));
        // The refund belongs either to a cancelled order or to an unfulfillable payment; each
        // update only applies when the stored refund ID matches.
        const status = await applyRefundStatus(refundOrderId, refund);
        const exceptionStatus = await applyExceptionRefundStatus(refundOrderId, refund);
        console.log(`[Cashfree Webhook] Refund for ${refundOrderId}: order=${status} exception=${exceptionStatus}`);
      }
      return NextResponse.json({ success: true, received: true });
    }

    const orderId = payload.data?.order?.order_id;
    if (!orderId) {
      console.warn(`[Cashfree Webhook] Ignored: no order_id in ${eventType || 'unknown'} event`);
      return NextResponse.json({ received: true, message: 'No order_id present' });
    }

    const paymentObj = payload.data?.payment || {};
    if (eventType !== 'PAYMENT_SUCCESS_WEBHOOK' && paymentObj.payment_status !== 'SUCCESS') {
      // Payment failed or incomplete: Strictly DO NOT create any order!
      console.log(`[Cashfree Webhook] Non-success event (${eventType}) for order ${orderId}. Strictly no order created.`);
      return NextResponse.json({ success: true, received: true });
    }

    // The payload is only a hint: payment status, amount and currency come from the Cashfree API.
    const verified = await getVerifiedCashfreePayment(String(orderId));
    if (!verified.paid) {
      console.warn(`[Cashfree Webhook] Order ${orderId} is ${verified.orderStatus} on Cashfree; no order created.`);
      return NextResponse.json({ success: true, received: true });
    }
    const details = paymentDetailsFromCashfree(verified);

    const isTeacherId = orderId.startsWith('TCH-') || orderId.startsWith('TORD-');
    const pendingTeacherSnap = isTeacherId ? null : await db.collection('pending_teacher_orders').doc(orderId).get();
    const isTeacherOrder = isTeacherId || Boolean(pendingTeacherSnap?.exists);

    // Parent orders are judged against the ordering cutoff at the time the customer paid. If Cashfree's
    // payment record could not be read, use the payment time in this signed webhook; without either,
    // answer 503 so Cashfree retries later, rather than guessing "now" and wrongly flagging a late payment.
    if (!isTeacherOrder && !details.paidAt) {
      const webhookPaidAt = paidAtFromWebhookPayload(payload, String(orderId));
      if (webhookPaidAt) {
        details.paidAt = webhookPaidAt;
        console.warn(`[Cashfree Webhook] Payment time for ${orderId} taken from the webhook (payments lookup ${verified.payment ? 'had no time' : 'failed'})`);
      } else if (!verified.payment) {
        console.warn(`[Cashfree Webhook] Deferred (503): payments lookup for ${orderId} failed and the webhook has no payment time; Cashfree will retry`);
        return NextResponse.json({ error: 'Payment details temporarily unavailable' }, { status: 503 });
      }
    }

    // Fulfilment is idempotent, so repeated deliveries of the same event cannot create duplicate orders.
    const result = isTeacherOrder
      ? await fulfillTeacherOrder(orderId, details)
      : await fulfillParentOrder(orderId, details);

    if (!result.success) {
      // Recorded as a payment exception; acknowledge so the gateway does not keep retrying.
      console.error(`[Cashfree Webhook] Order ${orderId} not fulfilled: ${result.reason} - ${result.message}`);
      if (isAutoRefundReason(result.reason) && result.exceptionRecorded) {
        const refund = await refundPaymentException(orderId);
        console.log(`[Cashfree Webhook] Unfulfillable payment ${orderId}: refund ${refund.refundState}`);
      }
    } else if (!result.alreadyFulfilled) {
      console.log(`[Cashfree Webhook] Order ${orderId} confirmed via webhook.`);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    // 500 makes Cashfree retry. Common causes: unknown checkout ID (e.g. a webhook from another
    // environment), Cashfree API unavailable, or a configuration error.
    console.error('[Cashfree Webhook] Failed (500):', error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/** Cashfree mode for diagnostics only; a misconfiguration is reported, never thrown. */
function modeForLog(): string {
  try {
    return getCashfreeMode();
  } catch {
    return 'not configured';
  }
}
