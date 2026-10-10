'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Clock,
  Calendar,
  Eye,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  UtensilsCrossed,
} from 'lucide-react';
import { useToast } from '@/components/ToastContext';
import { useAuth } from '@/components/AuthContext';
import { useSyncWatcher } from '@/lib/client-sync';
import VegBadge from '@/components/VegBadge';
import ChildAvatar from '@/components/ChildAvatar';
import MealIcon from '@/components/MealIcon';
import {
  formatINR,
  formatDatePretty,
  formatDateTimePretty,
  getOrderStatusColor,
} from '@/lib/utils';

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const highlightedOrderId = searchParams.get('orderId');

  const { refreshUser } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/parent/orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Live real-time synchronization: updates order status immediately when canteen staff marks it as Given/Collected
  useSyncWatcher({
    onOrdersUpdate: () => {
      fetchOrders(true);
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-amber-500" />
            <span>Order History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            All your placed school lunch orders and payments.
          </p>
        </div>

        <Link
          href="/parent/menu"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-amber-500/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Order Lunch</span>
        </Link>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4 max-w-md mx-auto">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Orders Placed Yet</h3>
          <p className="text-xs text-slate-500">
            You have not placed any meal orders yet. Choose from our fresh lunch menu!
          </p>
          <Link
            href="/parent/menu"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Order Lunch Now</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusStyle = getOrderStatusColor(order.orderStatus);
            const isHighlighted = order.id === highlightedOrderId;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl p-5 sm:p-6 border transition-all ${
                  isHighlighted ? 'border-amber-400 ring-2 ring-amber-300/30' : 'border-slate-100 shadow-sm'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {order.id}
                    </span>
                    <span className="text-xs text-slate-400">
                      Ordered: {formatDateTimePretty(order.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusStyle.bg}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${statusStyle.badge}`} />
                      <span>{statusStyle.text}</span>
                    </span>

                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                      Paid: {formatINR(order.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Items in this order */}
                <div className="py-3 divide-y divide-slate-100">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-start sm:items-center justify-between text-xs gap-3">
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div className="shrink-0 mt-0.5 sm:mt-0">
                          <MealIcon name={item.mealName} category={item.mealCategory} size="sm" />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <VegBadge isVegetarian={item.isVegetarian} size="sm" />
                            <span className="font-bold text-slate-800 text-sm leading-snug break-words">{item.mealName}</span>
                            <span className="text-slate-400 font-semibold">× {item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                            <ChildAvatar size="xs" />
                            <span className="break-words">
                              For: <strong className="text-slate-700">{item.studentName}</strong> (Class {item.studentGrade}-{item.studentDivision}, Roll: {item.studentRollNo})
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-amber-700">
                            Scheduled for: {formatDatePretty(item.date)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pt-0.5 sm:pt-0">
                        <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">{formatINR(item.totalPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Info */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-slate-400 text-[11px]">
                    Payment Ref: {order.payments?.[0]?.transactionRef || 'PAID'} • {order.payments?.[0]?.paymentMethod || 'UPI'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center">Loading orders...</div>}>
      <OrdersPageContent />
    </Suspense>
  );
}
