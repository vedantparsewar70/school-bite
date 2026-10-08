'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChefHat, RefreshCw, Printer, Calendar, CheckCircle2, Clock, UtensilsCrossed } from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import { formatDatePretty, getTodayString, getOffsetDateString } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';

function StaffKitchenContent() {
  const searchParams = useSearchParams();
  const tomorrowDateStr = getOffsetDateString(1);
  const todayDateStr = getTodayString();
  const initialDate = searchParams.get('date') || tomorrowDateStr;

  const { showToast } = useToast();

  const [date, setDate] = useState<string>(initialDate);
  const [kitchenData, setKitchenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchKitchenData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kitchen?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setKitchenData(data);
      }
    } catch (err) {
      console.error('Failed to load kitchen data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKitchenData();
  }, [date]);

  const isTomorrow = date === tomorrowDateStr;
  const isToday = date === todayDateStr;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 print:p-0 print:m-0">
      {/* Canteen Staff Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
            Canteen Kitchen Staff
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-500" />
            <span>Kitchen Production</span>
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchKitchenData}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
          <button
            onClick={() => window.print()}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Print"
          >
            <Printer className="w-4 h-4 text-amber-500" />
          </button>
        </div>
      </div>

      {/* Date Toggle - Big touch targets for phone */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-2xl print:hidden">
        <button
          onClick={() => setDate(tomorrowDateStr)}
          className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center ${
            isTomorrow
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          TOMORROW&apos;S FOOD
        </button>
        <button
          onClick={() => setDate(todayDateStr)}
          className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center ${
            isToday
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          TODAY&apos;S FOOD
        </button>
      </div>

      {/* Printable Sheet Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h1 className="text-2xl font-black text-black">
          SCHOOL-BITE CANTEEN — KITCHEN PREPARATION
        </h1>
        <p className="text-base font-bold text-gray-700 mt-1">
          {formatDatePretty(date)} | Total Portions: {kitchenData?.totalMeals || 0}
        </p>
      </div>

      {/* Main Kitchen Display */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Box */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {isTomorrow ? "Tomorrow's Date" : isToday ? "Today's Date" : 'Target Date'}
              </span>
              <p className="text-lg font-black text-amber-400">{formatDatePretty(date)}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total To Cook
              </span>
              <p className="text-3xl font-black text-white">{kitchenData?.totalMeals || 0}</p>
            </div>
          </div>

          {/* Core Food Items Cards - Big readable numbers (Requirement 8) */}
          {(!kitchenData?.mealCounts || kitchenData.mealCounts.length === 0) ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
              <UtensilsCrossed className="w-10 h-10 mx-auto text-slate-300" />
              <h3 className="font-extrabold text-slate-800 text-base">No Orders For This Date</h3>
              <p className="text-xs text-slate-500">
                No student meal orders have been recorded for {formatDatePretty(date)}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {kitchenData.mealCounts.map((mc: any) => (
                <div
                  key={mc.mealId}
                  className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-200/90 shadow-2xs flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <VegBadge isVegetarian={mc.isVegetarian} size="sm" />
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        {mc.category}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                      {mc.mealName}
                    </h2>
                    <p className="text-xs font-bold text-slate-500">
                      Need to prepare:
                    </p>
                  </div>

                  {/* Huge bold count */}
                  <div className="text-right bg-amber-50/70 border border-amber-200 px-4 sm:px-5 py-2.5 rounded-2xl">
                    <span className="text-4xl sm:text-5xl font-black text-amber-600 block tracking-tight">
                      {mc.count}
                    </span>
                    <span className="text-[10px] font-extrabold text-amber-900 uppercase">
                      Portions
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StaffKitchenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <StaffKitchenContent />
    </Suspense>
  );
}
