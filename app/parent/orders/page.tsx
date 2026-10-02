'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Clock,
  Calendar,
  Eye,
  XCircle,
  CheckCircle2,
  Printer,
  AlertCircle,
  Search,
  Filter,
} from 'lucide-react';
import { useToast } from '@/components/ToastContext';
import { useAuth } from '@/components/AuthContext';
import VegBadge from '@/components/VegBadge';
import ChildAvatar from '@/components/ChildAvatar';
import MealIcon from '@/components/MealIcon';
import OrderReceiptModal from '@/components/OrderReceiptModal';
import {
  formatINR,
  formatDatePretty,
  formatDateTimePretty,
  getOrderStatusColor,
  isDeadlinePassed,
} from '@/lib/utils';

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const highlightedOrderId = searchParams.get('orderId');

  const { refreshUser } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/parent/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancelOrder = async (order: any) => {
    // Check if cancellation deadline has passed
    const canCancel = !order.items.some((it: any) => isDeadlinePassed(it.date, '08:30'));
    if (!canCancel) {
      showToast('Cannot cancel order: The cancellation deadline (08:30 AM) for one or more meals has passed.', 'error');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to cancel Order ${order.id}? The amount of ${formatINR(
          order.totalAmount
        )} will be refunded immediately to your Parent Meal Wallet.`
      )
    ) {
      return;
    }

    setCancellingId(order.id);
    try {
      const res = await fetch('/api/parent/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(data.message || 'Order cancelled successfully', 'success');
        await fetchOrders();
        await refreshUser();
      } else {
        showToast(data.error || 'Failed to cancel order', 'error');
      }
    } catch {
      showToast('Network error while cancelling order', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    return o.orderStatus === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-amber-500" />
            <span>Order History & Tracking</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track daily lunch status from preparation to pickup. Cancel upcoming meals before the cutoff deadline.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'CONFIRMED', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4 max-w-md mx-auto">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Orders Found</h3>
          <p className="text-xs text-slate-500">
            {statusFilter !== 'ALL'
              ? `No orders matching status "${statusFilter}".`
              : 'You have not placed any meal orders yet.'}
          </p>
          <Link
            href="/parent/menu"
            className="inline-block px-5 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md hover:bg-amber-600"
          >
            Order Lunch Now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusStyle = getOrderStatusColor(order.orderStatus);
            const isHighlighted = order.id === highlightedOrderId;
            // Can cancel if order not cancelled/collected and deadline not passed
            const canCancel =
              order.orderStatus === 'CONFIRMED' &&
              !order.items.some((it: any) => isDeadlinePassed(it.date, '08:30'));

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
                    <div key={idx} className="py-3 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-3">
                        <MealIcon name={item.mealName} category={item.mealCategory} size="sm" />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <VegBadge isVegetarian={item.isVegetarian} size="sm" />
                            <span className="font-bold text-slate-800 text-sm">{item.mealName}</span>
                            <span className="text-slate-400 font-semibold">× {item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <ChildAvatar size="xs" />
                            <span>
                              For: <strong className="text-slate-700">{item.studentName}</strong> (Class {item.studentGrade}-{item.studentDivision}, Roll: {item.studentRollNo})
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-amber-700">
                            Scheduled for: {formatDatePretty(item.date)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-slate-900 text-sm">{formatINR(item.totalPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-slate-400 text-[11px]">
                    Payment Ref: {order.payments?.[0]?.transactionRef || 'PAID'} • {order.payments?.[0]?.paymentMethod || 'UPI'}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Voucher / Receipt */}
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsReceiptModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-500" />
                      <span>Print Voucher</span>
                    </button>

                    {/* Cancel Order (if allowed) */}
                    {canCancel && (
                      <button
                        onClick={() => handleCancelOrder(order)}
                        disabled={cancellingId === order.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl font-bold transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Printable Receipt Modal */}
      {isReceiptModalOpen && selectedOrder && (
        <OrderReceiptModal
          order={selectedOrder}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setSelectedOrder(null);
          }}
        />
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
