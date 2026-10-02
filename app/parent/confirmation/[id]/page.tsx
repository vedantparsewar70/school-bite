'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Printer,
  ArrowRight,
  UtensilsCrossed,
  Calendar,
  CreditCard,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { formatINR, formatDateTimePretty, formatDatePretty } from '@/lib/utils';
import VegBadge from '@/components/VegBadge';
import OrderReceiptModal from '@/components/OrderReceiptModal';

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  useEffect(() => {
    // Trigger celebratory confetti on mount
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      console.log('Confetti failed to run', e);
    }

    async function loadOrder() {
      try {
        const res = await fetch('/api/parent/orders');
        if (res.ok) {
          const data = await res.json();
          const match = data.orders?.find((o: any) => o.id === orderId);
          if (match) {
            setOrder(match);
          }
        }
      } catch (err) {
        console.error('Failed to load confirmed order:', err);
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const primaryPayment = order?.payments?.[0];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Celebration Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-500/10 mb-2">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Payment Successful! 🎉
        </h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Your child's school lunch has been confirmed. The canteen team will prepare hot portions fresh on the selected dates.
        </p>
      </div>

      {/* Confirmation Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xl space-y-6">
        {/* Order Meta Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-100 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Order ID</span>
            <p className="font-mono font-extrabold text-slate-900 text-sm">{orderId}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Payment ID</span>
            <p className="font-mono font-semibold text-slate-800 text-xs">{primaryPayment?.id || 'PAY-CONFIRMED'}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Paid</span>
            <p className="font-black text-amber-700 text-sm">{formatINR(order?.totalAmount || 0)}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
            <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
              CONFIRMED
            </span>
          </div>
        </div>

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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={() => setIsReceiptModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-amber-400 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-500" />
            <span>Download / Print Receipt</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <Link
              href="/parent/orders"
              className="w-full sm:w-auto text-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              View Order History
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
      </div>

      {/* Receipt Modal */}
      {isReceiptModalOpen && order && (
        <OrderReceiptModal order={order} onClose={() => setIsReceiptModalOpen(false)} />
      )}
    </div>
  );
}
