'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatDatePretty, getTodayString } from '@/lib/utils';
import { useSyncWatcher } from '@/lib/client-sync';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

type KitchenData = {
  totalMeals: number;
  totalOrders: number;
  mealCounts: Array<{ mealId: string; mealName: string; quantityToPrepare: number }>;
  studentCategoryBreakdown: Record<string, number>;
  teacherMeals: Array<{ mealName: string; quantity: number }>;
  teacherMealsTotal: number;
};

const CATEGORIES = ['Pre-primary', 'Primary', 'Secondary'];

/** Staff "Prepare": how many of each dish to cook for a date (paid, active orders only). */
export default function StaffPreparePage() {
  const today = getTodayString();
  const [date, setDate] = useState(today);
  const [data, setData] = useState<KitchenData | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await fetchWithTimeout(`/api/admin/kitchen?date=${date}`);
      const body = await res.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!res.ok) {
        setError(body.error || `Could not load counts (error ${res.status}).`);
        return;
      }
      setData(body);
      setError('');
    } catch {
      if (mine === seq.current) setError('Could not load counts. Check the connection.');
    }
  }, [date]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  useSyncWatcher({ pollIntervalMs: 30000, onOrdersUpdate: () => load(), onTeacherOrdersUpdate: () => load() });

  const dishes = (data?.mealCounts || []).filter((m) => m.quantityToPrepare > 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-32 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Prepare</h1>
          <p className="text-sm text-slate-600">{formatDatePretty(date)}</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          aria-label="Refresh"
          className="w-11 h-11 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDate(today)}
          className={`min-h-[44px] px-4 rounded-xl text-sm font-bold border ${date === today ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
        >
          Today
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-base"
          aria-label="Date"
        />
      </div>

      {error && <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold">{error}</div>}

      {!data ? (
        <div className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden />
      ) : (
        <>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-bold text-amber-900 uppercase tracking-wide">Student meals</p>
            <p className="text-4xl font-black text-slate-900 tabular-nums">{data.totalMeals}</p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {CATEGORIES.map((c) => (
                <div key={c} className="p-2 rounded-xl bg-white border border-amber-200 text-center">
                  <p className="text-xs font-bold text-slate-500">{c}</p>
                  <p className="text-xl font-black text-slate-900 tabular-nums">{data.studentCategoryBreakdown?.[c] || 0}</p>
                </div>
              ))}
            </div>
          </div>

          {dishes.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-base text-slate-600">
              No paid student orders for this date.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl bg-white border border-slate-200">
              {dishes.map((m) => (
                <li key={m.mealId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-base font-bold text-slate-900 break-words min-w-0">{m.mealName}</span>
                  <span className="text-2xl font-black text-slate-900 tabular-nums shrink-0">{m.quantityToPrepare}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <p className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Teacher meals (separate)</p>
            {data.teacherMeals?.length ? (
              <ul className="mt-2 space-y-1">
                {data.teacherMeals.map((m) => (
                  <li key={m.mealName} className="flex justify-between text-base">
                    <span className="font-semibold text-slate-800">{m.mealName}</span>
                    <span className="font-black tabular-nums">{m.quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-slate-600 mt-1">No paid teacher orders.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
