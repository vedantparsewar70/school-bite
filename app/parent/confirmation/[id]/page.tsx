'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  ArrowRight,
  UtensilsCrossed,
  Calendar,
  CreditCard,
  FileText,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { formatINR, formatDateTimePretty, formatDatePretty } from '@/lib/utils';
import VegBadge from '@/components/VegBadge';
import { useCart } from '@/components/CartContext';

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const { clearCart } = useCart();

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const loadAndVerifyOrder = async () => {
    if (!orderId) return;
    setVerifying(true);
    try {
      // 1. Trigger server verification with Cashfree API
      try {
        await fetch('/api/parent/orders/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
      } catch {
        // Continue to query order
      }

      // 2. Fetch updated order
      const res = await fetch('/api/parent/orders');
      if (res.ok) {
        const data = await res.json();
        const match = data.orders?.find((o: any) => o.id === orderId);
        if (match) {
          setOrder(match);
          if (match.paymentStatus === 'PAID') {
            clearCart();
            // Confetti for successful payment
            try {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
              });
            } catch {
              // Ignore confetti error
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load order:', err);
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadAndVerifyOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Verifying payment with Cashfree...</p>
      </div>
    );
  }

  const isPaid = order?.paymentStatus === 'PAID';
  const isPending = order?.paymentStatus === 'PENDING';
  const isFailed = order?.paymentStatus === 'FAILED';
  const primaryPayment = order?.payments?.[0];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Celebration or Status Header */}
      <div className="text-center space-y-3">
        {isPaid ? (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-500/10 mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Order Confirmed & Paid
            </h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Your meal order has been verified via Cashfree and scheduled with the S.B. Patil School canteen.
            </p>
          </>
        ) : isPending ? (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 shadow-lg shadow-amber-500/10 mb-2">
              <RefreshCw className="w-9 h-9 animate-spin" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Payment Awaiting Confirmation
            </h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Your payment is being confirmed with the bank. If you just completed payment, click below to verify status.
            </p>
            <button
              onClick={loadAndVerifyOrder}
              disabled={verifying}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Check Payment Status</span>
            </button>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 shadow-lg shadow-rose-500/10 mb-2">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Payment Incomplete
            </h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              The payment was not completed on Cashfree. You can return to checkout and retry your order.
            </p>
            <Link
              href="/parent/cart"
              className="mt-2 inline-block px-5 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md hover:bg-amber-600"
            >
              Return to Cart & Retry
            </Link>
          </>
        )}
      </div>

      {/* Confirmation Card: Only rendered when payment is successfully confirmed and order exists */}
      {isPaid && order ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xl space-y-6">
        {/* Order Meta Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-3.5 sm:p-4 rounded-2xl bg-amber-50/60 border border-amber-100 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Order ID</span>
            <p className="font-mono font-extrabold text-slate-900 text-sm truncate">{orderId}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Child Name</span>
            <p className="font-extrabold text-slate-800 text-xs truncate">
              {order?.items?.[0]?.studentName || 'Student'}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Meal Date</span>
            <p className="font-extrabold text-slate-800 text-xs truncate">
              {order?.items?.[0]?.date ? formatDatePretty(order.items[0].date) : 'Tomorrow'}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Amount</span>
            <p className="font-black text-amber-700 text-sm">{formatINR(order?.totalAmount || 0)}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Payment Status</span>
            <span
              className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                isPaid
                  ? 'bg-emerald-100 text-emerald-800'
                  : isPending
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {order?.paymentStatus || 'PENDING'}
            </span>
          </div>
        </div>

        {/* Transaction Reference (Cashfree) */}
        {primaryPayment?.transactionRef && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-700">Cashfree Transaction Ref:</span>
              <span className="font-mono text-slate-900 font-semibold">{primaryPayment.transactionRef}</span>
            </div>
            <span className="text-[11px] text-slate-400">Secured by Cashfree Payments</span>
          </div>
        )}

        {/* Ordered Meals Breakdown */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
            Meals Scheduled ({order?.items?.length || 0})
          </h3>

          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
            {order?.items?.map((item: any, idx: number) => (
              <div key={idx} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <VegBadge isVegetarian={item.isVegetarian !== false} size="sm" />
                    <span className="font-bold text-slate-900 text-sm">{item.mealName}</span>
                    <span className="text-slate-400 font-semibold">× {item.quantity}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    For: <strong className="text-slate-700">{item.studentName}</strong> (Class {item.studentGrade}-{item.studentDivision}, Roll: {item.studentRollNo})
                  </div>
                  <div className="text-[11px] font-semibold text-amber-700">
                    Meal Date: {formatDatePretty(item.date)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-slate-900">{formatINR(item.totalPrice)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100">
          <Link
            href="/parent/children"
            className="w-full sm:w-auto text-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            My Children
          </Link>
          <Link
            href="/parent/orders"
            className="w-full sm:w-auto text-center px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors"
          >
            Order History
          </Link>
          <Link
            href="/parent/menu"
            className="w-full sm:w-auto text-center px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <span>Order More</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
      ) : null}
    </div>
  );
}
