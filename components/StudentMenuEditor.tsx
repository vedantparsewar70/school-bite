'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Search, X, Loader2, Upload } from 'lucide-react';
import { formatDatePretty, formatINR, getTodayString } from '@/lib/utils';
import { broadcastSyncEvent, useSyncWatcher } from '@/lib/client-sync';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import VegBadge from '@/components/VegBadge';

/**
 * Student Menu editor (Staff → Student Menu and Admin → Menu). What each class can order on each
 * day, exactly as parents see it, with one- or two-tap changes. All rules live on the server
 * (lib/menu-publish.ts, lib/menu-orders.ts, lib/menu-day.ts); this screen only shows and asks.
 */

type ClassName = 'Pre-primary' | 'Primary' | 'Secondary';
const CLASSES: ClassName[] = ['Pre-primary', 'Primary', 'Secondary'];

type ClassCard = {
  category: ClassName;
  state: 'ON_SALE' | 'NOT_ON_SALE' | 'HOLIDAY';
  mealId: string | null;
  mealName: string | null;
  price: number | null;
  isVegetarian: boolean | null;
  holidayReason: string | null;
  ordered: number;
  children: number;
  maxQuantity: number | null;
  availableQuantity: number | null;
  deadline: string;
  shared: boolean;
  duplicates: number;
  editable: boolean;
  removable: boolean;
  extras: ExtraCard[];
};
type ExtraCard = {
  mealId: string;
  mealName: string;
  price: number | null;
  isVegetarian: boolean | null;
  maxQuantity: number;
  availableQuantity: number;
  ordered: number;
  children: number;
};
type MenuDay = {
  date: string;
  weekday: string;
  isSunday: boolean;
  isPast: boolean;
  isToday: boolean;
  status: 'ALL' | 'SOME' | 'NONE' | 'HOLIDAY' | 'SUNDAY';
  classes: ClassCard[];
};
type Dish = {
  id: string;
  name: string;
  price: number;
  isVegetarian: boolean;
  description?: string | null;
  category?: string;
  /** Used as an extra (add-on) somewhere. */
  isExtra?: boolean;
  /** A copy made by "Edit for this day" (hidden from the normal lists). */
  dayOnly?: boolean;
  dayOnlyDate?: string;
};

type Sheet =
  | { kind: 'dish'; category: ClassName; mode: 'add' | 'change' }
  | { kind: 'edit'; dish: Dish }
  | { kind: 'new' }
  | { kind: 'portions'; card: ClassCard }
  | { kind: 'holiday' }
  | { kind: 'remove'; card: ClassCard }
  | { kind: 'dayEdit'; card: ClassCard }
  | { kind: 'extraAdd'; category: ClassName }
  | { kind: 'extraPortions'; card: ClassCard; extra: ExtraCard }
  | { kind: 'extraRemove'; card: ClassCard; extra: ExtraCard }
  | null;

const STRIP_DAYS = 14;
const FILLER = /\s*-\s*(freshly prepared|prepared fresh) at school canteen\.?$/i;
const cleanDescription = (d?: string | null) => {
  const t = (d || '').trim();
  return !t || FILLER.test(t) ? '' : t;
};
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayNumber = (date: string) => Number(date.slice(8, 10));

const DOT: Record<MenuDay['status'], { color: string; label: string }> = {
  ALL: { color: 'bg-emerald-500', label: 'All classes on sale' },
  SOME: { color: 'bg-amber-400', label: 'Some classes missing' },
  NONE: { color: 'bg-slate-300', label: 'Nothing on sale' },
  HOLIDAY: { color: 'bg-rose-400', label: 'Holiday' },
  SUNDAY: { color: 'bg-slate-500', label: 'Sunday (closed)' },
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetchWithTimeout(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, any> };
}

