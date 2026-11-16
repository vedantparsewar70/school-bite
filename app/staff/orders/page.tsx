'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, AlertTriangle, Search, Undo2, Phone, X, RefreshCw } from 'lucide-react';
import { formatDatePretty, getTodayString } from '@/lib/utils';
import { formatServeTime } from '@/lib/service-dates';
import { DEFAULT_SERVE_FILTER, filterServeRows, serveCounter, type ServeFilter, type ServeStatusFilter } from '@/lib/serve-filter';
import { useSyncWatcher, broadcastSyncEvent } from '@/lib/client-sync';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

/** One child on the Serve list (from GET /api/staff/serve). */
type ServeRow = {
  key: string;
  studentId: string;
  studentName: string;
  grade: string;
  division: string;
  rollNo: string;
  studentCategory: string;
  meals: Array<{ orderItemId: string; orderId: string; mealName: string; quantity: number; servedAt: string | null }>;
  hasAllergyAlert: boolean;
  allergens: string | null;
  served: boolean;
  servedAt: string | null;
};

type TeacherOrder = {
  id: string;
  teacherName: string | null;
  teacherPhone: string | null;
  orderStatus: string;
  collectedAt: string | null;
  notes: string | null;
  items: Array<{ mealName: string; quantity: number }>;
};

const CATEGORIES = ['ALL', 'Pre-primary', 'Primary', 'Secondary'];
const STATUS_TABS: Array<{ id: ServeStatusFilter; label: string }> = [
  { id: 'NOT_SERVED', label: 'Not served' },
  { id: 'SERVED', label: 'Served' },
  { id: 'ALL', label: 'All' },
];
const UNDO_SECONDS = 6;

const teacherGiven = (o: TeacherOrder) => o.orderStatus === 'GIVEN' || o.orderStatus === 'COLLECTED';
const classLine = (r: ServeRow) =>
  [r.grade && r.division ? `${r.grade}-${r.division}` : r.grade || '', r.rollNo ? `Roll ${r.rollNo}` : '', r.studentCategory]
    .filter(Boolean)
    .join(' · ');

