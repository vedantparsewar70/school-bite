'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { formatDatePretty, getTodayString } from '@/lib/utils';
import { useSyncWatcher } from '@/lib/client-sync';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

type CategoryDay = { category: string; state: 'OPEN' | 'HOLIDAY' | 'NONE'; holidayReason: string | null };

type KitchenData = {
  date: string;
  totalMeals: number;
  mealCounts: Array<{ mealId: string; mealName: string; quantityToPrepare: number }>;
  byCategory?: Array<{ category: string; total: number; dishes: Array<{ mealName: string; quantity: number }> }>;
  teacherMeals: Array<{ mealName: string; quantity: number }>;
  teacherMealsTotal: number;
  extrasByCategory?: Array<{ category: string; total: number; extras: Array<{ mealName: string; quantity: number }> }>;
  extrasTotal?: number;
  plan?: { isSunday: boolean; isServingDay: boolean; categories: CategoryDay[] };
  deadline?: string;
  cutoff?: 'FINAL' | 'OPEN';
};

const CATEGORIES = ['Pre-primary', 'Primary', 'Secondary'];

/** "Mon 17 Nov" for a YYYY-MM-DD date (IST). */
const shortDate = (d: string) =>
  new Date(`${d}T12:00:00+05:30`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/** Staff "Prepare": how many of each dish to cook for a date (paid, active orders only). */
export default function StaffPreparePage() {
  const [today, setToday] = useState(() => getTodayString());
  const [date, setDate] = useState(today);
  const [nextDay, setNextDay] = useState<string | null>(null);
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

  const loadNextDay = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/staff/next-serving-day');
      if (res.ok) setNextDay((await res.json()).date || null);
    } catch {
      // the button just stays hidden
    }
  }, []);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  useEffect(() => {
    loadNextDay();
  }, [loadNextDay, today]);

  // New day in India (IST): "Today" moves on even if the page stays open overnight.
  useEffect(() => {
    const id = setInterval(() => {
      const now = getTodayString();
      setToday((prev) => (prev === now ? prev : now));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useSyncWatcher({
    pollIntervalMs: 30000,
    onOrdersUpdate: () => load(),
    onTeacherOrdersUpdate: () => load(),
    onMenuUpdate: () => {
      load();
      loadNextDay();
    },
  });

  const dishes = (data?.mealCounts || []).filter((m) => m.quantityToPrepare > 0);
  const byCategory = new Map((data?.byCategory || []).map((c) => [c.category, c]));
  const holidays = (data?.plan?.categories || []).filter((c) => c.state === 'HOLIDAY');
  const allClosed = Boolean(data?.plan && (data.plan.isSunday || holidays.length === CATEGORIES.length));
  const deadline = data?.deadline || '08:30';
  const loadedForDate = data?.date === date;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-32 space-y-4 print:p-0 print:pb-0 print:max-w-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Prepare</h1>
          <p className="text-sm text-slate-600">{formatDatePretty(date)}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print"
            disabled={!data}
            className="w-11 h-11 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 disabled:opacity-50"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => load()}
            aria-label="Refresh"
            className="w-11 h-11 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setDate(today)}
          aria-pressed={date === today}
          className={`min-h-[44px] px-4 rounded-xl text-sm font-bold border ${date === today ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
        >
          Today
        </button>
        {nextDay && (
          <button
            type="button"
            onClick={() => setDate(nextDay)}
            aria-pressed={date === nextDay}
            className={`min-h-[44px] px-4 rounded-xl text-sm font-bold border ${date === nextDay ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            Next serving day ({shortDate(nextDay)})
          </button>
        )}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="flex-1 min-w-[150px] min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-base"
          aria-label="Date"
        />
      </div>

      {error && <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold print:hidden">{error}</div>}

      {!data || !loadedForDate ? (
        <div className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden />
      ) : (
        <>
          {data.cutoff === 'FINAL' ? (
            <div className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-base font-bold text-emerald-900">
              Final: ordering closed at {deadline}. These numbers will not change.
            </div>
          ) : (
            <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-300 text-base font-bold text-amber-900">
              Still open until {deadline}{date !== today ? ` on ${shortDate(date)}` : ''}. Numbers may still go up.
            </div>
          )}

          {data.plan?.isSunday ? (
            <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-base font-bold text-rose-900">No brunch on Sundays.</div>
          ) : (
            holidays.map((c) => (
              <div key={c.category} className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-base font-bold text-rose-900">
                No brunch for {c.category} ({c.holidayReason || 'holiday'})
              </div>
            ))
          )}

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 print:bg-white">
            <p className="text-sm font-bold text-amber-900 uppercase tracking-wide">Student meals</p>
            <p className="text-4xl font-black text-slate-900 tabular-nums">{data.totalMeals}</p>
          </div>

          {dishes.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-base text-slate-600">
              {allClosed ? 'No brunch on this date.' : 'No paid student orders for this date.'}
            </div>
          ) : (
            <>
              <section className="rounded-2xl bg-white border border-slate-200">
                <h2 className="px-4 pt-3 text-sm font-bold text-slate-500 uppercase tracking-wide">All dishes</h2>
                <ul className="divide-y divide-slate-100">
                  {dishes.map((m) => (
                    <li key={m.mealId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-base font-bold text-slate-900 break-words min-w-0">{m.mealName}</span>
                      <span className="text-2xl font-black text-slate-900 tabular-nums shrink-0">{m.quantityToPrepare}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
                {CATEGORIES.map((c) => {
                  const group = byCategory.get(c);
                  const holiday = holidays.find((h) => h.category === c);
                  return (
                    <section key={c} className="rounded-2xl bg-white border border-slate-200 p-3 break-inside-avoid">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="text-sm font-black text-slate-900">{c}</h2>
                        <span className="text-xl font-black tabular-nums">{group?.total || 0}</span>
                      </div>
                      {group?.dishes.length ? (
                        <ul className="mt-1 space-y-1">
                          {group.dishes.map((d) => (
                            <li key={d.mealName} className="flex justify-between gap-2 text-base">
                              <span className="text-slate-800 break-words min-w-0">{d.mealName}</span>
                              <span className="font-black tabular-nums shrink-0">{d.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500 mt-1">{holiday ? `No brunch (${holiday.holidayReason || 'holiday'})` : 'No orders'}</p>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}

          <section className="rounded-2xl bg-white border border-slate-200 p-4 break-inside-avoid">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Teacher meals (separate)</h2>
              <span className="text-xl font-black tabular-nums">{data.teacherMealsTotal || 0}</span>
            </div>
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
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 p-4 break-inside-avoid">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-amber-800 uppercase tracking-wide">Extras (separate)</h2>
              <span className="text-xl font-black tabular-nums">{data?.extrasTotal || 0}</span>
            </div>
            {data?.extrasByCategory?.length ? (
              <div className="mt-2 space-y-2">
                {data.extrasByCategory.map((g: any) => (
                  <div key={g.category}>
                    <p className="text-sm font-black text-slate-700">{g.category}</p>
                    <ul className="space-y-0.5">
                      {g.extras.map((x: any) => (
                        <li key={x.mealName} className="flex justify-between text-base">
                          <span className="text-slate-800 break-words min-w-0">{x.mealName}</span>
                          <span className="font-black tabular-nums shrink-0">{x.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-base text-slate-600 mt-1">No extras ordered.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
