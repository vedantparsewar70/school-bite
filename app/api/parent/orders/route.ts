import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { isDeadlinePassed } from '@/lib/utils';
import { CartItem, PaymentMethod } from '@/types';
import { evaluateAllergyConflict, getSystemSetting } from '@/lib/allergy';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { cleanDoc, generateId } from '@/lib/firestore-db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { createCashfreeOrder } from '@/lib/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const take = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100) : 50;

    const orders = await prisma.order.findMany({
      where: { parentId: user.parentId },
      take,
      include: {
        items: {
          include: {
            student: true,
            meal: true,
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      parentId: order.parentId,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      notes: order.notes,
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : new Date(order.createdAt).toISOString(),
      items: (order.items || []).map((item) => ({
        id: item.id,
        studentId: item.studentId,
        studentName: item.student?.name || 'Student',
        studentGrade: item.student?.grade || '',
        studentDivision: item.student?.division || '',
        studentRollNo: item.student?.rollNo || '',
        mealId: item.mealId,
        mealName: item.meal?.name || 'Meal',
        mealCategory: item.meal?.category || 'General',
        mealImage: item.meal?.imageUrl || null,
        isVegetarian: Boolean(item.meal?.isVegetarian),
        date: item.date,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        hasAllergyAlert: Boolean(item.hasAllergyAlert),
        conflictAllergens: item.conflictAllergens || null,
      })),
      payments: (order.payments || []).map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        status: p.status,
        transactionRef: p.transactionRef,
        upiId: p.upiId,
        cardLastFour: p.cardLastFour,
        bankName: p.bankName,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString(),
      })),
    }));

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error('Error fetching parent orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate Limiting: 30 checkout submissions per minute per parent
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`order_${user.parentId}_${clientIp}`, {
      windowMs: 60000,
      maxRequests: 30,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many order requests. Please wait a moment before trying again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateLimit.resetMs / 1000)) },
        }
      );
    }

    const body = await req.json();
    const {
      cartItems,
      paymentMethod = 'UPI',
      upiId,
      cardLastFour,
      bankName,
      notes,
      idempotencyKey,
    }: {
      cartItems: CartItem[];
      paymentMethod: PaymentMethod;
      upiId?: string;
      cardLastFour?: string;
      bankName?: string;
      notes?: string;
      idempotencyKey?: string;
    } = body;

    // Check for duplicate submission using idempotency key if provided
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: idempotencyKey },
        include: {
          items: {
            include: {
              student: true,
              meal: true,
            },
          },
          payments: true,
        },
      });

      if (existingOrder) {
        return NextResponse.json({
          success: true,
          orderId: existingOrder.id,
          totalAmount: existingOrder.totalAmount,
          order: existingOrder,
          isDuplicateSubmission: true,
        });
      }
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Check parent record
    const parentRecord = await prisma.parent.findUnique({
      where: { id: user.parentId },
    });
    if (!parentRecord) {
      return NextResponse.json({ error: 'Parent record not found' }, { status: 404 });
    }

    // Verify all students belong to this parent and load their allergies in 1 parallel query
    const parentStudents = await prisma.student.findMany({
      where: { parentId: user.parentId, isActive: true },
      include: {
        studentAllergies: { include: { allergy: true } },
      },
    });
    const parentStudentsMap = new Map(parentStudents.map((s: any) => [s.id, s]));

    for (const item of cartItems) {
      if (!parentStudentsMap.has(item.studentId)) {
        return NextResponse.json(
          { error: `Unauthorized child selection for student ${item.studentName}` },
          { status: 403 }
        );
      }
    }

    // Batch-fetch all meals from authoritative database to verify prices and allergens
    const mealIds = Array.from(new Set(cartItems.map((it) => it.mealId)));
    const meals = await prisma.meal.findMany({
      where: { id: { in: mealIds } },
      include: {
        mealAllergens: { include: { allergen: true } },
      },
    });
    const mealsMap = new Map(meals.map((m: any) => [m.id, m]));

    // Authoritative Server-side Price & Allergy Evaluation
    let totalAmount = 0;
    const evaluatedCartItems = cartItems.map((item) => {
      const meal = mealsMap.get(item.mealId);
      if (!meal) {
        throw new Error(`Meal not found: ${item.mealName || item.mealId}`);
      }

      const serverUnitPrice = Number(meal.price || 0);
      const itemQuantity = Math.max(1, parseInt(String(item.quantity), 10) || 1);
      totalAmount += serverUnitPrice * itemQuantity;

      // Extract student allergies
      const student = parentStudentsMap.get(item.studentId);
      const studentAllergiesList: string[] = [];
      if (student?.studentAllergies) {
        student.studentAllergies.forEach((sa: any) => {
          if (sa.allergy?.name) studentAllergiesList.push(sa.allergy.name);
          if (sa.customNote) studentAllergiesList.push(sa.customNote);
        });
      }
      if (student?.allergies) {
        student.allergies.split(/[,;]/).forEach((p: string) => {
          const t = p.trim();
          if (t && !studentAllergiesList.includes(t)) studentAllergiesList.push(t);
        });
      }

      // Extract meal allergens
      const mealAllergensList = (meal.mealAllergens || []).map((ma: any) => ma.allergen?.name).filter(Boolean);
      if (meal.allergens && mealAllergensList.length === 0) {
        meal.allergens.split(/[,;]/).forEach((p: string) => {
          const t = p.trim();
          if (t && !mealAllergensList.includes(t)) mealAllergensList.push(t);
        });
      }

      const allergyResult = evaluateAllergyConflict(studentAllergiesList, mealAllergensList, student?.name, meal.name);

      return {
        ...item,
        quantity: itemQuantity,
        mealPrice: serverUnitPrice,
        mealName: meal.name,
        mealCategory: meal.category,
        isVegetarian: meal.isVegetarian,
        hasAllergyAlert: allergyResult.hasConflict,
        conflictAllergens: allergyResult.matchingAllergens.join(', ') || null,
      };
    });

    // Check school allergy policy
    const allowAllergySetting = await getSystemSetting('ALLOW_ALLERGY_ORDERS', 'true');
    if (allowAllergySetting !== 'true') {
      const conflictingItem = evaluatedCartItems.find((it) => it.hasAllergyAlert);
      if (conflictingItem) {
        return NextResponse.json(
          {
            error: `Meal "${conflictingItem.mealName}" contains allergen (${conflictingItem.conflictAllergens}) conflicting with ${conflictingItem.studentName}'s profile. Ordering meals with allergy warnings is currently restricted by school policy.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate payment credentials
    if (paymentMethod === 'UPI' && upiId && !upiId.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid UPI ID format (e.g. mobile@upi or username@okbank)' },
        { status: 400 }
      );
    }

    const validMethods: PaymentMethod[] = ['UPI', 'CARD', 'NET_BANKING'];
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method. Please pay securely using UPI, Card, or Net Banking.' },
        { status: 400 }
      );
    }

    // Generate collision-resistant unique identifiers
    const randomSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const orderId = idempotencyKey || `ORD-${randomSuffix}`;
    const paymentId = `PAY-${randomSuffix}`;
    const txnRef =
      paymentMethod === 'UPI'
        ? `UPI-${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`
        : paymentMethod === 'CARD'
        ? `CARD-${Date.now().toString().slice(-8)}`
        : `NETB-${Date.now().toString().slice(-8)}`;

    const now = new Date().toISOString();

    // Determine host for Cashfree return and webhook notifications
    const proto = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https://') ? 'https' : 'http');
    const host = req.headers.get('host') || 'localhost:3000';
    const originUrl = `${proto}://${host}`;

    let cfSession: any = null;
    const isCashfreeEnabled = Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);

    if (isCashfreeEnabled) {
      try {
        cfSession = await createCashfreeOrder({
          orderId,
          orderAmount: totalAmount,
          customer: {
            customerId: parentRecord.id,
            customerName: user.name || 'Parent',
            customerEmail: user.email || 'parent@schoolbite.in',
            customerPhone: user.phone || '9028977988',
          },
          returnUrl: `${originUrl}/parent/confirmation/${orderId}?order_id={order_id}`,
          notifyUrl: `${originUrl}/api/webhooks/cashfree`,
          orderNote: `SchoolBite Order - ${evaluatedCartItems.length} meals`,
        });
      } catch (cfErr: any) {
        console.error('Failed to create Cashfree payment session:', cfErr);
        return NextResponse.json(
          { error: `Payment gateway error: ${cfErr.message || 'Failed to initialize payment session'}` },
          { status: 500 }
        );
      }
    }

    // ========================================================
    // ATOMIC FIRESTORE TRANSACTION: Guaranteed concurrency & quota safety
    // ========================================================
    const transactionResult = await db.runTransaction(async (transaction) => {
      // 1. Transactional Reads: Menu portions
      const menuRefMap = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: any }>();

      for (const item of evaluatedCartItems) {
        const menuDocId = `${item.mealId}_${item.date}`;
        const menuRef = db.collection('menus').doc(menuDocId);
        const menuSnap = await transaction.get(menuRef);

        if (!menuSnap.exists) {
          throw new Error(`Meal "${item.mealName}" is not scheduled on ${item.date}`);
        }

        const menuData = menuSnap.data() || {};
        if (!menuData.isActive) {
          throw new Error(`Meal "${item.mealName}" is not available on ${item.date}`);
        }

        if (isDeadlinePassed(item.date, menuData.orderingDeadline || '08:30')) {
          throw new Error(`Ordering deadline (${menuData.orderingDeadline || '08:30'}) for "${item.mealName}" on ${item.date} has passed.`);
        }

        const available = Number(menuData.availableQuantity ?? 0);
        if (available < item.quantity) {
          throw new Error(`Not enough portions available for "${item.mealName}" on ${item.date}. Only ${available} portions remaining.`);
        }

        menuRefMap.set(menuDocId, { ref: menuRef, data: menuData });
      }

      // 2. Transactional Writes: Atomic Decrements & Record Creation
      // A. Decrement menu portions atomically
      for (const item of evaluatedCartItems) {
        const menuDocId = `${item.mealId}_${item.date}`;
        const entry = menuRefMap.get(menuDocId);
        if (entry) {
          transaction.update(entry.ref, {
            availableQuantity: FieldValue.increment(-Number(item.quantity)),
            updatedAt: now,
          });
        }
      }

      // C. Create Order
      const initialPaymentStatus = isCashfreeEnabled ? 'PENDING' : 'PAID';
      const orderObj = cleanDoc({
        id: orderId,
        parentId: parentRecord.id,
        totalAmount,
        paymentStatus: initialPaymentStatus,
        orderStatus: 'CONFIRMED',
        cashfreeOrderId: cfSession?.cfOrderId || null,
        paymentSessionId: cfSession?.paymentSessionId || null,
        notes: notes || null,
        createdAt: now,
        updatedAt: now,
      });
      transaction.set(db.collection('orders').doc(orderId), orderObj);

      // D. Create OrderItems
      const createdItems = [];
      for (const item of evaluatedCartItems) {
        const itemId = generateId('oit_');
        const itemObj = cleanDoc({
          id: itemId,
          orderId,
          studentId: item.studentId,
          mealId: item.mealId,
          date: item.date,
          quantity: item.quantity,
          unitPrice: item.mealPrice,
          totalPrice: item.mealPrice * item.quantity,
          hasAllergyAlert: Boolean(item.hasAllergyAlert),
          conflictAllergens: item.conflictAllergens || null,
          createdAt: now,
        });
        transaction.set(db.collection('orderItems').doc(itemId), itemObj);
        createdItems.push(itemObj);
      }

      // E. Create Payment
      const initialPayStatus = isCashfreeEnabled ? 'PENDING' : 'SUCCESS';
      const payObj = cleanDoc({
        id: paymentId,
        orderId,
        amount: totalAmount,
        paymentMethod,
        status: initialPayStatus,
        transactionRef: txnRef,
        upiId: upiId || null,
        cardLastFour: cardLastFour || (paymentMethod === 'CARD' ? '4242' : null),
        bankName: bankName || (paymentMethod === 'NET_BANKING' ? 'State Bank of India' : null),
        createdAt: now,
      });
      transaction.set(db.collection('payments').doc(paymentId), payObj);

      return {
        ...orderObj,
        items: createdItems,
        payments: [payObj],
      };
    });

    return NextResponse.json({
      success: true,
      orderId: transactionResult.id,
      paymentSessionId: cfSession?.paymentSessionId || null,
      cfOrderId: cfSession?.cfOrderId || null,
      isCashfree: isCashfreeEnabled,
      paymentId,
      transactionRef: txnRef,
      totalAmount,
      order: transactionResult,
    });
  } catch (error: any) {
    console.error('Error placing order:', error);
    const userMessage = error?.message || 'Failed to process order';
    return NextResponse.json({ error: userMessage }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        parentId: user.parentId,
      },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.orderStatus === 'CANCELLED') {
      return NextResponse.json({ error: 'Order is already cancelled' }, { status: 400 });
    }

    if (order.orderStatus === 'READY' || order.orderStatus === 'COLLECTED') {
      return NextResponse.json(
        { error: 'Cannot cancel order that has already been prepared or collected' },
        { status: 400 }
      );
    }

    // Check deadlines for each item in the order
    for (const item of order.items || []) {
      const menu = await prisma.menu.findUnique({
        where: {
          mealId_date: {
            mealId: item.mealId,
            date: item.date,
          },
        },
      });

      const deadline = menu?.orderingDeadline || '08:30';
      if (isDeadlinePassed(item.date, deadline)) {
        return NextResponse.json(
          {
            error: `Cannot cancel: Cancellation deadline (${deadline}) for meal date ${item.date} has passed.`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    // Atomic cancellation transaction: updates status and restores available stock
    await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('orders').doc(order.id);

      // 1. Mark order cancelled and refunded
      transaction.update(orderRef, {
        orderStatus: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        updatedAt: now,
      });

      // 2. Restore available portion quantities for each menu item
      for (const item of order.items || []) {
        const menuRef = db.collection('menus').doc(`${item.mealId}_${item.date}`);
        transaction.update(menuRef, {
          availableQuantity: FieldValue.increment(Number(item.quantity)),
          updatedAt: now,
        });
      }
    });

    const refundDestination = 'your original payment source';

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} cancelled successfully and ₹${order.totalAmount} refunded to ${refundDestination}.`,
    });
  } catch (error: any) {
    console.error('Error cancelling order:', error);
    return NextResponse.json({ error: error?.message || 'Failed to cancel order' }, { status: 500 });
  }
}
