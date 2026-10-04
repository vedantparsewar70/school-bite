'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ChefHat,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Users,
  UtensilsCrossed,
  RefreshCw,
  Clock,
  Sparkles,
  ShieldAlert,
  Filter,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import ChildAvatar from '@/components/ChildAvatar';
import MealIcon from '@/components/MealIcon';
import { formatINR, formatDatePretty, getTodayString, getOrderStatusColor } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';

function KitchenPageContent() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('allergyFilter') === 'alerts' ? 'ALERTS_ONLY' : 'ALL';

  const { showToast } = useToast();

  const [date, setDate] = useState<string>(getTodayString());
  const [kitchenData, setKitchenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ALERTS_ONLY'>(initialFilter);

  const fetchKitchenData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kitchen?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setKitchenData(data);
      }
    } catch (err) {
      console.error('Failed to fetch kitchen data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKitchenData();
  }, [date]);

  const handleBulkUpdate = async (status: 'PREPARING' | 'READY' | 'COLLECTED') => {
    if (
      !confirm(
        `Are you sure you want to mark all ${kitchenData?.totalMeals || 0} meals for ${formatDatePretty(
          date
        )} as ${status}?`
      )
    ) {
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch('/api/admin/kitchen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, status }),
      });

      if (res.ok) {
        showToast(`All meals for today marked as ${status}!`, 'success');
        await fetchKitchenData();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch {
      showToast('Network error updating kitchen status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleExportCSV = () => {
    if (!kitchenData?.studentList || kitchenData.studentList.length === 0) {
      showToast('No records to export', 'error');
      return;
    }

    const headers = [
      'Student Name',
      'Student ID',
      'Class',
      'Division',
      'Roll No',
      'Meal Name',
      'Category',
      'Quantity',
      'Allergy Alert',
      'Conflict Details',
      'Status',
    ];
    const rows = kitchenData.studentList.map((s: any) => [
      `"${s.studentName}"`,
      `"${s.studentId}"`,
      s.grade,
      s.division,
      s.rollNo,
      `"${s.mealName}"`,
      s.category,
      s.quantity,
      s.hasAllergyAlert ? 'YES' : 'NO',
      `"${s.conflictAllergens || s.allergies || 'None'}"`,
      s.orderStatus,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kitchen-prep-sheet-${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Kitchen CSV prep sheet downloaded!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const displayedStudentList = (kitchenData?.studentList || []).filter((s: any) => {
    if (filterMode === 'ALERTS_ONLY') {
      return s.hasAllergyAlert === true;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:p-0 print:m-0">
      {/* Header - Optimized for Kitchen Display */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 rounded-md">
              Kitchen Display System (KDS)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <ChefHat className="w-8 h-8 text-amber-500" />
            <span>Kitchen Preparation Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Aggregated meal prep counts and allergy-safe student lunch distribution roster.
          </p>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-amber-500" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden"
            />
          </div>

          <button
            onClick={fetchKitchenData}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white border border-slate-200 hover:border-amber-400 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-500" />
            <span>Print Prep Sheet</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-slate-200 hover:border-amber-400 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h1 className="text-2xl font-black text-black">SCHOOL-BITE CANTEEN - KITCHEN PREPARATION SHEET (S.B. PATIL SCHOOL)</h1>
        <p className="text-sm font-bold text-gray-700">
          Date: {formatDatePretty(date)} | Total Meals: {kitchenData?.totalMeals || 0} | Allergy Alerts: {kitchenData?.allergyAlertsCount || 0}
        </p>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* SECTION 1: Kitchen Metrics Summary (Requirement 9) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Today&apos;s Total Meals Required
              </span>
              <p className="text-3xl font-black text-slate-900">{kitchenData?.totalMeals || 0}</p>
              <span className="text-xs text-slate-500">Across {kitchenData?.studentList?.length || 0} student orders</span>
            </div>

            <div
              className={`p-5 rounded-3xl border shadow-2xs space-y-1 ${
                (kitchenData?.allergyAlertsCount || 0) > 0
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                  ⚠ Allergy Alerts Today
                </span>
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-3xl font-black text-rose-700">{kitchenData?.allergyAlertsCount || 0}</p>
              <span className="text-xs text-rose-900 font-semibold">
                Requires special allergen handling in prep!
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Classroom Divisions
              </span>
              <p className="text-3xl font-black text-slate-900">
                {kitchenData?.classBreakdown?.length || 0}
              </p>
              <span className="text-xs text-slate-500">Sections scheduled for delivery</span>
            </div>
          </div>

          {/* TOP HIGHLIGHT: Aggregated Meal Quantities to Cook */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-amber-500/20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/20 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-100">
                  Target for {formatDatePretty(date)}
                </span>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-0.5">
                  Total Portions to Cook: {kitchenData?.totalMeals || 0}
                </h2>
              </div>

              {/* Bulk kitchen action buttons */}
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => handleBulkUpdate('PREPARING')}
                  disabled={updating}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Mark All In Prep
                </button>
                <button
                  onClick={() => handleBulkUpdate('READY')}
                  disabled={updating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  Mark All Ready
                </button>
                <button
                  onClick={() => handleBulkUpdate('COLLECTED')}
                  disabled={updating}
                  className="px-4 py-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Mark All Collected
                </button>
              </div>
            </div>

            {/* Aggregated Dish Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kitchenData?.mealCounts?.map((mc: any) => (
                <div
                  key={mc.mealId}
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-100 uppercase tracking-wider">
                        {mc.category}
                      </span>
                      <VegBadge isVegetarian={mc.isVegetarian} size="sm" />
                    </div>
                    <div className="flex items-center gap-2.5 mt-2">
                      <MealIcon name={mc.mealName} category={mc.category} size="sm" />
                      <h3 className="font-extrabold text-white text-base leading-tight">{mc.mealName}</h3>
                    </div>
                  </div>
                  <div className="pt-2 flex items-baseline justify-between border-t border-white/10">
                    <span className="text-3xl font-black text-white">{mc.count}</span>
                    <span className="text-xs text-amber-100 font-semibold">portions</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: Classroom & Division Distribution Breakdown */}
          {kitchenData?.classBreakdown?.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span>Portion Breakdown by Classroom / Division</span>
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {kitchenData.classBreakdown.map((cb: any, idx: number) => (
                  <div
                    key={idx}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2"
                  >
                    <span className="font-bold text-slate-800 text-xs">{cb.classDivision}:</span>
                    <span className="font-black text-amber-700 text-sm bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      {cb.count} meals
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: Student Delivery Checklist with Prominent Allergy Alerts (Requirement 9) */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Student Distribution Checklist ({displayedStudentList.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Sorted by Class and Division for safe lunch distribution
                </p>
              </div>

              {/* Requirement 9: [All Orders] / [Allergy Alerts Only] Filter */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl print:hidden">
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterMode === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Orders ({kitchenData?.studentList?.length || 0})
                </button>
                <button
                  onClick={() => setFilterMode('ALERTS_ONLY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    filterMode === 'ALERTS_ONLY'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Allergy Alerts Only ({kitchenData?.allergyAlertsCount || 0})</span>
                </button>
              </div>
            </div>

            {displayedStudentList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-500 text-xs">
                No orders match this filter for {formatDatePretty(date)}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Class & Div</th>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Assigned Meal</th>
                      <th className="py-3 px-4">Allergy Alerts</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedStudentList.map((s: any, idx: number) => {
                      const statusStyle = getOrderStatusColor(s.orderStatus);

                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            s.hasAllergyAlert
                              ? 'bg-rose-50/50 hover:bg-rose-50'
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <ChildAvatar size="xs" />
                              <span className="font-bold text-slate-900">{s.studentName}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                              Class {s.grade}-{s.division}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{s.rollNo}</td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 font-bold text-slate-800">
                              <MealIcon name={s.mealName} category={s.category} size="sm" />
                              <div>
                                <div className="flex items-center gap-1">
                                  <VegBadge isVegetarian={s.isVegetarian} size="sm" />
                                  <span>{s.mealName}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  Qty: {s.quantity}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Prominent Kitchen Allergy Alert (Requirement 9) */}
                          <td className="py-3.5 px-4">
                            {s.hasAllergyAlert ? (
                              <div className="inline-block p-2 bg-rose-100 border-2 border-rose-300 rounded-xl space-y-0.5">
                                <div className="flex items-center gap-1 text-rose-800 font-black text-xs">
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                  <span>⚠ ALLERGY ALERT</span>
                                </div>
                                <p className="text-[11px] text-rose-900 font-extrabold">
                                  {s.conflictAllergens || 'Allergen conflict'}
                                </p>
                              </div>
                            ) : s.allergies && s.allergies !== 'None' ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-semibold rounded-md border border-amber-200">
                                Note: {s.allergies}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">None</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg}`}
                            >
                              {statusStyle.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function KitchenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <KitchenPageContent />
    </Suspense>
  );
}
