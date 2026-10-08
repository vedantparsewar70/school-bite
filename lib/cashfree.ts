import crypto from 'crypto';

/**
 * Cashfree Payment Gateway Service (Zero-external-dependency, native fetch)
 * Supports Sandbox (Test) and Production environments configured via .env
 */

interface CustomerDetails {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

interface CreateOrderParams {
  orderId: string;
  orderAmount: number;
  customer: CustomerDetails;
  returnUrl: string;
  notifyUrl?: string;
  orderNote?: string;
}

export interface CashfreeOrderResponse {
  cfOrderId: string;
  orderId: string;
  orderStatus: string;
  paymentSessionId: string;
  orderAmount: number;
  orderCurrency: string;
}

function getCredentials() {
  const appId = process.env.CASHFREE_APP_ID?.trim();
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim();
  const env = (process.env.CASHFREE_ENV || 'TEST').trim().toUpperCase();
  const apiVersion = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim();

  if (!appId || !secretKey) {
    throw new Error('Cashfree credentials (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) are missing in environment variables.');
  }

  const baseUrl = env === 'PROD' || env === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  return { appId, secretKey, env, apiVersion, baseUrl };
}

/**
 * Creates an order session on Cashfree Payment Gateway
 */
export async function createCashfreeOrder(params: CreateOrderParams): Promise<CashfreeOrderResponse> {
  const { appId, secretKey, apiVersion, baseUrl } = getCredentials();

  // Clean and normalize phone to 10 digits for Indian standard
  let cleanPhone = params.customer.customerPhone ? params.customer.customerPhone.replace(/\D/g, '') : '';
  if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
  if (cleanPhone.length < 10) cleanPhone = '9999999999';

  // Customer ID must be alphanumeric and under 50 characters
  const cleanCustomerId = params.customer.customerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'cust_anonymous';

  const payload: any = {
    order_id: params.orderId,
    order_amount: Math.round(params.orderAmount * 100) / 100,
    order_currency: 'INR',
    customer_details: {
      customer_id: cleanCustomerId,
      customer_name: params.customer.customerName.slice(0, 100) || 'Parent',
      customer_email: params.customer.customerEmail || 'parent@schoolbite.in',
      customer_phone: cleanPhone,
    },
    order_meta: {
      return_url: params.returnUrl,
    },
    order_note: params.orderNote || 'SchoolBite Meal Order',
  };

  if (params.notifyUrl) {
    payload.order_meta.notify_url = params.notifyUrl;
  }

  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'x-client-id': appId,
      'x-client-secret': secretKey,
      'x-api-version': apiVersion,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.message || data.error || `Cashfree Order Creation failed with HTTP ${res.status}`;
    console.error('[Cashfree] Order creation error:', { status: res.status, data });
    throw new Error(errorMsg);
  }

  return {
    cfOrderId: String(data.cf_order_id || ''),
    orderId: data.order_id,
    orderStatus: data.order_status,
    paymentSessionId: data.payment_session_id,
    orderAmount: Number(data.order_amount),
    orderCurrency: data.order_currency || 'INR',
  };
}

/**
 * Fetches order details directly from Cashfree to verify payment status
 */
export async function getCashfreeOrder(orderId: string): Promise<any> {
  const { appId, secretKey, apiVersion, baseUrl } = getCredentials();

  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      'x-client-id': appId,
      'x-client-secret': secretKey,
      'x-api-version': apiVersion,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to fetch Cashfree order status: ${res.status}`);
  }

  return data;
}

/**
 * Fetches all payment attempts and gateway references for a given order
 */
export async function getCashfreeOrderPayments(orderId: string): Promise<any[]> {
  const { appId, secretKey, apiVersion, baseUrl } = getCredentials();

  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
    method: 'GET',
    headers: {
      'x-client-id': appId,
      'x-client-secret': secretKey,
      'x-api-version': apiVersion,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

/**
 * Verifies the authenticity of Cashfree webhook notifications using HMAC-SHA256 signature
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  try {
    const { secretKey } = getCredentials();
    const dataToSign = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(dataToSign)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
