'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  Calendar,
  X,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import ChildAvatar from '@/components/ChildAvatar';
import MealIcon from '@/components/MealIcon';
import { formatINR, formatDatePretty, formatDateTimePretty, getOrderStatusColor, getTodayString, getOffsetDateString } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';
import OrderReceiptModal from '@/components/OrderReceiptModal';

function AdminOrdersContent() {
  const searchParams = useSearchParams();
  const initialAllergyFilter = searchParams.get('allergyFilter') || 'ALL';
  const initialDate = searchParams.get('date') || '';

  const { showToast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState(initialDate);
  const [classFilter, setClassFilter] = useState('');
  const [divFilter, setDivFilter] = useState('');
  const [mealFilter, setMealFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [allergyFilter, setAllergyFilter] = useState(initialAllergyFilter);
  const [search, setSearch] = useState('');

  // Selected Order for Receipt Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.append('date', dateFilter);
      if (classFilter) params.append('class', classFilter);
      if (divFilter) params.append('division', divFilter);
      if (mealFilter) params.append('mealId', mealFilter);
      if (statusFilter) params.append('orderStatus', statusFilter);
      if (allergyFilter && allergyFilter !== 'ALL') {
        params.append('allergyFilter', allergyFilter);
      }
      if (search) params.append('search', search);

      const [ordRes, mealRes] = await Promise.all([
        fetch(`/api/admin/orders?${params.toString()}`),
        fetch('/api/admin/meals'),
      ]);

      if (ordRes.ok) {
        const data = await ordRes.json();
        setOrders(data.orders || []);
      }
      if (mealRes.ok) {
        const m = await mealRes.json();
        setMeals(m.meals || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [dateFilter, classFilter, divFilter, mealFilter, statusFilter, allergyFilter, search]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: newStatus }),
      });

      if (res.ok) {
        showToast(`Order ${orderId} marked as ${newStatus}`, 'success');
        await fetchOrders();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    }
  };

  const handleResetFilters = () => {
    setDateFilter('');
    setClassFilter('');
    setDivFilter('');
    setMealFilter('');
    setStatusFilter('');
    setAllergyFilter('ALL');
    setSearch('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-purple-600" />
            <span>School Order Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Allergy-aware order dispatching and preparation tracking across all classes and dates.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors self-start sm:self-auto cursor-pointer"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar with Allergy Tabs (Requirement 16) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-600" />
            <span className="font-extrabold text-slate-800 uppercase tracking-wider">Order Filters</span>
          </div>

          {/* Quick Date Filters */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setDateFilter(getOffsetDateString(1))}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                dateFilter === getOffsetDateString(1)
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tomorrow&apos;s Orders
            </button>
            <button
              onClick={() => setDateFilter(getTodayString())}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                dateFilter === getTodayString()
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                !dateFilter
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Quick Allergy Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setAllergyFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                allergyFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setAllergyFilter('WITH_ALERTS')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                allergyFilter === 'WITH_ALERTS'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Allergy Alerts</span>
            </button>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-purple-600 hover:underline font-bold cursor-pointer"
          >
            Reset All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order ID, student, meal..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Scheduled Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            />
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class / Grade</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
              <option value="">All Classes</option>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </select>
          </div>

          {/* Order Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PREPARING">Preparing</option>
              <option value="READY">Ready</option>
              <option value="COLLECTED">Collected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table (Requirement 8: Specified Columns) */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3 max-w-md mx-auto">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Orders Found</h3>
          <p className="text-xs text-slate-500">No school orders match the selected filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Order ID</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Meal</th>
                  <th className="py-3.5 px-4">Allergy Status</th>
                  <th className="py-3.5 px-4 text-center">Payment</th>
                  <th className="py-3.5 px-4 text-center">Order Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => {
                  const statusStyle = getOrderStatusColor(o.orderStatus);

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Order ID */}
                      <td className="py-4 px-4 sm:px-6">
                        <span className="font-mono font-extrabold text-slate-900 block">{o.id}</span>
                        <span className="text-[10px] text-slate-400">{formatDateTimePretty(o.createdAt).split(',')[0]}</span>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-700">
                          {o.items?.[0] ? formatDatePretty(o.items[0].date).split(',')[0] : 'Today'}
                        </span>
                      </td>

                      {/* Student with Generic Avatar */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {o.items?.map((it: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <ChildAvatar size="xs" />
                              <span className="font-bold text-slate-800">{it.studentName}</span>
                            </div>
                          ))}
                          <div className="text-[10px] text-slate-500 pt-0.5">
                            Parent: <strong className="text-slate-700">{o.parentName}</strong>
                            {o.parentPhone && <span className="text-slate-400"> • {o.parentPhone}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {o.items?.map((it: any, idx: number) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-mono text-[11px] font-semibold"
                            >
                              Class {it.studentGrade}-{it.studentDivision} (Roll: {it.studentRollNo})
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Meal */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          {o.items?.map((it: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-slate-800">
                              <MealIcon name={it.mealName} category={it.mealCategory} size="sm" />
                              <div>
                                <div className="flex items-center gap-1 font-bold">
                                  <VegBadge isVegetarian={it.isVegetarian} size="sm" />
                                  <span>{it.mealName}</span>
                                  <span className="text-slate-400 font-normal">× {it.quantity}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Allergy Status (Requirement 8) */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {o.items?.map((it: any, idx: number) => (
                            <div key={idx}>
                              {it.hasAllergyAlert ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 font-black text-[11px] rounded-lg border border-rose-300">
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>⚠ {it.conflictAllergens || 'Allergy alert'}</span>
                                </span>
                              ) : it.allergies && it.allergies !== 'None' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 font-bold text-[10px] rounded-md border border-amber-200">
                                  <span>Student note: {it.allergies}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  <span>No conflict</span>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Payment Status */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {o.paymentStatus}
                        </span>
                        <span className="block text-[10px] font-extrabold text-slate-800 mt-0.5">
                          {formatINR(o.totalAmount)}
                        </span>
                      </td>

                      {/* Order Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg}`}
                        >
                          {statusStyle.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={o.orderStatus}
                            onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                            className="text-xs px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                          >
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="PREPARING">Preparing</option>
                            <option value="READY">Ready</option>
                            <option value="COLLECTED">Collected</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>

                          <button
                            onClick={() => setSelectedOrder(o)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Print / View Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Receipt Modal */}
      {selectedOrder && (
        <OrderReceiptModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}
