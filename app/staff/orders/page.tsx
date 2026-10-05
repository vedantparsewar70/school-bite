'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  Calendar,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import ChildAvatar from '@/components/ChildAvatar';
import { formatDatePretty, getTodayString, getOffsetDateString, getOrderStatusColor } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';

function StaffOrdersContent() {
  const searchParams = useSearchParams();
  const tomorrowDateStr = getOffsetDateString(1);
  const todayDateStr = getTodayString();
  const initialDate = searchParams.get('date') || todayDateStr;

  const { showToast } = useToast();

  const [date, setDate] = useState<string>(initialDate);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (search) params.append('search', search);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [date, search]);

  const handleMarkCollected = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: 'COLLECTED' }),
      });

      if (res.ok) {
        showToast('Meal marked as collected!', 'success');
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, orderStatus: 'COLLECTED' } : o))
        );
      } else {
        showToast('Failed to update order status', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const isToday = date === todayDateStr;
  const isTomorrow = date === tomorrowDateStr;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
            Canteen Roster
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            <span>Student Orders</span>
          </h1>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
        </button>
      </div>

      {/* Date Toggle */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-2xl">
        <button
          onClick={() => setDate(todayDateStr)}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center ${
            isToday
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          TODAY ({formatDatePretty(todayDateStr).split(',')[0]})
        </button>
        <button
          onClick={() => setDate(tomorrowDateStr)}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center ${
            isTomorrow
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          TOMORROW ({formatDatePretty(tomorrowDateStr).split(',')[0]})
        </button>
      </div>

      {/* Search Input - Big touch target */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student name or roll number..."
          className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:outline-hidden focus:border-amber-500 shadow-2xs"
        />
      </div>

      {/* Order Cards */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <h3 className="font-extrabold text-slate-800 text-base">No Orders Found</h3>
          <p className="text-xs text-slate-500">
            No student orders match for {formatDatePretty(date)}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 font-semibold px-1">
            Total {orders.length} student {orders.length === 1 ? 'order' : 'orders'} for {formatDatePretty(date)}
          </p>

          {orders.map((o) => {
            const firstItem = o.items?.[0];
            const isCollected = o.orderStatus === 'COLLECTED';
            const statusStyle = getOrderStatusColor(o.orderStatus);

            // Group duplicate items by meal name for clean display
            const groupedMap = new Map<string, { mealName: string; isVegetarian: boolean; quantity: number }>();
            for (const it of (o.items || [])) {
              const key = it.mealName || it.mealId;
              const existing = groupedMap.get(key);
              if (existing) {
                existing.quantity += it.quantity;
              } else {
                groupedMap.set(key, {
                  mealName: it.mealName,
                  isVegetarian: it.isVegetarian,
                  quantity: it.quantity,
                });
              }
            }
            const groupedItems = Array.from(groupedMap.values());

            return (
              <div
                key={o.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-xs space-y-3.5 ${
                  isCollected
                    ? 'bg-slate-50/70 border-slate-200 opacity-75'
                    : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-md'
                }`}
              >
                {/* Clean Top Header: Class & Roll Number */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black bg-purple-100 text-purple-800 border border-purple-200/80 tracking-wide">
                      Class {firstItem?.studentGrade || '-'}-{firstItem?.studentDivision || '-'}
                    </span>
                    {firstItem?.studentRollNo && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-100 text-slate-700">
                        Roll #{firstItem.studentRollNo}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ordered Items List */}
                <div className="space-y-2">
                  {groupedItems.map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 py-1 text-xs"
                    >
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-[13px] leading-tight">
                        <VegBadge isVegetarian={it.isVegetarian} size="sm" />
                        <span>{it.mealName}</span>
                      </div>
                      <span className="font-black text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg text-xs shrink-0">
                        Qty: {it.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Allergy Alert Warning if any */}
                {o.hasAnyAllergyAlert && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Allergy alert noted on file for this student.</span>
                  </div>
                )}

                {/* Card Footer: Clean ID & Handout Action Button */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-slate-400 truncate max-w-[160px] sm:max-w-none" title={o.id}>
                    {o.id}
                  </span>

                  {isCollected ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Collected</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleMarkCollected(o.id)}
                      disabled={updatingId === o.id}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Mark Handed Out</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StaffOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <StaffOrdersContent />
    </Suspense>
  );
}
