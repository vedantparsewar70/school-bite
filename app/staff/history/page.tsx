'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Undo2, X, Phone } from 'lucide-react';
import { formatDatePretty, getTodayString } from '@/lib/utils';
import { formatServeTime } from '@/lib/service-dates';
import { filterServeRows } from '@/lib/serve-filter';
import { broadcastSyncEvent, useSyncWatcher } from '@/lib/client-sync';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

type ServeRow = {
  key: string;
  studentName: string;
  grade: string;
  division: string;
  rollNo: string;
  studentCategory: string;
  meals: Array<{ orderItemId: string; mealName: string; quantity: number }>;
  served: boolean;
  servedAt: string | null;
};
type TeacherOrder = {
  id: string;
  teacherName: string | null;
  teacherPhone: string | null;
  orderStatus: string;
  collectedAt: string | null;
  items: Array<{ mealName: string; quantity: number }>;
};

const given = (t: TeacherOrder) => t.orderStatus === 'GIVEN' || t.orderStatus === 'COLLECTED';
const meals = (list: Array<{ mealName: string; quantity: number }>) =>
  list.map((m) => `${m.mealName}${m.quantity > 1 ? ` × ${m.quantity}` : ''}`).join(', ');

/** Who was served on a date, one row per child (and teachers). Undo only for today. */
export default function StaffHistoryPage() {
  const today = getTodayString();
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState<'STUDENTS' | 'TEACHERS'>('STUDENTS');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ServeRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
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
        setError(sd.error || `Could not load history (error ${s.status}).`);
        return;
      }
      setRows(sd.rows || []);
      setTeachers(td.orders || []);
      setError('');
    } catch {
      if (mine === seq.current) setError('Could not load history. Check the connection.');
    } finally {
      if (mine === seq.current) setLoaded(true);
    }
  }, [date]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  useSyncWatcher({ pollIntervalMs: 30000, onOrdersUpdate: () => load(), onTeacherOrdersUpdate: () => load() });

  const served = useMemo(() => filterServeRows(rows, { status: 'SERVED', category: 'ALL', search }), [rows, search]);
  const servedTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => given(t) && (!q || (t.teacherName || '').toLowerCase().includes(q) || (t.teacherPhone || '').includes(q)));
  }, [teachers, search]);
  const canUndo = date === today;

  const undoChild = async (r: ServeRow) => {
    if (busy) return;
    setBusy(r.key);
    try {
      const res = await fetchWithTimeout('/api/staff/serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, orderItemIds: r.meals.map((m) => m.orderItemId), action: 'undo' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, served: false, servedAt: null } : x)));
        broadcastSyncEvent('ORDERS_UPDATED');
        setError('');
      } else {
        setError(`${r.studentName}: ${data.error || 'Not saved. Please try again.'}`);
      }
    } catch {
      setError(`${r.studentName}: not saved — no connection. Please try again.`);
    } finally {
      setBusy(null);
    }
  };

  const undoTeacher = async (t: TeacherOrder) => {
    if (busy) return;
    setBusy(t.id);
    try {
      const res = await fetchWithTimeout('/api/staff/teacher-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: t.id, orderStatus: 'CONFIRMED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTeachers((prev) => prev.map((x) => (x.id === t.id ? { ...x, orderStatus: 'CONFIRMED' } : x)));
        broadcastSyncEvent('TEACHER_ORDERS_UPDATED');
        setError('');
      } else {
        setError(`${t.teacherName || 'Teacher'}: ${data.error || 'Not saved. Please try again.'}`);
      }
    } catch {
      setError(`${t.teacherName || 'Teacher'}: not saved — no connection. Please try again.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-32">
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur border-b border-slate-200 px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900">History</h1>
            <p className="text-sm text-slate-600">{formatDatePretty(date)}</p>
          </div>
          <p className="text-right">
            <span className="block text-2xl font-black text-slate-900 tabular-nums">
              {tab === 'STUDENTS' ? `${rows.filter((r) => r.served).length} / ${rows.length}` : `${teachers.filter(given).length} / ${teachers.length}`}
            </span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Served</span>
          </p>
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
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Date"
            className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-base"
          />
        </div>
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'STUDENTS' ? 'Child name or roll no.' : 'Teacher name or phone'}
            className="w-full min-h-[48px] pl-10 pr-11 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-slate-500">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['STUDENTS', 'TEACHERS'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-h-[44px] rounded-xl text-sm font-bold border ${tab === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              {t === 'STUDENTS' ? 'Students' : 'Teachers'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {error && <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold">{error}</div>}
        {!canUndo && <p className="text-sm text-slate-600">Past days can only be corrected by an administrator.</p>}

        {!loaded ? (
          <div className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden />
        ) : tab === 'STUDENTS' ? (
          served.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-base text-slate-600">Nobody served yet.</div>
          ) : (
            <ul className="space-y-3">
              {served.map((r) => (
                <li key={r.key} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-black text-slate-900 leading-tight break-words">{r.studentName}</p>
                    <p className="text-sm text-slate-600">
                      {[r.grade && r.division ? `${r.grade}-${r.division}` : r.grade, r.rollNo ? `Roll ${r.rollNo}` : '', r.studentCategory].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-base font-semibold text-slate-800 break-words">{meals(r.meals)}</p>
                    {r.servedAt && <p className="text-sm font-bold text-emerald-700">Served {formatServeTime(r.servedAt)}</p>}
                  </div>
                  {canUndo && (
                    <button
                      type="button"
                      onClick={() => undoChild(r)}
                      disabled={busy === r.key}
                      className="shrink-0 min-h-[48px] min-w-[72px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold inline-flex flex-col items-center justify-center disabled:opacity-50"
                    >
                      <Undo2 className="w-5 h-5" />
                      {busy === r.key ? 'Saving…' : 'Undo'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : servedTeachers.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-base text-slate-600">No teacher meals served yet.</div>
        ) : (
          <ul className="space-y-3">
            {servedTeachers.map((t) => (
              <li key={t.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-black text-slate-900 leading-tight break-words">{t.teacherName || 'Teacher'}</p>
                  {t.teacherPhone && (
                    <a href={`tel:${t.teacherPhone}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 min-h-[32px]">
                      <Phone className="w-4 h-4" /> {t.teacherPhone}
                    </a>
                  )}
                  <p className="text-base font-semibold text-slate-800 break-words">{meals(t.items)}</p>
                  {t.collectedAt && <p className="text-sm font-bold text-emerald-700">Served {formatServeTime(t.collectedAt)}</p>}
                </div>
                {canUndo && (
                  <button
                    type="button"
                    onClick={() => undoTeacher(t)}
                    disabled={busy === t.id}
                    className="shrink-0 min-h-[48px] min-w-[72px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold inline-flex flex-col items-center justify-center disabled:opacity-50"
                  >
                    <Undo2 className="w-5 h-5" />
                    {busy === t.id ? 'Saving…' : 'Undo'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
