import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { isDeadlinePassed } from '@/lib/utils';
import { CartItem, PaymentMethod } from '@/types';
import { checkMealAllergy, getSystemSetting } from '@/lib/allergy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'PARENT' || !user.parentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: { parentId: user.parentId },
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
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        studentId: item.studentId,
        studentName: item.student.name,
        studentGrade: item.student.grade,
        studentDivision: item.student.division,
        studentRollNo: item.student.rollNo,
        mealId: item.mealId,
        mealName: item.meal.name,
        mealCategory: item.meal.category,
        mealImage: item.meal.imageUrl,
        isVegetarian: item.meal.isVegetarian,
        date: item.date,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        hasAllergyAlert: item.hasAllergyAlert,
        conflictAllergens: item.conflictAllergens,
      })),
      payments: order.payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        status: p.status,
        transactionRef: p.transactionRef,
        upiId: p.upiId,
        cardLastFour: p.cardLastFour,
        bankName: p.bankName,
        createdAt: p.createdAt.toISOString(),
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

    // Check parent record and wallet balance
    const parentRecord = await prisma.parent.findUnique({
      where: { id: user.parentId },
    });
    if (!parentRecord) {
      return NextResponse.json({ error: 'Parent record not found' }, { status: 404 });
    }

    // Verify all students belong to this parent
    const parentStudents = await prisma.student.findMany({
      where: { parentId: user.parentId, isActive: true },
    });
    const parentStudentIds = new Set(parentStudents.map((s) => s.id));

    for (const item of cartItems) {
      if (!parentStudentIds.has(item.studentId)) {
        return NextResponse.json(
          { error: `Unauthorized child selection for student ${item.studentName}` },
          { status: 403 }
        );
      }
    }

    // Validate deadlines and available stock for each menu item
    for (const item of cartItems) {
      const menu = await prisma.menu.findUnique({
        where: {
          mealId_date: {
            mealId: item.mealId,
            date: item.date,
          },
        },
      });

      if (!menu || !menu.isActive) {
        return NextResponse.json(
          { error: `Meal "${item.mealName}" is not available on ${item.date}` },
          { status: 400 }
        );
      }

      if (isDeadlinePassed(item.date, menu.orderingDeadline)) {
        return NextResponse.json(
          {
            error: `Ordering deadline (${menu.orderingDeadline}) for "${item.mealName}" on ${item.date} has passed.`,
          },
          { status: 400 }
        );
      }

      if (menu.availableQuantity < item.quantity) {
        return NextResponse.json(
          {
            error: `Not enough portions available for "${item.mealName}" on ${item.date}. Only ${menu.availableQuantity} left.`,
          },
          { status: 400 }
        );
      }
    }

    // Evaluate allergy status for all items in the cart
    const evaluatedCartItems = await Promise.all(
      cartItems.map(async (item) => {
        const allergyResult = await checkMealAllergy(item.studentId, item.mealId);
        return {
          ...item,
          hasAllergyAlert: allergyResult.hasConflict,
          conflictAllergens: allergyResult.matchingAllergens.join(', ') || null,
        };
      })
    );

    // Verify school allergy policy
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

    // Calculate total amount
    const totalAmount = cartItems.reduce(
      (acc, it) => acc + Number(it.mealPrice ?? (it as any).price ?? (it as any).meal?.price ?? 0) * it.quantity,
      0
    );

    // Validate payment credentials
    if (paymentMethod === 'UPI' && upiId && !upiId.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid UPI ID format (e.g. mobile@upi or username@okbank)' },
        { status: 400 }
      );
    }

    // Generate IDs
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = idempotencyKey ? idempotencyKey : `ORD-2026-${randomSuffix}`;
    const paymentId = `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const txnRef =
      paymentMethod === 'UPI'
        ? `UPI-${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`
        : paymentMethod === 'CARD'
        ? `CARD-${Date.now().toString().slice(-8)}`
        : `NETB-${Date.now().toString().slice(-8)}`;

    // Execute atomic transaction: create Order, OrderItems, Payment, and decrement stock
    const result = await prisma.$transaction(async (tx) => {

      // Decrement availableQuantity for each menu item
      for (const item of cartItems) {
        await tx.menu.update({
          where: {
            mealId_date: {
              mealId: item.mealId,
              date: item.date,
            },
          },
          data: {
            availableQuantity: { decrement: item.quantity },
          },
        });
      }

      // Create Order
      const newOrder = await tx.order.create({
        data: {
          id: orderId,
          parentId: parentRecord.id,
          totalAmount,
          paymentStatus: 'PAID',
          orderStatus: 'CONFIRMED',
          notes: notes || null,
          items: {
            create: evaluatedCartItems.map((item) => {
              const uPrice = Number(item.mealPrice ?? (item as any).price ?? (item as any).meal?.price ?? 0);
              return {
                studentId: item.studentId,
                mealId: item.mealId,
                date: item.date,
                quantity: item.quantity,
                unitPrice: uPrice,
                totalPrice: uPrice * item.quantity,
                hasAllergyAlert: item.hasAllergyAlert || false,
                conflictAllergens: item.conflictAllergens || null,
              };
            }),
          },
          payments: {
            create: {
              id: paymentId,
              amount: totalAmount,
              paymentMethod,
              status: 'SUCCESS',
              transactionRef: txnRef,
              upiId: upiId || null,
              cardLastFour: cardLastFour || (paymentMethod === 'CARD' ? '4242' : null),
              bankName: bankName || (paymentMethod === 'NET_BANKING' ? 'State Bank of India' : null),
            },
          },
        },
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

      return newOrder;
    });

    return NextResponse.json({
      success: true,
      orderId: result.id,
      paymentId,
      transactionRef: txnRef,
      totalAmount,
      order: result,
    });
  } catch (error) {
    console.error('Error placing order:', error);
    return NextResponse.json({ error: 'Failed to process order' }, { status: 500 });
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
    for (const item of order.items) {
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

    // Atomic cancellation: update status, restore available stock, and refund wallet if applicable
    await prisma.$transaction(async (tx) => {
      // 1. Update order status
      await tx.order.update({
        where: { id: order.id },
        data: {
          orderStatus: 'CANCELLED',
          paymentStatus: 'REFUNDED',
        },
      });

      // 2. Restore available quantities
      for (const item of order.items) {
        await tx.menu.updateMany({
          where: {
            mealId: item.mealId,
            date: item.date,
          },
          data: {
            availableQuantity: { increment: item.quantity },
          },
        });
      }

    });

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} cancelled successfully and ₹${order.totalAmount} refunded to your original payment source.`,
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  }
}
