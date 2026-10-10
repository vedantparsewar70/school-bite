'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import { formatINR, formatDatePretty } from '@/lib/utils';

export default function TeacherConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        // Also trigger verification in case redirect happened fast
        const verifyRes = await fetch('/api/teacher/orders/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        }).catch(() => null);

        if (verifyRes && verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.verified) {
            const res = await fetch(`/api/teacher/orders/${orderId}`);
            if (res.ok) {
              const data = await res.json();
              setOrder(data.order);
              return;
            }
          }
        }

        const res = await fetch(`/api/teacher/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
        }
      } catch (err) {
        console.error('Failed to load teacher order:', err);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 py-8 px-4 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Verifying payment status...</p>
        </div>
      </div>
    );
  }

  const isPaid = order?.paymentStatus === 'PAID';

  if (!isPaid) {
    return (
      <div className="min-h-screen bg-slate-50/70 py-8 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <AlertCircle className="w-9 h-9" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
              <span>Payment Incomplete</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              No Order Created
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              The payment was not completed or was cancelled. Strictly no order was placed with the canteen.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/teacher/menu"
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>Return to Menu & Retry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Success Header */}
        <div className="space-y-2">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Payment Received • Order Confirmed</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Order Placed Successfully!
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Order ID: <strong className="text-slate-800 font-bold">{orderId}</strong>
          </p>
        </div>

        {/* Big Counter Collection Card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 p-5 rounded-2xl text-left space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900">
              Canteen Pickup
            </span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              PAID
            </span>
          </div>
          <div>
            <span className="text-xs text-amber-800 font-medium block">Collection Name:</span>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : order?.teacherName || 'Teacher'}
            </p>
          </div>
          <div className="pt-2 border-t border-amber-200/80 text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Tell this name at the canteen counter to collect your food.</span>
          </div>
        </div>

        {/* Items Summary */}
        {order && order.items && (
          <div className="text-left space-y-2 border border-slate-200 rounded-2xl p-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
              Ordered Items
            </span>
            <div className="divide-y divide-slate-100">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <VegBadge isVegetarian={item.isVegetarian} size="sm" />
                    <div>
                      <span className="font-bold text-slate-800">{item.mealName}</span>
                      <span className="text-slate-500 ml-1.5 font-medium">x {item.quantity}</span>
                    </div>
                  </div>
                  <span className="font-black text-slate-800">
                    {formatINR(item.totalPrice || item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
              <span className="font-black text-slate-800">Total Paid</span>
              <span className="font-black text-amber-600 text-base">
                {formatINR(order.totalAmount || 0)}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 space-y-2">
          <Link
            href="/teacher/menu"
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <span>Order Another Meal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
