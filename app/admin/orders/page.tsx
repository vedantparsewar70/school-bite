'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import { formatINR, formatDatePretty, formatDateTimePretty, getOrderStatusColor } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';
import OrderReceiptModal from '@/components/OrderReceiptModal';

export default function AdminOrdersPage() {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [divFilter, setDivFilter] = useState('');
  const [mealFilter, setMealFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
  }, [dateFilter, classFilter, divFilter, mealFilter, statusFilter, search]);

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
            Filter and update student lunch orders across classes, divisions, dates, and fulfillment stages.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors self-start sm:self-auto"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-purple-600" />
            <span>Search & Multi-Filters</span>
          </span>
          <button
            onClick={handleResetFilters}
            className="text-purple-600 hover:underline font-bold"
          >
            Reset All Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Search by Student / Parent / ID
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Aarav / ORD-2026..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            />
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
              <option value="">All Classes</option>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>

          {/* Division Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Division</label>
            <select
              value={divFilter}
              onChange={(e) => setDivFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            >
              <option value="">All Divs</option>
              {['A', 'B', 'C', 'D', 'E'].map((d) => (
                <option key={d} value={d}>
                  Div {d}
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

      {/* Orders Table */}
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
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Order ID & Date</th>
                  <th className="py-3.5 px-4">Student & Class</th>
                  <th className="py-3.5 px-4">Parent Details</th>
                  <th className="py-3.5 px-4">Meal Items</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Fulfillment Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => {
                  const statusStyle = getOrderStatusColor(o.orderStatus);
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 sm:px-6">
                        <span className="font-mono font-bold text-slate-900">{o.id}</span>
                        <p className="text-[10px] text-slate-400">{formatDateTimePretty(o.createdAt)}</p>
                      </td>

                      <td className="py-4 px-4">
                        {o.items?.map((it: any, idx: number) => (
                          <div key={idx} className="space-y-0.5">
                            <p className="font-bold text-slate-800">{it.studentName}</p>
                            <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-md font-mono text-[10px]">
                              Class {it.studentGrade}-{it.studentDivision} • Roll: {it.studentRollNo}
                            </span>
                            {it.allergies && (
                              <p className="text-[10px] text-rose-600 font-semibold">⚠️ {it.allergies}</p>
                            )}
                          </div>
                        ))}
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-semibold text-slate-800">{o.parentName}</p>
                        <p className="text-[10px] text-slate-400">{o.parentPhone || o.parentEmail}</p>
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {o.items?.map((it: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 text-slate-700">
                              <VegBadge isVegetarian={it.isVegetarian} size="sm" />
                              <span className="font-medium">{it.mealName}</span>
                              <span className="text-slate-400">× {it.quantity}</span>
                              <span className="text-[10px] text-amber-700 font-semibold">
                                ({formatDatePretty(it.date)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right font-extrabold text-slate-900">
                        {formatINR(o.totalAmount)}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg}`}
                        >
                          {statusStyle.text}
                        </span>
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right space-y-1.5">
                        <select
                          value={o.orderStatus}
                          onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="PREPARING">Preparing</option>
                          <option value="READY">Ready</option>
                          <option value="COLLECTED">Collected</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
