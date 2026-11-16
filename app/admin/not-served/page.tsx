'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getTodayString } from '@/lib/utils';
import { useSyncWatcher } from '@/lib/client-sync';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import NotServedList from '@/components/NotServedList';
import type { NotServedChild, NotServedTeacher } from '@/lib/not-served';

/** Admin: children (and teachers) with a paid meal that was not handed over, for any date. */
export default function AdminNotServedPage() {
  const [today] = useState(() => getTodayString());
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Array<NotServedChild & { key?: string }>>([]);
  const [teachers, setTeachers] = useState<Array<NotServedTeacher & { id?: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const [s, t] = await Promise.all([
        fetchWithTimeout(`/api/staff/serve?date=${date}`),
        fetchWithTimeout(`/api/staff/teacher-orders?date=${date}`),
      ]);
      const sd = await s.json().catch(() => ({}));
      const td = t.ok ? await t.json().catch(() => ({ orders: [] })) : { orders: [] };
      if (mine !== seq.current) return;
      if (!s.ok) {
        setError(sd.error || `Could not load the list (error ${s.status}).`);
        return;
      }
      setRows(sd.rows || []);
      setTeachers(td.orders || []);
      setError('');
    } catch {
      if (mine === seq.current) setError('Could not load the list. Check the connection.');
    } finally {
      if (mine === seq.current) setLoaded(true);
    }
  }, [date]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  useSyncWatcher({ pollIntervalMs: 30000, onOrdersUpdate: () => load(), onTeacherOrdersUpdate: () => load() });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-4 print:p-0 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Link href="/admin/orders" aria-label="Back to orders" className="w-11 h-11 rounded-xl border border-slate-200 bg-white flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">Not served</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Date"
            className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-base"
          />
          <button type="button" onClick={() => load()} aria-label="Refresh" className="w-11 h-11 rounded-xl border border-slate-300 bg-white flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold print:hidden">{error}</div>}

      {!loaded ? (
        <div className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden />
      ) : (
        <NotServedList date={date} rows={rows} teachers={teachers} />
      )}
    </div>
  );
}
