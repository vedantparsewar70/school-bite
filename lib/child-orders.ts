import type { Firestore } from 'firebase-admin/firestore';

/**
 * One brunch per child per day, and at most 3 of each extra per child per day, across ALL of a
 * family's orders. Checked at checkout (refused before paying) and again inside the payment step
 * (two checkouts paid at the same time), where a conflict becomes an automatically refunded payment
 * exception, like a sold-out meal.
 */

type Reader = (target: any) => Promise<any>;

export interface CartLineLike {
  studentId?: string;
  studentName?: string;
  mealId: string;
  mealName?: string;
  date: string;
  quantity?: number;
  kind?: string;
}

/** Paid, not-cancelled order lines of these children on these dates (one query per child; no composite index). */
export async function paidLinesForChildren(read: Reader, firestore: Firestore, studentIds: string[], dates: string[]): Promise<any[]> {
  const wanted = new Set(dates);
  const lines: any[] = [];
  for (const studentId of Array.from(new Set(studentIds.filter(Boolean)))) {
    const snap = await read(firestore.collection('orderItems').where('studentId', '==', studentId));
    for (const d of snap.docs as Array<{ id: string; data: () => any }>) {
      const it = { ...d.data(), id: d.id };
      if (wanted.has(String(it.date))) lines.push(it);
    }
  }
  const paid = new Set<string>();
  for (const orderId of Array.from(new Set(lines.map((it) => String(it.orderId || '')).filter(Boolean)))) {
    const snap = await read(firestore.collection('orders').doc(orderId));
    const o = snap.exists ? snap.data() : null;
    if (o && o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED') paid.add(orderId);
  }
  return lines.filter((it) => paid.has(String(it.orderId)));
}

/** The first rule the cart would break given the children's earlier paid lines, or null. */
export function cartConflict(cart: CartLineLike[], earlier: any[]): { detail: string; message: string } | null {
  const name = (l: CartLineLike) => (l.studentName ? String(l.studentName).split(' ')[0] : 'This child');
  for (const l of cart) {
    if (l.kind === 'EXTRA') continue;
    const dup = earlier.find((e) => e.kind !== 'EXTRA' && e.studentId === l.studentId && e.date === l.date);
    if (dup) {
      return {
        detail: `child ${l.studentId} already has a paid brunch on ${l.date}`,
        message: `${name(l)} already has a paid brunch on ${l.date}. Please remove it from the cart.`,
      };
    }
  }
  return null;
}