export default function StudentMenuEditor({ isAdmin = false }: { isAdmin?: boolean }) {
  const [tab, setTab] = useState<'MENU' | 'MONTH' | 'DISHES'>('MENU');
  const [today, setToday] = useState(() => getTodayString());
  const [from, setFrom] = useState(() => getTodayString());
  const [days, setDays] = useState<MenuDay[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string; retryOthers?: () => void } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);

  const loadDays = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await fetchWithTimeout(`/api/staff/menu-days?from=${from}&days=${STRIP_DAYS}`);
      const body = await res.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!res.ok) {
        setError(body.error || `Could not load the menu (error ${res.status}).`);
        return;
      }
      setDays(body.days || []);
      setError('');
    } catch {
      if (mine === seq.current) setError('Could not load the menu. Check the connection.');
    } finally {
      if (mine === seq.current) setLoaded(true);
    }
  }, [from]);

  const loadDishes = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/admin/meals');
      if (res.ok) setDishes(((await res.json()).meals || []) as Dish[]);
    } catch {
      // the list keeps its last value
    }
  }, []);

  // Reload on a new IST day too, so yesterday becomes view-only.
  useEffect(() => {
    loadDays();
  }, [loadDays, today]);
  useEffect(() => {
    loadDishes();
  }, [loadDishes]);

  // Opens on the next serving day (or today when it is still open).
  useEffect(() => {
    let cancelled = false;
    fetchWithTimeout('/api/staff/next-serving-day')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const next: string = d?.date || getTodayString();
        // A next serving day beyond the strip (long holidays) starts the strip there.
        if (next > addDays(getTodayString(), STRIP_DAYS - 1)) setFrom(next);
        setSelected((cur) => cur || next);
      })
      .catch(() => setSelected((cur) => cur || getTodayString()));
    return () => {
      cancelled = true;
    };
  }, []);

  // New day in India (IST): today moves on; the selected day stays as it is.
  useEffect(() => {
    const id = setInterval(() => {
      const now = getTodayString();
      setToday((prev) => (prev === now ? prev : now));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Quiet refresh (no spinner): another phone's change, a monthly import, a new order; and every 30 s.
  useSyncWatcher({
    pollIntervalMs: 30000,
    onMenuUpdate: () => {
      loadDays();
      loadDishes();
    },
    onOrdersUpdate: () => loadDays(),
  });

  // Keep the selected chip in view.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-date="${selected}"]`);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [selected, days.length]);

  // Earlier / later: the strip moves by a week; a selected day that leaves the strip moves with it.
  const shiftWindow = (n: number) => {
    const nextFrom = addDays(from, n);
    setFrom(nextFrom);
    setSelected((cur) => (cur && cur >= nextFrom && cur <= addDays(nextFrom, STRIP_DAYS - 1) ? cur : nextFrom));
  };

  const openDay = (date: string) => {
    setSelected(date);
    if (date < from || date > addDays(from, STRIP_DAYS - 1)) setFrom(date);
    setTab('MENU');
  };

  const day = days.find((d) => d.date === selected) || null;
  const anyEditable = Boolean(day?.classes.some((c) => c.editable));

  const refreshAfterChange = async () => {
    broadcastSyncEvent('MENU_UPDATED');
    await loadDays();
  };

  const viewOnlyReason = (d: MenuDay) =>
    d.isSunday
      ? 'Sunday: the canteen is closed.'
      : d.isPast
        ? 'Past day: view only.'
        : d.classes.every((c) => !c.editable)
          ? `Ordering closed at ${d.classes[0]?.deadline || '08:30'}: view only.`
          : null;

  // --- Actions ---------------------------------------------------------------------------------

  const publish = async (
    date: string,
    classes: ClassName[] | 'ALL',
    mealId: string,
    portions: number | null,
    cardsBefore: ClassCard[]
  ): Promise<{ ok: boolean; data: Record<string, any> }> => {
    const targets: ClassName[] = classes === 'ALL' ? CLASSES : classes;
    const r = await send('/api/admin/menus/assign', 'POST', { date, studentCategory: classes === 'ALL' ? 'ALL' : classes[0], mealId, replace: true });
    if (!r.ok) return { ok: false, data: r.data };
    // Portions: set when chosen and different from what the class now has (a new dish starts at 50).
    if (portions !== null) {
      for (const cat of targets) {
        const before = cardsBefore.find((c) => c.category === cat);
        const current = before?.mealId === mealId ? before.maxQuantity : 50;
        if (current !== portions) {
          const p = await send('/api/admin/menus/portions', 'POST', { date, studentCategory: cat, portions });
          if (!p.ok) return { ok: false, data: { ...p.data, error: `${cat}: ${p.data.error || 'Portions not saved.'}` } };
        }
      }
    }
    return { ok: true, data: r.data };
  };

  const saveDish = async (category: ClassName, applyAll: boolean, mealId: string, portions: number | null) => {
    if (!day) return;
    setBusy(true);
    setNotice(null);
    const date = day.date;
    const before = day.classes;
    const dishName = dishes.find((d) => d.id === mealId)?.name || 'Dish';
    try {
      const result = await publish(date, applyAll ? 'ALL' : [category], mealId, portions, before);
      if (result.ok) {
        setNotice({ ok: true, text: `${dishName} is on sale for ${applyAll ? 'all 3 classes' : category} on ${formatDatePretty(date)}.` });
        setSheet(null);
      } else {
        const blocked: ClassName[] = Array.isArray(result.data.blockedCategories) ? result.data.blockedCategories : [];
        const others = CLASSES.filter((c) => !blocked.includes(c));
        const canRetry = applyAll && blocked.length > 0 && others.length > 0 && result.data.code === 'HAS_ORDERS';
        setNotice({
          ok: false,
          text: result.data.error || 'Not saved. Please try again.',
          retryOthers: canRetry
            ? async () => {
                setBusy(true);
                setNotice(null);
                try {
                  const done: string[] = [];
                  for (const cat of others) {
                    const r = await publish(date, [cat], mealId, portions, before);
                    if (!r.ok) {
                      setNotice({ ok: false, text: `${cat}: ${r.data.error || 'Not saved.'}` });
                      return;
                    }
                    done.push(cat);
                  }
                  setNotice({ ok: true, text: `${dishName} is on sale for ${done.join(', ')} on ${formatDatePretty(date)}.` });
                  setSheet(null);
                } finally {
                  setBusy(false);
                  await refreshAfterChange();
                }
              }
            : undefined,
        });
      }
    } catch {
      setNotice({ ok: false, text: 'Not saved: no connection. Please try again.' });
    } finally {
      setBusy(false);
      await refreshAfterChange();
    }
  };

  const saveDayEdit = async (card: ClassCard, applyAll: boolean, v: DishValues) => {
    if (!day || !card.mealId) return;
    const date = day.date;
    const body = (studentCategory: string) => ({ date, studentCategory, mealId: card.mealId, ...v });
    setBusy(true);
    setNotice(null);
    try {
      const r = await send('/api/admin/meals/day-copy', 'POST', body(applyAll ? 'ALL' : card.category));
      if (r.ok) {
        setNotice({ ok: true, text: r.data.message || `${v.name} saved for ${formatDatePretty(date)}.` });
        setSheet(null);
        return;
      }
      const blocked: ClassName[] = Array.isArray(r.data.blockedCategories) ? r.data.blockedCategories : [];
      const others = CLASSES.filter((c) => !blocked.includes(c));
      setNotice({
        ok: false,
        text: r.data.error || 'Not saved. Please try again.',
        retryOthers:
          applyAll && blocked.length > 0 && others.length > 0 && r.data.code === 'HAS_ORDERS'
            ? async () => {
                setBusy(true);
                setNotice(null);
                try {
                  // One copy for the remaining classes: each class is saved on its own.
                  for (const cat of others) {
                    const one = await send('/api/admin/meals/day-copy', 'POST', body(cat));
                    if (!one.ok) {
                      setNotice({ ok: false, text: `${cat}: ${one.data.error || 'Not saved.'}` });
                      return;
                    }
                  }
                  setNotice({ ok: true, text: `${v.name} saved for ${others.join(', ')} on ${formatDatePretty(date)}.` });
                  setSheet(null);
                } finally {
                  setBusy(false);
                  await refreshAfterChange();
                  await loadDishes();
                }
              }
            : undefined,
      });
    } catch {
      setNotice({ ok: false, text: 'Not saved: no connection. Please try again.' });
    } finally {
      setBusy(false);
      await refreshAfterChange();
      await loadDishes();
    }
  };

  const run = async (action: () => Promise<{ ok: boolean; data: Record<string, any> }>, success: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await action();
      if (r.ok) {
        setNotice({ ok: true, text: success });
        setSheet(null);
      } else {
        setNotice({ ok: false, text: r.data.error || 'Not saved. Please try again.' });
      }
      return r.ok;
    } catch {
      setNotice({ ok: false, text: 'Not saved: no connection. Please try again.' });
      return false;
    } finally {
      setBusy(false);
      await refreshAfterChange();
      await loadDishes();
    }
  };

  // --- Render ----------------------------------------------------------------------------------

  return (
    <div className="max-w-2xl mx-auto px-4 pt-3 pb-32 space-y-4 overflow-x-hidden">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-slate-900">Student Menu</h1>
        <Link
          href="/staff/menu-import"
          className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 inline-flex items-center gap-1.5"
        >
          <Upload className="w-4 h-4" /> Monthly file
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2" role="tablist">
        {(['MENU', 'MONTH', 'DISHES'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-[44px] rounded-xl text-base font-bold border ${tab === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            {t === 'MENU' ? 'Menu' : t === 'MONTH' ? 'Month' : 'Dishes'}
          </button>
        ))}
      </div>

      {notice && (
        <div
          role="status"
          className={`p-3 rounded-2xl border text-base font-semibold space-y-2 ${notice.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 break-words">{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Close message" className="w-11 h-11 -m-2 shrink-0 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
          {notice.retryOthers && (
            <button
              type="button"
              disabled={busy}
              onClick={notice.retryOthers}
              className="w-full min-h-[44px] rounded-xl bg-white border border-rose-300 text-rose-900 font-bold disabled:opacity-60"
            >
              Save for the other classes only
            </button>
          )}
        </div>
      )}

      {tab === 'MENU' ? (
        <>
          {/* Day strip */}
          <div className="flex items-center gap-1 -mx-1">
            <button type="button" onClick={() => shiftWindow(-7)} aria-label="Earlier days" className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div ref={stripRef} className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
              {days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  data-date={d.date}
                  onClick={() => setSelected(d.date)}
                  aria-pressed={selected === d.date}
                  aria-label={`${d.weekday} ${dayNumber(d.date)}: ${DOT[d.status].label}`}
                  className={`shrink-0 w-14 min-h-[56px] rounded-xl border flex flex-col items-center justify-center ${
                    selected === d.date ? 'bg-slate-900 text-white border-slate-900' : d.isPast ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-800 border-slate-300'
                  }`}
                >
                  <span className="text-xs font-semibold">{d.weekday}</span>
                  <span className="text-base font-black leading-tight">{dayNumber(d.date)}</span>
                  <span className={`mt-0.5 w-2 h-2 rounded-full ${DOT[d.status].color}`} />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => shiftWindow(7)} aria-label="Later days" className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {(['ALL', 'SOME', 'NONE', 'HOLIDAY', 'SUNDAY'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${DOT[s].color}`} /> {DOT[s].label}
              </span>
            ))}
          </div>

          {error && <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold">{error}</div>}

          {!loaded || !day ? (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-black text-slate-900">{formatDatePretty(day.date)}</p>
                  <p className="text-sm text-slate-600">
                    {viewOnlyReason(day) || `Parents can order until ${day.classes[0]?.deadline || '08:30'}${day.isToday ? ' today' : ' on the day'}.`}
                  </p>
                </div>
                {anyEditable && day.status !== 'HOLIDAY' && (
                  <button
                    type="button"
                    onClick={() => setSheet({ kind: 'holiday' })}
                    className="min-h-[44px] px-3 rounded-xl border border-rose-200 bg-white text-rose-700 text-sm font-bold"
                  >
                    Mark as holiday
                  </button>
                )}
                {!day.isPast && day.status === 'HOLIDAY' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => send('/api/admin/menus/holiday', 'POST', { date: day.date, studentCategory: 'ALL', action: 'undo' }), 'Holiday removed. Nothing is on sale yet.')}
                    className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold disabled:opacity-60"
                  >
                    Undo holiday (all)
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {day.classes.map((c) => (
                  <ClassCardView
                    key={c.category}
                    card={c}
                    day={day}
                    busy={busy}
                    onAdd={() => setSheet({ kind: 'dish', category: c.category, mode: c.state === 'ON_SALE' ? 'change' : 'add' })}
                    onRemove={() => setSheet({ kind: 'remove', card: c })}
                    onPortions={() => setSheet({ kind: 'portions', card: c })}
                    onEdit={() => {
                      const dish = dishes.find((d) => d.id === c.mealId);
                      if (dish) setSheet({ kind: 'edit', dish });
                    }}
                    onUndoHoliday={() =>
                      run(() => send('/api/admin/menus/holiday', 'POST', { date: day.date, studentCategory: c.category, action: 'undo' }), `Holiday removed for ${c.category}. Nothing is on sale yet.`)
                    }
                    onDayEdit={() => setSheet({ kind: 'dayEdit', card: c })}
                    onExtraAdd={() => setSheet({ kind: 'extraAdd', category: c.category })}
                    onExtraPortions={(extra) => setSheet({ kind: 'extraPortions', card: c, extra })}
                    onExtraRemove={(extra) => setSheet({ kind: 'extraRemove', card: c, extra })}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : tab === 'MONTH' ? (
        <MonthTab startMonth={(selected || today).slice(0, 7)} today={today} onOpenDay={openDay} />
      ) : (
        <DishesTab dishes={dishes} isAdmin={isAdmin} busy={busy} onNew={() => setSheet({ kind: 'new' })} onEdit={(d) => setSheet({ kind: 'edit', dish: d })} onDelete={(d) => {
          if (!window.confirm(`Delete ${d.name} from the dish list? This cannot be undone.`)) return;
          run(() => send(`/api/admin/meals?id=${encodeURIComponent(d.id)}`, 'DELETE'), `${d.name} deleted.`);
        }} />
      )}

      {/* Sheets */}
      {sheet?.kind === 'dish' && day && (
        <DishSheet
          day={day}
          category={sheet.category}
          mode={sheet.mode}
          dishes={dishes}
          busy={busy}
          onClose={() => setSheet(null)}
          onCreated={(d) => setDishes((prev) => [d, ...prev.filter((x) => x.id !== d.id)])}
          onSave={(mealId, applyAll, portions) => saveDish(sheet.category, applyAll, mealId, portions)}
        />
      )}
      {sheet?.kind === 'dayEdit' && day && (
        <DayEditSheet
          day={day}
          card={sheet.card}
          dish={dishes.find((d) => d.id === sheet.card.mealId) || null}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={(applyAll, v) => saveDayEdit(sheet.card, applyAll, v)}
        />
      )}
      {sheet?.kind === 'extraAdd' && day && (
        <ExtraSheet
          day={day}
          category={sheet.category}
          dishes={dishes}
          busy={busy}
          onClose={() => setSheet(null)}
          onCreated={(d) => setDishes((prev) => [d, ...prev.filter((x) => x.id !== d.id)])}
          onSave={(mealId, applyAll, portions) =>
            run(
              () => send('/api/admin/menus/extras', 'POST', { action: 'add', date: day.date, studentCategory: applyAll ? 'ALL' : sheet.category, mealId, portions }),
              `Extra added for ${applyAll ? 'all 3 classes' : sheet.category}.`
            )
          }
        />
      )}
      {sheet?.kind === 'extraPortions' && day && (
        <PortionsSheet
          card={{ ...sheet.card, mealName: `${sheet.extra.mealName} (extra)`, ordered: sheet.extra.ordered, maxQuantity: sheet.extra.maxQuantity }}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={(n) =>
            run(
              () => send('/api/admin/menus/extras', 'POST', { action: 'portions', date: day.date, studentCategory: sheet.card.category, mealId: sheet.extra.mealId, portions: n }),
              `${sheet.extra.mealName}: ${n} portions.`
            )
          }
        />
      )}
      {sheet?.kind === 'extraRemove' && day && (
        <BottomSheet title="Remove extra" onClose={() => setSheet(null)}>
          <p className="text-base text-slate-900">
            Remove the extra {sheet.extra.mealName} from {formatDatePretty(day.date)}, {sheet.card.category}? Parents will no longer be able to order it.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setSheet(null)} disabled={busy} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-base font-bold">
              Keep it
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => send('/api/admin/menus/extras', 'POST', { action: 'remove', date: day.date, studentCategory: sheet.card.category, mealId: sheet.extra.mealId }),
                  `${sheet.extra.mealName} removed from ${formatDatePretty(day.date)}, ${sheet.card.category}.`
                )
              }
              className="min-h-[48px] rounded-xl bg-rose-600 text-white text-base font-black disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        </BottomSheet>
      )}
      {sheet?.kind === 'edit' && (
        <DishForm
          title="Edit everywhere"
          initial={sheet.dish}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={(v) => run(() => send('/api/admin/meals', 'PUT', { id: sheet.dish.id, ...v }), `${v.name} saved.`)}
        />
      )}
      {sheet?.kind === 'new' && (
        <DishForm
          title="New dish"
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={(v) => run(() => send('/api/admin/meals', 'POST', { ...v, category: 'LUNCH' }), `${v.name} added to the dish list.`)}
        />
      )}
      {sheet?.kind === 'portions' && day && (
        <PortionsSheet
          card={sheet.card}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={(n) => run(() => send('/api/admin/menus/portions', 'POST', { date: day.date, studentCategory: sheet.card.category, portions: n }), `${sheet.card.category}: ${n} portions.`)}
        />
      )}
      {sheet?.kind === 'holiday' && day && (
        <HolidaySheet
          day={day}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={(scope, reason) =>
            run(() => send('/api/admin/menus/holiday', 'POST', { date: day.date, studentCategory: scope, reason, action: 'mark' }), `${formatDatePretty(day.date)} is a holiday for ${scope === 'ALL' ? 'all classes' : scope}.`)
          }
        />
      )}
      {sheet?.kind === 'remove' && day && (
        <BottomSheet title="Remove dish" onClose={() => setSheet(null)}>
          <p className="text-base text-slate-900">
            Remove {sheet.card.mealName} from {formatDatePretty(day.date)}, {sheet.card.category}? Parents will no longer be able to order it.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setSheet(null)} disabled={busy} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-base font-bold">
              Keep it
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => send('/api/admin/menus/unpublish', 'POST', { date: day.date, studentCategory: sheet.card.category }),
                  `${sheet.card.mealName} removed from ${formatDatePretty(day.date)}, ${sheet.card.category}. Parents can no longer order it.`
                )
              }
              className="min-h-[48px] rounded-xl bg-rose-600 text-white text-base font-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Remove
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

// --- Pieces ----------------------------------------------------------------------------------

function ClassCardView({
  card: c,
  day,
  busy,
  onAdd,
  onRemove,
  onPortions,
  onEdit,
  onUndoHoliday,
  onDayEdit,
  onExtraAdd,
  onExtraPortions,
  onExtraRemove,
}: {
  card: ClassCard;
  day: MenuDay;
  busy: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onPortions: () => void;
  onEdit: () => void;
  onUndoHoliday: () => void;
  onDayEdit: () => void;
  onExtraAdd: () => void;
  onExtraPortions: (extra: ExtraCard) => void;
  onExtraRemove: (extra: ExtraCard) => void;
}) {
  const onSale = c.state === 'ON_SALE';
  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-600">{c.category}</h2>
        {c.state === 'HOLIDAY' ? (
          <span className="text-sm font-bold text-rose-700">Holiday</span>
        ) : onSale ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> On sale
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-300" /> Not on sale
          </span>
        )}
      </div>

      {c.state === 'HOLIDAY' ? (
        <p className="text-lg font-black text-slate-900 break-words">Holiday: {c.holidayReason}</p>
      ) : onSale ? (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-black text-slate-900 break-words min-w-0">{c.mealName}</p>
            <span className="text-lg font-black text-slate-900 shrink-0">{c.price !== null ? formatINR(c.price) : ''}</span>
          </div>
          {c.isVegetarian !== null && <VegBadge isVegetarian={c.isVegetarian} size="sm" />}
          <p className="text-base text-slate-700">
            <strong>{c.ordered}</strong> ordered
            {c.maxQuantity !== null && (
              <>
                {' '}/ <strong>{c.maxQuantity}</strong> available
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-lg font-bold text-slate-500">Nothing on sale</p>
      )}

      {c.shared && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Shared by all 3 classes (older entry). Changing one class gives each class its own.</p>}
      {c.duplicates > 0 && <p className="text-sm text-slate-600">{c.duplicates} older duplicate {c.duplicates === 1 ? 'entry is' : 'entries are'} hidden from parents.</p>}

      {(c.editable || c.removable || (c.state === 'HOLIDAY' && !day.isPast)) && (
        <div className="grid grid-cols-2 gap-2">
          {c.editable && c.state !== 'HOLIDAY' && (
            <button type="button" disabled={busy} onClick={onAdd} className="min-h-[48px] rounded-xl bg-slate-900 text-white text-base font-bold disabled:opacity-60">
              {onSale ? 'Change dish' : 'Add dish'}
            </button>
          )}
          {c.removable && (
            <button type="button" disabled={busy} onClick={onRemove} className="min-h-[48px] rounded-xl border-2 border-rose-200 bg-white text-rose-700 text-base font-bold disabled:opacity-60">
              Remove
            </button>
          )}
          {c.editable && onSale && (
            <button type="button" disabled={busy} onClick={onPortions} className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold disabled:opacity-60">
              Portions: {c.maxQuantity ?? '–'}
            </button>
          )}
          {c.editable && onSale && c.mealId && (
            <button type="button" disabled={busy} onClick={onDayEdit} className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold disabled:opacity-60">
              Edit for this day
            </button>
          )}
          {onSale && c.mealId && (
            <button type="button" disabled={busy} onClick={onEdit} className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold disabled:opacity-60">
              Edit everywhere
            </button>
          )}
          {c.state === 'HOLIDAY' && !day.isPast && (
            <button type="button" disabled={busy} onClick={onUndoHoliday} className="col-span-2 min-h-[48px] rounded-xl border border-slate-300 bg-white text-slate-800 text-base font-bold disabled:opacity-60">
              Undo holiday
            </button>
          )}
        </div>
      )}

      {onSale && (c.extras.length > 0 || c.editable) && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">Extras</p>
          {c.extras.map((x) => (
            <div key={x.mealId} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  {x.isVegetarian !== null && <VegBadge isVegetarian={x.isVegetarian} size="sm" />}
                  <span className="text-base font-bold text-slate-900 break-words min-w-0">{x.mealName}</span>
                </span>
                <span className="text-base font-bold text-slate-900 shrink-0">{x.price !== null ? formatINR(x.price) : ''}</span>
              </div>
              <p className="text-sm text-slate-700">
                <strong>{x.ordered}</strong> ordered / <strong>{x.maxQuantity}</strong> available
              </p>
              {(c.editable || !day.isPast) && (
                <div className="grid grid-cols-2 gap-2">
                  {c.editable && (
                    <button type="button" disabled={busy} onClick={() => onExtraPortions(x)} className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-bold disabled:opacity-60">
                      Portions: {x.maxQuantity}
                    </button>
                  )}
                  {!day.isPast && (
                    <button type="button" disabled={busy} onClick={() => onExtraRemove(x)} className="min-h-[44px] rounded-xl border-2 border-rose-200 bg-white text-rose-700 text-sm font-bold disabled:opacity-60">
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {c.editable && (
            <button type="button" disabled={busy} onClick={onExtraAdd} className="w-full min-h-[44px] rounded-xl border border-dashed border-slate-400 text-base font-bold text-slate-800 inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
              <Plus className="w-4 h-4" /> Add extra
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-4 pb-8 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-black text-slate-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DishSheet({
  day,
  category,
  mode,
  dishes,
  busy,
  onClose,
  onCreated,
  onSave,
}: {
  day: MenuDay;
  category: ClassName;
  mode: 'add' | 'change';
  dishes: Dish[];
  busy: boolean;
  onClose: () => void;
  onCreated: (d: Dish) => void;
  onSave: (mealId: string, applyAll: boolean, portions: number | null) => void;
}) {
  const card = day.classes.find((c) => c.category === category)!;
  const [search, setSearch] = useState('');
  const [mealId, setMealId] = useState<string>(card.mealId || '');
  const [applyAll, setApplyAll] = useState(true);
  const [portions, setPortions] = useState(String(card.maxQuantity ?? 50));
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dishes.filter((d) => !d.dayOnly && (!q || d.name.toLowerCase().includes(q)));
  }, [dishes, search]);

  const targets = applyAll ? day.classes.filter((c) => c.editable) : [card];
  const minPortions = Math.max(0, ...targets.map((c) => (c.mealId === mealId ? c.ordered : 0)));

  const save = () => {
    if (!mealId) {
      setProblem('Choose a dish first.');
      return;
    }
    const n = Number(portions);
    if (!Number.isInteger(n) || n < 0 || n > 10000) {
      setProblem('Portions must be a whole number from 0 to 10000.');
      return;
    }
    if (n < minPortions) {
      setProblem(`${minPortions} already ordered. Portions can't be lower than that.`);
      return;
    }
    setProblem('');
    onSave(mealId, applyAll, n);
  };

  return (
    <BottomSheet title={`${mode === 'add' ? 'Add' : 'Change'} dish: ${formatDatePretty(day.date)}`} onClose={onClose}>
      {creating ? (
        <DishFields
          submitLabel="Add dish"
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={async (v) => {
            const r = await send('/api/admin/meals', 'POST', { ...v, category: 'LUNCH' });
            const meal = (r.data.meal || null) as Dish | null;
            if (meal && (r.ok || r.data.code === 'DUPLICATE_RECIPE')) {
              onCreated(meal);
              setMealId(meal.id);
              setCreating(false);
              setProblem(r.ok ? '' : `${meal.name} is already in the list, so it was chosen.`);
              broadcastSyncEvent('MENU_UPDATED');
            } else {
              setProblem(r.data.error || 'The dish could not be added.');
            }
          }}
        />
      ) : (
        <>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes"
              className="w-full min-h-[48px] pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-base"
            />
          </div>
          <ul className="max-h-[38vh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl" role="radiogroup">
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mealId === d.id}
                  onClick={() => setMealId(d.id)}
                  className={`w-full min-h-[52px] px-3 py-2 flex items-center justify-between gap-3 text-left ${mealId === d.id ? 'bg-amber-50' : 'bg-white'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-5 h-5 shrink-0 rounded-full border-2 ${mealId === d.id ? 'border-amber-600 bg-amber-500' : 'border-slate-300'}`} />
                    <VegBadge isVegetarian={d.isVegetarian} size="sm" />
                    <span className="text-base font-semibold text-slate-900 break-words min-w-0">{d.name}</span>
                  </span>
                  <span className="text-base font-bold text-slate-800 shrink-0">{formatINR(d.price)}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="p-4 text-base text-slate-500">No dish matches.</li>}
          </ul>
          <button type="button" onClick={() => setCreating(true)} className="w-full min-h-[44px] rounded-xl border border-dashed border-slate-400 text-base font-bold text-slate-800 inline-flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> New dish
          </button>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-700">Apply to</legend>
            {[
              { v: true, label: 'All 3 classes' },
              { v: false, label: `${category} only` },
            ].map((o) => (
              <label key={String(o.v)} className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl border border-slate-200">
                <input type="radio" name="apply" checked={applyAll === o.v} onChange={() => setApplyAll(o.v)} className="w-5 h-5" />
                <span className="text-base text-slate-900">{o.label}</span>
              </label>
            ))}
          </fieldset>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Portions {applyAll ? '(each class)' : ''}</span>
            <input
              type="number"
              inputMode="numeric"
              min={minPortions}
              max={10000}
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base"
            />
            {minPortions > 0 && <span className="text-sm text-slate-600">At least {minPortions} (already ordered).</span>}
          </label>

          {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="w-full min-h-[52px] rounded-xl bg-emerald-600 text-white text-lg font-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-5 h-5 animate-spin" />} Save
          </button>
        </>
      )}
    </BottomSheet>
  );
}

type DishValues = { name: string; price: number; isVegetarian: boolean; description: string };

function DishFields({
  initial,
  submitLabel,
  busy,
  onCancel,
  onSubmit,
  notes,
}: {
  initial?: Partial<Dish>;
  submitLabel: string;
  busy: boolean;
  onCancel?: () => void;
  onSubmit: (v: DishValues) => void;
  notes?: React.ReactNode;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState(initial?.price !== undefined ? String(initial.price) : '');
  const [veg, setVeg] = useState(initial?.isVegetarian !== false);
  const [description, setDescription] = useState(cleanDescription(initial?.description));
  const [problem, setProblem] = useState('');

  const submit = () => {
    const clean = name.trim().replace(/\s+/g, ' ');
    const p = Number(price);
    if (clean.length < 2) return setProblem('Please write the dish name (at least 2 letters).');
    if (!price.trim() || !Number.isFinite(p) || p <= 0 || p > 10000) return setProblem('Please enter a price above ₹0 (up to ₹10,000).');
    setProblem('');
    onSubmit({ name: clean, price: p, isVegetarian: veg, description: description.trim() });
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-bold text-slate-700">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 text-base" />
      </label>
      <label className="block">
        <span className="text-sm font-bold text-slate-700">Price (₹)</span>
        <input type="number" inputMode="decimal" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 text-base" />
      </label>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Veg or non-veg">
        {[
          { v: true, label: 'Veg' },
          { v: false, label: 'Non-veg' },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={veg === o.v}
            onClick={() => setVeg(o.v)}
            className={`min-h-[44px] rounded-xl border text-base font-bold ${veg === o.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-sm font-bold text-slate-700">Description (optional)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 text-base" />
      </label>
      {notes}
      {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
      <div className={`grid gap-2 ${onCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-base font-bold">
            Back
          </button>
        )}
        <button type="button" disabled={busy} onClick={submit} className="min-h-[48px] rounded-xl bg-emerald-600 text-white text-base font-black disabled:opacity-60">
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function DishForm({ title, initial, busy, onClose, onSave }: { title: string; initial?: Dish; busy: boolean; onClose: () => void; onSave: (v: DishValues) => void }) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <DishFields
        initial={initial}
        submitLabel="Save"
        busy={busy}
        onSubmit={onSave}
        notes={
          initial ? (
            <div className="space-y-1.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="font-bold">Edits this dish everywhere it&apos;s used.</p>
              <p>Price changes apply to new orders only, on every day this dish is on sale.</p>
              <p>The monthly menu file finds dishes by name. If you rename this dish, use the new name in future monthly files too, or the import will create a separate dish.</p>
            </div>
          ) : null
        }
      />
    </BottomSheet>
  );
}

function PortionsSheet({ card, busy, onClose, onSave }: { card: ClassCard; busy: boolean; onClose: () => void; onSave: (n: number) => void }) {
  const [value, setValue] = useState(String(card.maxQuantity ?? 50));
  const [problem, setProblem] = useState('');
  return (
    <BottomSheet title={`Portions: ${card.category}`} onClose={onClose}>
      <p className="text-base text-slate-700">
        {card.mealName}: {card.ordered} ordered so far.
      </p>
      <input
        type="number"
        inputMode="numeric"
        min={card.ordered}
        max={10000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Portions"
        className="w-full min-h-[48px] px-3 rounded-xl border border-slate-300 text-base"
      />
      <p className="text-sm text-slate-600">At least {card.ordered} (already ordered).</p>
      {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const n = Number(value);
          if (!Number.isInteger(n) || n < 0 || n > 10000) return setProblem('Portions must be a whole number from 0 to 10000.');
          if (n < card.ordered) return setProblem(`${card.ordered} already ordered. Portions can't be lower than that.`);
          setProblem('');
          onSave(n);
        }}
        className="w-full min-h-[52px] rounded-xl bg-emerald-600 text-white text-lg font-black disabled:opacity-60"
      >
        Save
      </button>
    </BottomSheet>
  );
}

function HolidaySheet({ day, busy, onClose, onSave }: { day: MenuDay; busy: boolean; onClose: () => void; onSave: (scope: 'ALL' | ClassName, reason: string) => void }) {
  const choices = day.classes.filter((c) => c.editable && c.state !== 'HOLIDAY').map((c) => c.category);
  const [scope, setScope] = useState<'ALL' | ClassName>(choices.length === 3 ? 'ALL' : choices[0] || 'ALL');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState('');
  return (
    <BottomSheet title={`Holiday: ${formatDatePretty(day.date)}`} onClose={onClose}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-slate-700">For</legend>
        {(choices.length === 3 ? (['ALL', ...choices] as Array<'ALL' | ClassName>) : choices).map((c) => (
          <label key={c} className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl border border-slate-200">
            <input type="radio" name="holiday-scope" checked={scope === c} onChange={() => setScope(c)} className="w-5 h-5" />
            <span className="text-base">{c === 'ALL' ? 'All 3 classes' : `${c} only`}</span>
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="text-sm font-bold text-slate-700">Reason</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diwali" maxLength={80} className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 text-base" />
      </label>
      {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (reason.trim().length < 2) return setProblem('Please write a short reason.');
          setProblem('');
          onSave(scope, reason.trim());
        }}
        className="w-full min-h-[52px] rounded-xl bg-rose-600 text-white text-lg font-black disabled:opacity-60"
      >
        Mark as holiday
      </button>
    </BottomSheet>
  );
}

function DishesTab({
  dishes,
  isAdmin,
  busy,
  onNew,
  onEdit,
  onDelete,
}: {
  dishes: Dish[];
  isAdmin: boolean;
  busy: boolean;
  onNew: () => void;
  onEdit: (d: Dish) => void;
  onDelete: (d: Dish) => void;
}) {
  const [search, setSearch] = useState('');
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dishes.filter((d) => !q || d.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [dishes, search]);
  const main = list.filter((d) => !d.dayOnly);
  const copies = list.filter((d) => d.dayOnly);
  const row = (d: Dish) => (
    <li key={d.id} className="px-3 py-2 flex items-center gap-2">
      <VegBadge isVegetarian={d.isVegetarian} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-slate-900 break-words">
          {d.name}
          {d.isExtra && <span className="ml-1.5 align-middle text-[11px] font-black uppercase tracking-wide text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Extra</span>}
        </p>
        <p className="text-sm text-slate-600">
          {formatINR(d.price)}
          {d.dayOnly && d.dayOnlyDate ? ` · only on ${formatDatePretty(d.dayOnlyDate)}` : ''}
        </p>
      </div>
      <button type="button" disabled={busy} onClick={() => onEdit(d)} className="min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm font-bold">
        Edit
      </button>
      {isAdmin && (
        <button type="button" disabled={busy} onClick={() => onDelete(d)} className="min-h-[44px] px-3 rounded-xl border border-rose-200 text-rose-700 text-sm font-bold">
          Delete
        </button>
      )}
    </li>
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes"
            className="w-full min-h-[48px] pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-base"
          />
        </div>
        <button type="button" onClick={onNew} className="min-h-[48px] px-4 shrink-0 rounded-xl bg-slate-900 text-white text-base font-bold inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>
      <ul className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl">
        {main.map(row)}
        {main.length === 0 && <li className="p-4 text-base text-slate-500">No dish matches.</li>}
      </ul>
      {copies.length > 0 && (
        <details className="bg-white border border-slate-200 rounded-2xl">
          <summary className="min-h-[44px] px-3 flex items-center text-base font-bold text-slate-700 cursor-pointer">Day-only copies ({copies.length})</summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">{copies.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

function DayEditSheet({
  day,
  card,
  dish,
  busy,
  onClose,
  onSave,
}: {
  day: MenuDay;
  card: ClassCard;
  dish: Dish | null;
  busy: boolean;
  onClose: () => void;
  onSave: (applyAll: boolean, v: DishValues) => void;
}) {
  // Default: every class that has this same dish today (usually all 3).
  const same = day.classes.filter((c) => c.editable && c.mealId === card.mealId);
  const [applyAll, setApplyAll] = useState(same.length === 3);
  const initial = dish || { id: card.mealId || '', name: card.mealName || '', price: card.price || 0, isVegetarian: card.isVegetarian !== false };
  return (
    <BottomSheet title={`Edit for ${formatDatePretty(day.date)} only`} onClose={onClose}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-slate-700">Apply to</legend>
        {[
          { v: true, label: 'All 3 classes' },
          { v: false, label: `${card.category} only` },
        ].map((o) => (
          <label key={String(o.v)} className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl border border-slate-200">
            <input type="radio" name="day-edit-apply" checked={applyAll === o.v} onChange={() => setApplyAll(o.v)} className="w-5 h-5" />
            <span className="text-base text-slate-900">{o.label}</span>
          </label>
        ))}
      </fieldset>
      <DishFields
        initial={initial}
        submitLabel="Save for this day"
        busy={busy}
        onSubmit={(v) => onSave(applyAll, v)}
        notes={
          <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
            Only {formatDatePretty(day.date)} changes. Other days keep the original dish.
          </p>
        }
      />
    </BottomSheet>
  );
}

function ExtraSheet({
  day,
  category,
  dishes,
  busy,
  onClose,
  onCreated,
  onSave,
}: {
  day: MenuDay;
  category: ClassName;
  dishes: Dish[];
  busy: boolean;
  onClose: () => void;
  onCreated: (d: Dish) => void;
  onSave: (mealId: string, applyAll: boolean, portions: number) => void;
}) {
  const card = day.classes.find((c) => c.category === category)!;
  const [search, setSearch] = useState('');
  const [mealId, setMealId] = useState('');
  const [applyAll, setApplyAll] = useState(false);
  const [portions, setPortions] = useState('20');
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState('');
  const taken = new Set([card.mealId, ...card.extras.map((x) => x.mealId)]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dishes
      .filter((d) => !d.dayOnly && !taken.has(d.id) && (!q || d.name.toLowerCase().includes(q)))
      .sort((a, b) => Number(Boolean(b.isExtra)) - Number(Boolean(a.isExtra)) || a.name.localeCompare(b.name));
  }, [dishes, search, card]);

  return (
    <BottomSheet title={`Add extra: ${formatDatePretty(day.date)}`} onClose={onClose}>
      {creating ? (
        <DishFields
          submitLabel="Add dish"
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={async (v) => {
            const r = await send('/api/admin/meals', 'POST', { ...v, category: 'SNACK' });
            const meal = (r.data.meal || null) as Dish | null;
            if (meal && (r.ok || r.data.code === 'DUPLICATE_RECIPE')) {
              onCreated(meal);
              setMealId(meal.id);
              setCreating(false);
              setProblem(r.ok ? '' : `${meal.name} is already in the list, so it was chosen.`);
            } else {
              setProblem(r.data.error || 'The dish could not be added.');
            }
          }}
        />
      ) : (
        <>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes"
              className="w-full min-h-[48px] pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-base"
            />
          </div>
          <ul className="max-h-[34vh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl" role="radiogroup">
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mealId === d.id}
                  onClick={() => setMealId(d.id)}
                  className={`w-full min-h-[52px] px-3 py-2 flex items-center justify-between gap-3 text-left ${mealId === d.id ? 'bg-amber-50' : 'bg-white'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-5 h-5 shrink-0 rounded-full border-2 ${mealId === d.id ? 'border-amber-600 bg-amber-500' : 'border-slate-300'}`} />
                    <VegBadge isVegetarian={d.isVegetarian} size="sm" />
                    <span className="text-base font-semibold text-slate-900 break-words min-w-0">
                      {d.name}
                      {d.isExtra && <span className="ml-1.5 text-[11px] font-black uppercase text-amber-800">Extra</span>}
                    </span>
                  </span>
                  <span className="text-base font-bold text-slate-800 shrink-0">{formatINR(d.price)}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="p-4 text-base text-slate-500">No dish matches.</li>}
          </ul>
          <button type="button" onClick={() => setCreating(true)} className="w-full min-h-[44px] rounded-xl border border-dashed border-slate-400 text-base font-bold text-slate-800 inline-flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> New dish
          </button>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-700">Apply to</legend>
            {[
              { v: false, label: `${category} only` },
              { v: true, label: 'All 3 classes' },
            ].map((o) => (
              <label key={String(o.v)} className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl border border-slate-200">
                <input type="radio" name="extra-apply" checked={applyAll === o.v} onChange={() => setApplyAll(o.v)} className="w-5 h-5" />
                <span className="text-base text-slate-900">{o.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Portions {applyAll ? '(each class)' : ''}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base"
            />
          </label>
          <p className="text-sm text-slate-600">Parents can add up to 3 of each extra per child, only with that day&apos;s brunch.</p>
          {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const n = Number(portions);
              if (!mealId) return setProblem('Choose a dish first.');
              if (!Number.isInteger(n) || n < 1 || n > 10000) return setProblem('Portions must be a whole number from 1 to 10000.');
              setProblem('');
              onSave(mealId, applyAll, n);
            }}
            className="w-full min-h-[52px] rounded-xl bg-emerald-600 text-white text-lg font-black disabled:opacity-60"
          >
            Save
          </button>
        </>
      )}
    </BottomSheet>
  );
}

const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthOf = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

/** Every date of a month, one compact row per day; tapping a row opens it in the Menu tab. */
function MonthTab({ startMonth, today, onOpenDay }: { startMonth: string; today: string; onOpenDay: (date: string) => void }) {
  const thisMonth = monthIndex(today.slice(0, 7));
  const clamp = (i: number) => Math.min(thisMonth + 6, Math.max(thisMonth - 6, i));
  const [month, setMonth] = useState(() => monthOf(clamp(monthIndex(startMonth))));
  const [days, setDays] = useState<MenuDay[] | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await fetchWithTimeout(`/api/staff/menu-month?month=${month}`);
      const body = await res.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!res.ok) return setError(body.error || 'Could not load the month.');
      setDays(body.days || []);
      setError('');
    } catch {
      if (mine === seq.current) setError('Could not load the month. Check the connection.');
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);
  useSyncWatcher({ pollIntervalMs: 60000, onMenuUpdate: () => load() });

  const idx = monthIndex(month);
  const label = new Date(`${month}-15T12:00:00+05:30`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const short: Record<string, string> = { 'Pre-primary': 'PP', Primary: 'P', Secondary: 'S' };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={idx <= thisMonth - 6} onClick={() => setMonth(monthOf(idx - 1))} aria-label="Previous month" className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-300 bg-white disabled:opacity-40">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-lg font-black text-slate-900">{label}</p>
        <button type="button" disabled={idx >= thisMonth + 6} onClick={() => setMonth(monthOf(idx + 1))} aria-label="Next month" className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-300 bg-white disabled:opacity-40">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      {error && <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold">{error}</div>}
      {!days ? (
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden />
      ) : (
        <ul className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl">
          {days.map((d) => {
            const holiday = d.classes.find((c) => c.state === 'HOLIDAY');
            const text = d.isSunday
              ? 'Sunday'
              : d.status === 'HOLIDAY'
                ? `Holiday: ${holiday?.holidayReason || ''}`
                : d.status === 'NONE'
                  ? 'Nothing on sale'
                  : d.classes
                      .map((c) => `${short[c.category]} ${c.state === 'ON_SALE' ? c.mealName : c.state === 'HOLIDAY' ? 'Holiday' : '—'}${c.extras.length ? ` +${c.extras.length}` : ''}`)
                      .join(' · ');
            return (
              <li key={d.date}>
                <button
                  type="button"
                  onClick={() => onOpenDay(d.date)}
                  className={`w-full min-h-[48px] px-3 py-2 flex items-start gap-3 text-left ${d.isToday ? 'bg-amber-50' : ''} ${d.isPast ? 'text-slate-400' : ''}`}
                >
                  <span className="w-14 shrink-0 text-sm font-black">
                    {d.weekday} {Number(d.date.slice(8, 10))}
                  </span>
                  <span className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${DOT[d.status].color}`} aria-label={DOT[d.status].label} />
                  <span className="min-w-0 text-sm text-slate-800 break-words">{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