function ServeContent() {
  const today = getTodayString();
  const [tab, setTab] = useState<'STUDENTS' | 'TEACHERS'>('STUDENTS');
  const [filter, setFilter] = useState<ServeFilter>(DEFAULT_SERVE_FILTER);

  const [rows, setRows] = useState<ServeRow[]>([]);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [closedCategories, setClosedCategories] = useState<Array<{ category: string; reason: string }>>([]);
  const [teachers, setTeachers] = useState<TeacherOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ key: string; name: string; ids: string[]; kind: 'child' | 'teacher'; until: number } | null>(null);
  const [, setTick] = useState(0);

  // Only the newest load may update the list (an older, slower reply never overwrites it).
  const loadSeq = useRef(0);
  const busyRef = useRef<Set<string>>(new Set());

  const setRowBusy = (key: string, on: boolean) => {
    const next = new Set(busyRef.current);
    if (on) next.add(key);
    else next.delete(key);
    busyRef.current = next;
    setBusy(next);
  };

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [serveRes, teacherRes] = await Promise.all([
        fetchWithTimeout(`/api/staff/serve?date=${today}`),
        fetchWithTimeout(`/api/staff/teacher-orders?date=${today}`),
      ]);
      if (seq !== loadSeq.current) return;
      if (!serveRes.ok) {
        const data = await serveRes.json().catch(() => ({}));
        setLoadError(data.error || `Could not load the list (error ${serveRes.status}).`);
        return;
      }
      const data = await serveRes.json();
      const teacherData = teacherRes.ok ? await teacherRes.json() : { orders: [] };
      if (seq !== loadSeq.current) return;
      setRows(data.rows || []);
      setClosedReason(data.closedReason || null);
      setClosedCategories(Array.isArray(data.closedCategories) ? data.closedCategories : []);
      setTeachers((teacherData.orders || []).filter((o: TeacherOrder) => o.orderStatus !== 'CANCELLED'));
      setLoadError('');
    } catch {
      if (seq === loadSeq.current) setLoadError('Could not load the list. Check the connection.');
    } finally {
      if (seq === loadSeq.current) setLoaded(true);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  // Other phones' ticks arrive quietly every 30 s: no spinner, search/filter/scroll are kept.
  useSyncWatcher({ pollIntervalMs: 30000, onOrdersUpdate: () => load(), onTeacherOrdersUpdate: () => load() });

  // Undo bar countdown.
  useEffect(() => {
    if (!undo) return;
    const t = setInterval(() => {
      if (Date.now() >= undo.until) setUndo(null);
      else setTick((n) => n + 1);
    }, 500);
    return () => clearInterval(t);
  }, [undo]);

  const markRow = (key: string, servedAt: string | null) =>
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, served: Boolean(servedAt), servedAt, meals: r.meals.map((m) => ({ ...m, servedAt })) } : r
      )
    );

  const serveChild = async (row: ServeRow, action: 'serve' | 'undo') => {
    if (busyRef.current.has(row.key)) return; // a double tap does nothing
    setRowBusy(row.key, true);
    setMessage(null);
    const ids = row.meals.map((m) => m.orderItemId);
    try {
      const res = await fetchWithTimeout('/api/staff/serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, orderItemIds: ids, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        markRow(row.key, action === 'serve' ? data.servedAt || new Date().toISOString() : null);
        if (action === 'serve') setUndo({ key: row.key, name: row.studentName, ids, kind: 'child', until: Date.now() + UNDO_SECONDS * 1000 });
        else setUndo(null);
        broadcastSyncEvent('ORDERS_UPDATED');
      } else if (res.status === 409 && data.code === 'ALREADY_SERVED') {
        markRow(row.key, data.servedAt || new Date().toISOString());
        setMessage({ text: `${row.studentName}: ${data.error}`, tone: 'info' });
      } else {
        setMessage({ text: `${row.studentName}: ${data.error || 'Not saved. Please try again.'}`, tone: 'error' });
      }
    } catch {
      setMessage({ text: `${row.studentName}: not saved — no connection. Please try again.`, tone: 'error' });
    } finally {
      setRowBusy(row.key, false);
    }
  };

  const serveTeacher = async (o: TeacherOrder, action: 'serve' | 'undo') => {
    const key = `t_${o.id}`;
    if (busyRef.current.has(key)) return;
    setRowBusy(key, true);
    setMessage(null);
    const name = o.teacherName || 'Teacher';
    try {
      const res = await fetchWithTimeout('/api/staff/teacher-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: o.id, orderStatus: action === 'serve' ? 'GIVEN' : 'CONFIRMED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const now = new Date().toISOString();
        setTeachers((prev) =>
          prev.map((t) => (t.id === o.id ? { ...t, orderStatus: action === 'serve' ? 'GIVEN' : 'CONFIRMED', collectedAt: action === 'serve' ? now : t.collectedAt } : t))
        );
        if (action === 'serve') setUndo({ key, name, ids: [o.id], kind: 'teacher', until: Date.now() + UNDO_SECONDS * 1000 });
        else setUndo(null);
        broadcastSyncEvent('TEACHER_ORDERS_UPDATED');
      } else {
        setMessage({ text: `${name}: ${data.error || 'Not saved. Please try again.'}`, tone: res.status === 409 ? 'info' : 'error' });
        load();
      }
    } catch {
      setMessage({ text: `${name}: not saved — no connection. Please try again.`, tone: 'error' });
    } finally {
      setRowBusy(key, false);
    }
  };

  const undoLast = () => {
    if (!undo) return;
    if (undo.kind === 'child') {
      const row = rows.find((r) => r.key === undo.key);
      if (row) serveChild(row, 'undo');
    } else {
      const t = teachers.find((x) => `t_${x.id}` === undo.key);
      if (t) serveTeacher(t, 'undo');
    }
  };

  const visibleRows = useMemo(() => filterServeRows(rows, filter), [rows, filter]);
  const counter = useMemo(() => serveCounter(rows, filter.category), [rows, filter.category]);
  const visibleTeachers = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (filter.status === 'NOT_SERVED' && teacherGiven(t)) return false;
      if (filter.status === 'SERVED' && !teacherGiven(t)) return false;
      if (!q) return true;
      return (t.teacherName || '').toLowerCase().includes(q) || (t.teacherPhone || '').includes(q);
    });
  }, [teachers, filter]);
  const teachersGiven = teachers.filter(teacherGiven).length;

  const setStatus = (status: ServeStatusFilter) => setFilter((f) => ({ ...f, status }));

  return (
    <div className="max-w-2xl mx-auto pb-32">
      {/* Sticky header: title, counter, search, filters */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur border-b border-slate-200 px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black text-slate-900">Serve</h1>
            <p className="text-sm text-slate-600">{formatDatePretty(today)}</p>
          </div>
          <div className="text-right shrink-0" aria-live="polite">
            <p className="text-2xl font-black text-slate-900 tabular-nums">
              {tab === 'STUDENTS' ? `${counter.served} / ${counter.total}` : `${teachersGiven} / ${teachers.length}`}
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Served</p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            placeholder={tab === 'STUDENTS' ? 'Child name or roll no.' : 'Teacher name or phone'}
            className="w-full min-h-[48px] pl-10 pr-11 rounded-xl border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {filter.search && (
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, search: '' }))}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Show">
          {STATUS_TABS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={filter.status === s.id}
              onClick={() => setStatus(s.id)}
              className={`min-h-[44px] rounded-xl text-sm font-bold border ${
                filter.status === s.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
          <button
            type="button"
            onClick={() => setTab(tab === 'STUDENTS' ? 'TEACHERS' : 'STUDENTS')}
            className={`shrink-0 min-h-[44px] px-4 rounded-xl text-sm font-bold border ${
              tab === 'TEACHERS' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-800 border-emerald-300'
            }`}
          >
            {tab === 'TEACHERS' ? '← Students' : `Teachers (${teachers.length})`}
          </button>
          {tab === 'STUDENTS' &&
            CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter((f) => ({ ...f, category: c }))}
                className={`shrink-0 min-h-[44px] px-4 rounded-xl text-sm font-bold border ${
                  filter.category === c ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {c === 'ALL' ? 'All classes' : c}
              </button>
            ))}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {message && (
          <div
            role="alert"
            className={`flex items-start gap-2 p-3 rounded-xl border text-sm font-semibold ${
              message.tone === 'error' ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-sky-50 border-sky-300 text-sky-900'
            }`}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex-1">{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" className="w-11 h-11 -m-2 flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {loadError && (
          <div role="alert" className="flex items-center gap-2 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold">
            <span className="flex-1">{loadError}</span>
            <button type="button" onClick={() => load()} className="min-h-[44px] px-4 rounded-xl bg-rose-600 text-white font-bold inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {!loaded ? (
          <div className="space-y-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : tab === 'STUDENTS' ? (
          <>
            {closedCategories.map((c) => (
              <div key={c.category} className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-base font-bold text-rose-900">
                No brunch for {c.category} ({c.reason})
              </div>
            ))}
            {closedReason && rows.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-lg font-black text-slate-900">{closedReason}</p>
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-base text-slate-600">
                {rows.length === 0
                  ? 'No paid orders for today.'
                  : filter.search
                    ? 'No child matches this search.'
                    : filter.status === 'NOT_SERVED'
                      ? 'Everyone in this list has been served.'
                      : 'Nobody here yet.'}
              </div>
            ) : (
              <ul className="space-y-3">
                {visibleRows.map((r) => {
                  const isBusy = busy.has(r.key);
                  return (
                    <li
                      key={r.key}
                      className={`rounded-2xl border p-3.5 flex items-center gap-3 ${
                        r.served ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-black text-slate-900 leading-tight break-words">{r.studentName}</p>
                        <p className="text-sm text-slate-600 mt-0.5">{classLine(r)}</p>
                        <p className="text-base font-semibold text-slate-800 mt-1 break-words">
                          {r.meals.map((m) => `${m.mealName}${m.quantity > 1 ? ` × ${m.quantity}` : ''}`).join(', ')}
                        </p>
                        {r.hasAllergyAlert && (
                          <p className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-100 text-rose-800 text-sm font-bold">
                            <AlertTriangle className="w-4 h-4" /> Allergy{r.allergens ? `: ${r.allergens}` : ''}
                          </p>
                        )}
                        {r.served && r.servedAt && (
                          <p className="text-sm font-bold text-emerald-700 mt-1">Served {formatServeTime(r.servedAt)}</p>
                        )}
                      </div>
                      {r.served ? (
                        <button
                          type="button"
                          onClick={() => serveChild(r, 'undo')}
                          disabled={isBusy}
                          aria-label={`Undo serving ${r.studentName}`}
                          className="shrink-0 min-h-[48px] min-w-[72px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold inline-flex flex-col items-center justify-center disabled:opacity-50"
                        >
                          <Undo2 className="w-5 h-5" />
                          {isBusy ? 'Saving…' : 'Undo'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => serveChild(r, 'serve')}
                          disabled={isBusy}
                          aria-label={`Serve ${r.studentName}`}
                          className="shrink-0 w-16 h-16 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-white inline-flex flex-col items-center justify-center font-black text-xs disabled:opacity-60"
                        >
                          {isBusy ? <span className="text-xs">Saving…</span> : <Check className="w-8 h-8 stroke-[3]" />}
                          {!isBusy && 'Serve'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : visibleTeachers.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-base text-slate-600">
            {teachers.length === 0 ? 'No teacher orders for today.' : 'No teacher matches.'}
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleTeachers.map((t) => {
              const key = `t_${t.id}`;
              const given = teacherGiven(t);
              const isBusy = busy.has(key);
              return (
                <li key={key} className={`rounded-2xl border p-3.5 flex items-center gap-3 ${given ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-black text-slate-900 leading-tight break-words">{t.teacherName || 'Teacher'}</p>
                    {t.teacherPhone && (
                      <a href={`tel:${t.teacherPhone}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 min-h-[32px]">
                        <Phone className="w-4 h-4" /> {t.teacherPhone}
                      </a>
                    )}
                    <p className="text-base font-semibold text-slate-800 break-words">
                      {t.items.map((m) => `${m.mealName}${m.quantity > 1 ? ` × ${m.quantity}` : ''}`).join(', ')}
                    </p>
                    {t.notes && <p className="text-sm text-slate-600 mt-0.5 break-words">Note: {t.notes}</p>}
                    {given && t.collectedAt && <p className="text-sm font-bold text-emerald-700 mt-1">Served {formatServeTime(t.collectedAt)}</p>}
                  </div>
                  {given ? (
                    <button
                      type="button"
                      onClick={() => serveTeacher(t, 'undo')}
                      disabled={isBusy}
                      className="shrink-0 min-h-[48px] min-w-[72px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold inline-flex flex-col items-center justify-center disabled:opacity-50"
                    >
                      <Undo2 className="w-5 h-5" />
                      {isBusy ? 'Saving…' : 'Undo'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => serveTeacher(t, 'serve')}
                      disabled={isBusy}
                      aria-label={`Serve ${t.teacherName || 'teacher'}`}
                      className="shrink-0 w-16 h-16 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-white inline-flex flex-col items-center justify-center font-black text-xs disabled:opacity-60"
                    >
                      {isBusy ? <span className="text-xs">Saving…</span> : <Check className="w-8 h-8 stroke-[3]" />}
                      {!isBusy && 'Serve'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Undo bar for the last tick (a few seconds); Undo is always on the row in the Served tab. */}
      {undo && (
        <div className="fixed left-0 right-0 bottom-20 md:bottom-6 z-40 px-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3 p-3 rounded-2xl bg-slate-900 text-white shadow-xl">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="flex-1 text-base font-semibold truncate">{undo.name} served</span>
            <button type="button" onClick={undoLast} className="min-h-[44px] px-4 rounded-xl bg-white text-slate-900 font-black inline-flex items-center gap-1.5">
              <Undo2 className="w-4 h-4" /> Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffServePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ServeContent />
    </Suspense>
  );
}
