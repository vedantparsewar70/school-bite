import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { cleanDoc, generateId } from '@/lib/firestore-db';
import { createCashfreeOrder } from '@/lib/cashfree';
import { savePendingTeacherOrder } from '@/lib/order-fulfillment';
import { getTodayString } from '@/lib/utils';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`teacher_order_${clientIp}`, {
      maxRequests: 30,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many order attempts. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { teacherName, teacherPhone, notes, items } = body;

    const cleanTeacherName = (teacherName || '').trim();
    if (!cleanTeacherName) {
      return NextResponse.json({ error: 'Please enter your name to place the order' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty. Please select food items.' }, { status: 400 });
    }

    // Validate and compute total
    let totalAmount = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const qty = parseInt(item.quantity, 10);
      const price = parseFloat(item.price);
      if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
        return NextResponse.json({ error: 'Invalid items in cart' }, { status: 400 });
      }

      const itemTotal = Math.round(qty * price * 100) / 100;
      totalAmount += itemTotal;

      orderItems.push({
        id: generateId('TCI-'),
        mealId: item.mealId,
        mealName: item.mealName,
        category: item.category || 'LUNCH',
        isVegetarian: Boolean(item.isVegetarian),
        quantity: qty,
        unitPrice: price,
        totalPrice: itemTotal,
      });
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    const todayStr = getTodayString();
    // Unique order ID, e.g. TCH-629814
    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `TCH-${uniqueSuffix}`;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const returnUrl = `${appUrl}/teacher/confirmation/${orderId}?cf_id={order_id}`;

    // Clean phone
    let phone = (teacherPhone || '').replace(/\D/g, '');
    if (phone.length > 10) phone = phone.slice(-10);
    if (phone.length < 10) phone = '9999999999';

    // Create Cashfree session
    let paymentSessionId = '';
    let cfOrderId = '';

    try {
      const cfResponse = await createCashfreeOrder({
        orderId,
        orderAmount: totalAmount,
        customer: {
          customerId: `teacher_${cleanTeacherName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30)}`,
          customerName: cleanTeacherName,
          customerEmail: 'teacher@schoolbite.in',
          customerPhone: phone,
        },
        returnUrl,
        orderNote: `Teacher Meal Order - ${cleanTeacherName}`,
      });

      paymentSessionId = cfResponse.paymentSessionId;
      cfOrderId = cfResponse.cfOrderId;
    } catch (cfErr: any) {
      console.error('[Cashfree Error in Teacher Order]:', cfErr.message || cfErr);
      return NextResponse.json(
        { error: 'Payment gateway is currently unavailable. Please try again shortly.' },
        { status: 502 }
      );
    }

    const now = new Date().toISOString();
    // Strictly DO NOT create order in 'teacher_orders' until payment is verified as PAID!
    await savePendingTeacherOrder({
      id: orderId,
      orderType: 'TEACHER',
      teacherName: cleanTeacherName,
      teacherPhone: phone,
      totalAmount,
      date: todayStr,
      paymentMethod: 'ONLINE',
      cashfreeOrderId: cfOrderId,
      paymentSessionId,
      notes: notes?.trim() || null,
      items: orderItems,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      orderId,
      paymentSessionId,
      totalAmount,
    });
  } catch (error) {
    console.error('Error placing teacher order:', error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
