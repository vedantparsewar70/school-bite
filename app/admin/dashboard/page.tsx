'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  ShoppingBag,
  Users,
  ChefHat,
  Calendar,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Layers,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import { formatINR, formatDatePretty, getOffsetDateString } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [tomorrowProduction, setTomorrowProduction] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const tomorrowStr = getOffsetDateString(1);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setTomorrowProduction(data.tomorrowProduction || []);
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

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isMenuPublished = stats?.isTomorrowMenuPublished;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
              S.B. Patil School • Admin Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Canteen Operations Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time meal pre-orders, student counts, and kitchen preparation requirements.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setLoading(true);
              fetchStats();
              showToast('Dashboard refreshed', 'success');
            }}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4 text-purple-600" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/admin/kitchen"
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <ChefHat className="w-4 h-4" />
            <span>Kitchen Summary</span>
          </Link>
        </div>
      </div>

      {/* Operational Status Banner: Answers "What is next meal date?" & "Is tomorrow's menu published?" */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          isMenuPublished
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isMenuPublished ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {isMenuPublished ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
                Next Meal Date
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/80 border border-slate-200/50">
                {formatDatePretty(tomorrowStr)}
              </span>
            </div>
            <p className="text-sm sm:text-base font-extrabold mt-0.5">
              {isMenuPublished
                ? `Tomorrow's Menu is Published (${stats?.tomorrowPublishedCount || 0} items available to parents)`
                : "Tomorrow's Menu is NOT published yet. Parents cannot order until published."}
            </p>
          </div>
        </div>

        <Link
          href="/admin/menu"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all text-center shrink-0 shadow-xs cursor-pointer ${
            isMenuPublished
              ? 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {isMenuPublished ? "Edit Tomorrow's Menu →" : "Set & Publish Tomorrow's Menu →"}
        </Link>
      </div>

      {/* 4 Core Summary Cards: Clean, High-Contrast, Mobile-First */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Card 1: Total Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats?.totalOrders || 0}</p>
          <p className="text-[11px] text-slate-400 font-medium">Active confirmed orders</p>
        </div>

        {/* Card 2: Students Ordered */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Students Ordered</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats?.studentsOrdered || 0}</p>
          <p className="text-[11px] text-slate-400 font-medium">Unique children receiving lunch</p>
        </div>

        {/* Card 3: Total Food Items Ordered */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Food Items</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats?.totalItems || 0}</p>
          <p className="text-[11px] text-amber-700 font-medium">Tomorrow: {stats?.tomorrowTotalMeals || 0} portions</p>
        </div>

        {/* Card 4: Total Order Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Order Value</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700">{formatINR(stats?.totalOrderValue || 0)}</p>
          <p className="text-[11px] text-slate-400 font-medium">Paid meal revenue</p>
        </div>
      </div>

      {/* Main Content: Tomorrow's Production Preview + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tomorrow's Production Preview */}
        <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-extrabold text-slate-900">Tomorrow&apos;s Production Requirements</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact kitchen portions to prepare for <strong>{formatDatePretty(tomorrowStr)}</strong>
              </p>
            </div>

            <Link
              href="/admin/kitchen"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              <span>View Kitchen Summary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {tomorrowProduction.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <UtensilsCrossed className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No Orders Placed for Tomorrow Yet</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Once parents select meals and complete payment for tomorrow, total preparation counts will aggregate here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                <span className="col-span-8">Food Item</span>
                <span className="col-span-4 text-right">Qty to Prepare</span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {tomorrowProduction.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 items-center px-4 py-3 bg-white hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="col-span-8 flex items-center gap-2.5">
                      <VegBadge isVegetarian={item.isVegetarian} size="sm" />
                      <span className="text-sm font-bold text-slate-800">{item.mealName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold uppercase">
                        {item.category}
                      </span>
                    </div>

                    <div className="col-span-4 text-right">
                      <span className="text-lg font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-between items-center text-xs px-2 text-slate-500">
                <span>Total Items for Tomorrow:</span>
                <strong className="text-slate-900 text-sm font-black">{stats?.tomorrowTotalMeals || 0} portions</strong>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Quick Navigation & Recent Orders */}
        <div className="space-y-6">
          {/* Core Modules Quick Links */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h3>

            <div className="flex flex-col gap-2">
              <Link
                href="/admin/menu"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/50 transition-all text-slate-800 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Tomorrow&apos;s Menu</p>
                    <p className="text-[10px] text-slate-500">Decide available dishes</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
              </Link>

              <Link
                href="/admin/orders"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/50 transition-all text-slate-800 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Manage Orders</p>
                    <p className="text-[10px] text-slate-500">Who ordered what</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </Link>

              <Link
                href="/admin/kitchen"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 transition-all text-slate-800 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Kitchen Summary</p>
                    <p className="text-[10px] text-slate-500">Total preparation totals</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Compact Recent Orders */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Latest Orders</h3>
              <Link href="/admin/orders" className="text-[11px] font-bold text-purple-600 hover:underline">
                View All →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No recent orders placed.</p>
            ) : (
              <div className="space-y-2.5">
                {recentOrders.slice(0, 4).map((ord) => (
                  <div key={ord.id} className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">
                        {ord.items?.[0]?.studentName || 'Student'}
                      </span>
                      <span className="font-mono font-bold text-[11px] text-emerald-700">
                        {formatINR(ord.totalAmount)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {ord.items?.map((it: any) => `${it.mealName} × ${it.quantity}`).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
