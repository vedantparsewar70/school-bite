'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UtensilsCrossed,
  ChefHat,
  BarChart3,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  PlusCircle,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import ChildAvatar from '@/components/ChildAvatar';
import MealIcon from '@/components/MealIcon';
import VegBadge from '@/components/VegBadge';
import { formatINR, formatDateTimePretty, getOrderStatusColor } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentOrders(data.recentOrders || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: newStatus }),
      });

      if (res.ok) {
        showToast(`Order ${orderId} updated to ${newStatus}`, 'success');
        await fetchStats();
      } else {
        showToast('Failed to update order status', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
              School Canteen Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-purple-600" />
            <span>Canteen Operations & Overview</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor real-time student orders, kitchen preparation counts, daily sales, and meal availability.
          </p>
        </div>

        {/* Quick Kitchen Action Pill */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={fetchStats}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            title="Refresh Statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/admin/kitchen"
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition-all flex items-center gap-2"
          >
            <ChefHat className="w-4 h-4" />
            <span>Open Kitchen Prep View</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid (Requirement 10: Includes Allergy Alerts Today) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Card 1: Today's Orders */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Orders</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900">{stats?.todayOrdersCount || 0}</p>
          <p className="text-[11px] text-slate-400">Total active orders today</p>
        </div>

        {/* Card 2: Today's Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-700">{formatINR(stats?.todayRevenue || 0)}</p>
          <p className="text-[11px] text-slate-400">All-time: {formatINR(stats?.totalRevenue || 0)}</p>
        </div>

        {/* Card 3: Allergy Alerts Today (Requirement 10) */}
        <Link
          href="/admin/orders?allergyFilter=WITH_ALERTS"
          className={`p-5 rounded-3xl border shadow-2xs space-y-2 transition-all block hover:scale-102 cursor-pointer ${
            (stats?.todayAllergyAlertsCount || 0) > 0
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200 shadow-rose-500/10'
              : 'bg-white border-slate-100 hover:border-slate-200'
          }`}
          title="Click to view orders with allergy alerts"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-rose-800">
              ⚠ Allergy Alerts
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-700">{stats?.todayAllergyAlertsCount || 0}</p>
          <p className="text-[11px] text-rose-800 font-bold flex items-center gap-1">
            <span>View affected orders</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </Link>

        {/* Card 4: Pending Kitchen Orders */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Prep</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-800">{stats?.pendingOrdersCount || 0}</p>
          <p className="text-[11px] text-slate-400">To be served</p>
        </div>

        {/* Card 5: Students Served */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs space-y-2 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Students Served</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-purple-700">{stats?.studentsServedCount || 0}</p>
          <p className="text-[11px] text-slate-400">Registered: {stats?.totalStudents || 0}</p>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/kitchen"
          className="bg-gradient-to-br from-amber-500 to-orange-500 text-white p-6 rounded-3xl shadow-lg shadow-amber-500/15 flex flex-col justify-between space-y-4 hover:scale-101 transition-transform"
        >
          <div className="space-y-2">
            <ChefHat className="w-8 h-8 text-amber-100" />
            <h3 className="text-xl font-extrabold">Kitchen Prep Display</h3>
            <p className="text-xs text-amber-100 leading-relaxed">
              Simplified high-contrast tablet view showing exact meal counts to cook today and class distribution sheets.
            </p>
          </div>
          <span className="text-xs font-bold flex items-center gap-1">
            Open Kitchen Screen →
          </span>
        </Link>

        <Link
          href="/admin/menu"
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4 hover:border-purple-300 transition-colors"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Manage Menu & Cutoffs</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Schedule meals for the week, adjust prices in ₹, update available portions, and set 08:30 AM deadlines.
            </p>
          </div>
          <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
            Configure Menus →
          </span>
        </Link>

        <Link
          href="/admin/reports"
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4 hover:border-purple-300 transition-colors"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Sales & Audit Reports</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Download CSV audit logs, review most popular dishes, and examine revenue breakdown across classes.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
            Generate Reports →
          </span>
        </Link>
      </div>

      {/* Live Recent Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Live Orders & Status Controller</h2>
            <p className="text-xs text-slate-500">
              Update kitchen progress directly or view individual student orders
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            All Orders ({recentOrders.length}) →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Parent</th>
                <th className="py-3 px-4">Meals & Students</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((o) => {
                const statusStyle = getOrderStatusColor(o.orderStatus);
                return (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{o.id}</td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-800">{o.parentName}</p>
                      <p className="text-[10px] text-slate-400">{o.parentEmail}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1.5">
                        {o.items?.map((it: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-700">
                            <MealIcon name={it.mealName} category={it.mealCategory} size="sm" />
                            <div>
                              <div>
                                <strong className="text-slate-900">{it.mealName}</strong> for{' '}
                                <span className="text-slate-800 font-semibold">{it.studentName}</span> (Class {it.grade}-{it.division})
                              </div>
                              {it.hasAllergyAlert && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 mt-0.5">
                                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                                  <span>⚠ Allergy: {it.conflictAllergens}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                      {formatINR(o.totalAmount)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg}`}
                      >
                        {statusStyle.text}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={o.orderStatus}
                        onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
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
    </div>
  );
}
