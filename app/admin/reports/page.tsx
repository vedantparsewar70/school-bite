'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Calendar,
  Download,
  Award,
  Layers,
} from 'lucide-react';
import { formatINR, formatDatePretty } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';

export default function AdminReportsPage() {
  const { showToast } = useToast();
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/admin/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExportCSV = () => {
    if (!reports?.exportRows || reports.exportRows.length === 0) {
      showToast('No report rows to export', 'error');
      return;
    }

    const headers = [
      'Order ID',
      'Date',
      'Parent Name',
      'Parent Phone',
      'Student Name',
      'Student ID',
      'Class & Div',
      'Roll No',
      'Meal Name',
      'Quantity',
      'Unit Price (INR)',
      'Total Price (INR)',
      'Status',
    ];

    const rows = reports.exportRows.map((r: any) => [
      `"${r.orderId}"`,
      r.date,
      `"${r.parentName}"`,
      `"${r.parentPhone}"`,
      `"${r.studentName}"`,
      `"${r.studentId}"`,
      `"${r.classDivision}"`,
      r.rollNo,
      `"${r.mealName}"`,
      r.quantity,
      r.unitPrice,
      r.totalPrice,
      r.orderStatus,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `school-canteen-sales-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Complete school sales report exported to CSV!', 'success');
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxMealCount = reports?.mostOrderedMeals?.[0]?.count || 1;
  const maxClassCount = reports?.ordersByClass?.[0]?.count || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-purple-600" />
            <span>Sales & Operations Reports</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Analyze meal sales, popular dishes, revenue by date, and classroom distribution.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export All Data (CSV)</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-3xl font-black text-emerald-700">
            {formatINR(reports?.summary?.totalRevenue || 0)}
          </p>
          <p className="text-[11px] text-slate-400">Total canteen earnings</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Meals Sold</p>
          <p className="text-3xl font-black text-amber-600">
            {reports?.summary?.totalMealsSold || 0}
          </p>
          <p className="text-[11px] text-slate-400">Portions ordered</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
          <p className="text-3xl font-black text-purple-700">
            {reports?.summary?.totalOrders || 0}
          </p>
          <p className="text-[11px] text-slate-400">Unique checkouts</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Students Catered</p>
          <p className="text-3xl font-black text-blue-600">
            {reports?.summary?.uniqueStudents || 0}
          </p>
          <p className="text-[11px] text-slate-400">Distinct active students</p>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Most Ordered Meals Ranking (Progress Bars) */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Most Ordered Meals (Rankings)</span>
            </h3>
            <p className="text-xs text-slate-500">Student favorite dishes sorted by volume and revenue</p>
          </div>

          <div className="space-y-4">
            {reports?.mostOrderedMeals?.map((m: any, idx: number) => {
              const percentage = Math.round((m.count / maxMealCount) * 100);
              return (
                <div key={m.mealId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] flex items-center justify-center font-bold">
                        #{idx + 1}
                      </span>
                      {m.mealName}
                    </span>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900">{m.count} meals</span>
                      <span className="text-slate-400 text-[10px] ml-1.5">({formatINR(m.revenue)})</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-orange-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Orders by Classroom (Class Distribution) */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              <span>Orders by Grade / Class</span>
            </h3>
            <p className="text-xs text-slate-500">Classroom participation and meal adoption</p>
          </div>

          <div className="space-y-4">
            {reports?.ordersByClass?.map((c: any) => {
              const percentage = Math.round((c.count / maxClassCount) * 100);
              return (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{c.name}</span>
                    <span className="font-extrabold text-purple-700">{c.count} portions</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Revenue Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Revenue & Sales by Date</h3>
          <p className="text-xs text-slate-500">Daily financial reconciliation summary</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Meals Cooked</th>
                <th className="py-3 px-4 text-center">Unique Orders</th>
                <th className="py-3 px-4 text-right">Daily Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports?.revenueByDate?.map((r: any) => (
                <tr key={r.date} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-bold text-slate-900">{formatDatePretty(r.date)}</td>
                  <td className="py-3 px-4 text-center font-bold text-amber-700">{r.mealsCount}</td>
                  <td className="py-3 px-4 text-center text-slate-600">{r.ordersCount}</td>
                  <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                    {formatINR(r.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
