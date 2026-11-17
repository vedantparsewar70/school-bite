import assert from 'node:assert/strict';

/**
 * A Cashfree SANDBOX stand-in for payment tests: records created orders and refunds, and reports an
 * order as paid once `paid[orderId]` is set. Any other URL fails the test (no real network).
 */
export function installCashfreeStub() {
  const state = {
    paid: {} as Record<string, number>,
    created: [] as any[],
    refunds: [] as any[],
  };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    assert.ok(url.startsWith('https://sandbox.cashfree.com/pg/'), `sandbox only (got ${url})`);
    const path = url.replace('https://sandbox.cashfree.com/pg', '');
    const method = init?.method || 'GET';
    if (method === 'POST' && path === '/orders') {
      const body = JSON.parse(String(init!.body));
      state.created.push(body);
      return Response.json({
        cf_order_id: `cf_${state.created.length}`,
        order_id: body.order_id,
        payment_session_id: `sess_${state.created.length}`,
        order_status: 'ACTIVE',
        order_amount: body.order_amount,
      });
    }
    const orderId = decodeURIComponent(path.split('/')[2] || '');
    if (method === 'POST' && path.endsWith('/refunds')) {
      const body = JSON.parse(String(init!.body));
      state.refunds.push({ ...body, orderId });
      return Response.json({ refund_id: body.refund_id, cf_refund_id: 'cfr', refund_status: 'PENDING', refund_amount: body.refund_amount });
    }
    if (path.includes('/refunds/')) return Response.json({ message: 'not found' }, { status: 404 });
    if (path.endsWith('/payments')) {
      const amount = state.paid[orderId];
      return Response.json(
        amount
          ? [{ payment_status: 'SUCCESS', payment_amount: amount, payment_currency: 'INR', cf_payment_id: `pay_${orderId}`, payment_completion_time: new Date().toISOString() }]
          : []
      );
    }
    const amount = state.paid[orderId];
    return Response.json({ cf_order_id: 'cf', order_status: amount ? 'PAID' : 'ACTIVE', order_amount: amount || 0, order_currency: 'INR' });
  }) as typeof fetch;

  const env = process.env as Record<string, string | undefined>;
  env.CASHFREE_APP_ID = 'test_app_id';
  env.CASHFREE_SECRET_KEY = 'test_secret_key';
  env.CASHFREE_ENV = 'TEST';

  return {
    ...state,
    state,
    restore() {
      globalThis.fetch = original;
      delete env.CASHFREE_APP_ID;
      delete env.CASHFREE_SECRET_KEY;
      delete env.CASHFREE_ENV;
    },
  };
}
