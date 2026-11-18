'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { formatDatePretty, formatINR, getTodayString } from '@/lib/utils';
import { broadcastSyncEvent, useSyncWatcher } from '@/lib/client-sync';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import VegBadge from '@/components/VegBadge';
import {
  DEFAULT_BRUNCH_PRICES,
  DEFAULT_PORTIONS,
  MAX_BRUNCH_PRICE,
  MAX_DEFAULT_PORTIONS,
  portionChanges,
  priceChanges,
  validateBrunchPrices,
  validateBulkPortions,
  validateDefaultPortions,
  type BrunchPrices,
  type DefaultPortions,
} from '@/lib/brunch-prices';
import { DEFAULT_ORDERING_CUTOFF, validCutoff } from '@/lib/ordering-cutoff';

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
  /** Extra price: used only when the dish is sold as an extra (the brunch price is set by class). */
  price: number | null;
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
  // Portions a new main dish starts with, per class (from the settings card; 500 until saved).
  const [defaultPortions, setDefaultPortions] = useState<DefaultPortions>(DEFAULT_PORTIONS);
  const seq = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);
  // One save at a time: a second tap while a save is running does nothing.
  const inFlight = useRef(false);

  // A success message clears itself; an error stays until it is closed.
  useEffect(() => {
    if (!notice?.ok) return;
    const id = setTimeout(() => setNotice((n) => (n === notice ? null : n)), 6000);
    return () => clearTimeout(id);
  }, [notice]);

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
      : d.status === 'HOLIDAY'
        ? 'Holiday: no brunch for any class.'
      : d.isPast
        ? 'Past day: view only.'
        : d.classes.every((c) => !c.editable)
          ? `Ordering closed at ${d.classes[0]?.deadline || DEFAULT_ORDERING_CUTOFF}: view only.`
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
    // Portions: set when chosen and different from what the class now has (a new dish starts at the
    // class's default portions).
    if (portions !== null) {
      for (const cat of targets) {
        const before = cardsBefore.find((c) => c.category === cat);
        const current = before?.mealId === mealId ? before.maxQuantity : defaultPortions[cat];
        if (current !== portions) {
          const p = await send('/api/admin/menus/portions', 'POST', { date, studentCategory: cat, portions });
          if (!p.ok) return { ok: false, data: { ...p.data, error: `${cat}: ${p.data.error || 'Portions not saved.'}` } };
        }
      }
    }
    return { ok: true, data: r.data };
  };

  const saveDish = async (category: ClassName, applyAll: boolean, mealId: string, portions: number | null) => {
    if (!day || inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
      setBusy(false);
      await refreshAfterChange();
    }
  };

  const saveDayEdit = async (card: ClassCard, applyAll: boolean, v: DishValues) => {
    if (!day || !card.mealId || inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
      setBusy(false);
      await refreshAfterChange();
      await loadDishes();
    }
  };

  const run = async (action: () => Promise<{ ok: boolean; data: Record<string, any> }>, success: string) => {
    if (inFlight.current) return false;
    inFlight.current = true;
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
      inFlight.current = false;
      setBusy(false);
      await refreshAfterChange();
      await loadDishes();
    }
  };


  // --- Render ----------------------------------------------------------------------------------

  const TABS = [
    { id: 'MENU' as const, label: 'Menu', icon: CalendarDays },
    { id: 'MONTH' as const, label: 'Month', icon: CalendarRange },
    { id: 'DISHES' as const, label: 'Dishes', icon: BookOpen },
  ];
  const openUntil = day ? viewOnlyReason(day) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-36 md:pb-16 space-y-5 overflow-x-hidden">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Student Menu</h1>
          <p className="text-sm sm:text-base text-slate-600">What parents can order, by day and class.</p>
        </div>
        <Link
          href="/staff/menu-import"
          className="self-start sm:self-auto min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50 inline-flex items-center gap-2 shadow-sm"
        >
          <Upload className="w-4 h-4" /> Import monthly menu
        </Link>
      </header>

      {/* Tabs */}
      <div role="tablist" aria-label="Student Menu" className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 sm:inline-grid sm:w-[420px]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] rounded-xl text-base font-bold inline-flex items-center justify-center gap-2 transition-colors ${
                active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'MENU' ? (
        <>
          <BrunchPricesCard isAdmin={isAdmin} onDefaults={setDefaultPortions} onApplied={() => refreshAfterChange()} />

          {/* Date strip: scrolls sideways on its own; the page never does. */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 sm:p-3 space-y-2" aria-label="Choose a day">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shiftWindow(-7)} aria-label="Earlier days" className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div ref={stripRef} className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {days.map((d) => {
                  const active = selected === d.date;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      data-date={d.date}
                      onClick={() => setSelected(d.date)}
                      aria-pressed={active}
                      aria-label={`${d.isToday ? 'Today, ' : ''}${d.weekday} ${dayNumber(d.date)}: ${DOT[d.status].label}`}
                      className={`shrink-0 w-[60px] min-h-[68px] rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900 shadow'
                          : d.isPast
                            ? 'bg-slate-50 text-slate-400 border-slate-200'
                            : d.isToday
                              ? 'bg-white text-slate-900 border-amber-400 ring-1 ring-amber-400'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide">{d.isToday ? 'Today' : d.weekday}</span>
                      <span className="text-lg font-black leading-none">{dayNumber(d.date)}</span>
                      <span className={`w-2 h-2 rounded-full ${DOT[d.status].color}`} />
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => shiftWindow(7)} aria-label="Later days" className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 text-xs text-slate-600">
              {(['ALL', 'SOME', 'NONE', 'HOLIDAY', 'SUNDAY'] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${DOT[s].color}`} /> {DOT[s].label}
                </span>
              ))}
            </div>
          </section>

          {error && (
            <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold flex items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" onClick={() => loadDays()} className="min-h-[44px] px-3 rounded-lg bg-white border border-rose-300 font-bold shrink-0">
                Try again
              </button>
            </div>
          )}

          {error && !day ? null : !loaded || !day ? (
            <div className="grid gap-4 lg:grid-cols-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-72 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Selected day */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    {day.isToday && <span className="text-amber-600">Today · </span>}
                    {formatDatePretty(day.date)}
                  </h2>
                  {openUntil ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
                      <Lock className="w-3.5 h-3.5" /> {openUntil}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-sm font-semibold">
                      <Clock className="w-3.5 h-3.5" /> Parents can order until {day.classes[0]?.deadline || DEFAULT_ORDERING_CUTOFF}
                      {day.isToday ? ' today' : ' on the day'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {anyEditable && day.status !== 'HOLIDAY' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setSheet({ kind: 'holiday' })}
                      className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold hover:bg-slate-50 inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      <CalendarOff className="w-4 h-4" /> Mark as holiday
                    </button>
                  )}
                  {!day.isPast && day.status === 'HOLIDAY' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => send('/api/admin/menus/holiday', 'POST', { date: day.date, studentCategory: 'ALL', action: 'undo' }), 'Holiday removed. Nothing is on sale yet.')}
                      className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold hover:bg-slate-50 disabled:opacity-60"
                    >
                      Undo holiday (all classes)
                    </button>
                  )}
                </div>
              </div>

              {/* One card per class: side by side on wide screens, stacked on phones. */}
              <div className="grid gap-4 lg:grid-cols-3 items-start">
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
                      else setNotice({ ok: false, text: 'This dish is still loading. Please try again in a moment.' });
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
        <DishesTab
          dishes={dishes}
          isAdmin={isAdmin}
          busy={busy}
          onNew={() => setSheet({ kind: 'new' })}
          onEdit={(d) => setSheet({ kind: 'edit', dish: d })}
          onDelete={(d) => {
            if (!window.confirm(`Delete ${d.name} from the dish list? This cannot be undone.`)) return;
            run(() => send(`/api/admin/meals?id=${encodeURIComponent(d.id)}`, 'DELETE'), `${d.name} deleted.`);
          }}
        />
      )}

      {/* Messages float above the page, so they are seen wherever the button was. */}
      {notice && (
        <div className="fixed inset-x-0 bottom-24 md:bottom-6 z-[70] px-4 pointer-events-none">
          <div
            role={notice.ok ? 'status' : 'alert'}
            className={`pointer-events-auto max-w-lg mx-auto p-3 rounded-2xl border shadow-lg text-base font-semibold space-y-2 ${
              notice.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2">
              {notice.ok ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
              <span className="min-w-0 flex-1 break-words">{notice.text}</span>
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
        </div>
      )}

      {/* Sheets */}
      {sheet?.kind === 'dish' && day && (
        <DishSheet
          day={day}
          category={sheet.category}
          mode={sheet.mode}
          dishes={dishes}
          defaultPortions={defaultPortions}
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
          title={`Portions: ${sheet.extra.mealName}`}
          subtitle={`Extra for ${sheet.card.category}`}
          ordered={sheet.extra.ordered}
          total={sheet.extra.maxQuantity}
          left={sheet.extra.availableQuantity}
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
        <ConfirmSheet
          title="Remove extra"
          busy={busy}
          confirmLabel="Remove extra"
          onClose={() => setSheet(null)}
          onConfirm={() =>
            run(
              () => send('/api/admin/menus/extras', 'POST', { action: 'remove', date: day.date, studentCategory: sheet.card.category, mealId: sheet.extra.mealId }),
              `${sheet.extra.mealName} removed from ${formatDatePretty(day.date)}, ${sheet.card.category}.`
            )
          }
        >
          Remove the extra {sheet.extra.mealName} from {formatDatePretty(day.date)}, {sheet.card.category}? Parents will no longer be able to order it.
        </ConfirmSheet>
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
          title="Add dish"
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={(v) => run(() => send('/api/admin/meals', 'POST', { ...v, category: 'LUNCH' }), `${v.name} added to the dish list.`)}
        />
      )}
      {sheet?.kind === 'portions' && day && (
        <PortionsSheet
          title={`Portions: ${sheet.card.category}`}
          subtitle={sheet.card.mealName || ''}
          ordered={sheet.card.ordered}
          total={sheet.card.maxQuantity}
          left={sheet.card.availableQuantity}
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
        <ConfirmSheet
          title="Remove dish"
          busy={busy}
          confirmLabel="Remove"
          onClose={() => setSheet(null)}
          onConfirm={() =>
            run(
              () => send('/api/admin/menus/unpublish', 'POST', { date: day.date, studentCategory: sheet.card.category }),
              `${sheet.card.mealName} removed from ${formatDatePretty(day.date)}, ${sheet.card.category}. Parents can no longer order it.`
            )
          }
        >
          Remove {sheet.card.mealName} from {formatDatePretty(day.date)}, {sheet.card.category}? Parents will no longer be able to order it.
        </ConfirmSheet>
      )}
    </div>
  );
}

// --- Pieces ----------------------------------------------------------------------------------

/**
 * Student Menu settings card (staff and admin): brunch prices by class, default portions per class
 * for new main menu entries, and "Apply portions to upcoming days". The server validates and stores
 * everything (/api/admin/menus/brunch-prices, /api/admin/menus/portions/bulk); each save first
 * shows a confirmation (old → new), so a typo (₹90 → ₹900) is caught.
 */
function BrunchPricesCard({ isAdmin = false, onDefaults, onApplied }: { isAdmin?: boolean; onDefaults: (d: DefaultPortions) => void; onApplied: () => void }) {
  type Form = Record<ClassName, string>;
  const toForm = (v: Record<ClassName, number>): Form => ({ 'Pre-primary': String(v['Pre-primary']), Primary: String(v.Primary), Secondary: String(v.Secondary) });
  type Saved = { prices: BrunchPrices; defaultPortions: DefaultPortions; orderingCutoff: string };
  const [saved, setSaved] = useState<Saved | null>(null);
  const [cutoffForm, setCutoffForm] = useState('');
  const [priceForm, setPriceForm] = useState<Form>({ 'Pre-primary': '', Primary: '', Secondary: '' });
  const [portionForm, setPortionForm] = useState<Form>({ 'Pre-primary': '', Primary: '', Secondary: '' });
  const [loadError, setLoadError] = useState('');
  const [problem, setProblem] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; lines: string[]; note: string; body: Record<string, unknown> } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const show = useCallback(
    (s: Saved) => {
      setSaved(s);
      setPriceForm(toForm(s.prices));
      setPortionForm(toForm(s.defaultPortions));
      setCutoffForm(s.orderingCutoff);
      onDefaults(s.defaultPortions);
    },
    [onDefaults]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/admin/menus/brunch-prices');
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.prices) {
        setLoadError(body.error || 'Could not load the brunch prices.');
        return;
      }
      setLoadError('');
      show({
        prices: body.prices as BrunchPrices,
        defaultPortions: (body.defaultPortions || DEFAULT_PORTIONS) as DefaultPortions,
        orderingCutoff: validCutoff(body.orderingCutoff) || DEFAULT_ORDERING_CUTOFF,
      });
    } catch {
      setLoadError('Could not load the brunch prices. Check the connection.');
    }
  }, [show]);

  useEffect(() => {
    load();
  }, [load]);

  const reviewPrices = () => {
    setMessage('');
    if (!saved) return;
    const v = validateBrunchPrices(priceForm);
    if (!v.ok) return setProblem(v.error);
    setProblem('');
    const lines = priceChanges(saved.prices, v.prices);
    if (lines.length === 0) return setMessage('No change: the prices are the same.');
    setConfirm({ title: 'Change brunch prices?', lines, note: 'Orders already paid keep the price they were bought at.', body: { prices: v.prices } });
  };

  const reviewPortions = () => {
    setMessage('');
    if (!saved) return;
    const v = validateDefaultPortions(portionForm);
    if (!v.ok) return setProblem(v.error);
    setProblem('');
    const lines = portionChanges(saved.defaultPortions, v.portions);
    if (lines.length === 0) return setMessage('No change: the default portions are the same.');
    setConfirm({ title: 'Change default portions?', lines, note: 'Used for new menu entries only. Days already on the menu keep their portions.', body: { defaultPortions: v.portions } });
  };

  /** "Ordering closes at" (admin only): one cutoff for every class and day. */
  const reviewCutoff = () => {
    setMessage('');
    if (!saved) return;
    const t = validCutoff(cutoffForm);
    if (!t) return setProblem('Please enter a real time (HH:MM).');
    setProblem('');
    if (t === saved.orderingCutoff) return setMessage('No change: ordering already closes at that time.');
    setConfirm({
      title: 'Change when ordering closes?',
      lines: [`Ordering closes: ${saved.orderingCutoff} → ${t}`],
      note: 'Applies to every class and every day, including menus already published. Teachers are not affected.',
      body: { orderingCutoff: t },
    });
  };

  const save = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      const r = await send('/api/admin/menus/brunch-prices', 'PUT', confirm.body);
      if (r.ok && r.data.prices) {
        show({
          prices: r.data.prices as BrunchPrices,
          defaultPortions: r.data.defaultPortions as DefaultPortions,
          orderingCutoff: validCutoff(r.data.orderingCutoff) || DEFAULT_ORDERING_CUTOFF,
        });
        setMessage(r.data.message || 'Saved.');
        broadcastSyncEvent('MENU_UPDATED');
      } else {
        setProblem(r.data.error || 'Not saved. Please try again.');
      }
    } catch {
      setProblem('Not saved: no connection. Please try again.');
    } finally {
      setConfirm(null);
      setBusy(false);
    }
  };

  const numberFields = (form: Form, setForm: React.Dispatch<React.SetStateAction<Form>>, unit: string, max: number, placeholder: (c: ClassName) => string) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {CLASSES.map((c) => (
        <label key={c} className="block">
          <span className="text-sm font-bold text-slate-700">
            {c} {unit}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            step={1}
            disabled={!saved || busy}
            value={form[c]}
            placeholder={placeholder(c)}
            onChange={(e) => setForm((f) => ({ ...f, [c]: e.target.value }))}
            className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
          />
        </label>
      ))}
    </div>
  );

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4" aria-labelledby="brunch-prices-title">
      {loadError ? (
        <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button type="button" onClick={() => load()} className="min-h-[44px] px-3 rounded-lg bg-white border border-rose-300 font-bold shrink-0">
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <h2 id="brunch-prices-title" className="text-lg font-black text-slate-900">Brunch prices by class</h2>
              <p className="text-sm text-slate-600">Every main brunch costs the class price, whatever the dish. Changes apply to new orders only.</p>
            </div>
            {numberFields(priceForm, setPriceForm, '(₹)', MAX_BRUNCH_PRICE, (c) => String(DEFAULT_BRUNCH_PRICES[c]))}
            <p className="text-xs text-slate-500">Whole rupees, ₹1 to ₹{MAX_BRUNCH_PRICE}. Extras and the teacher menu keep their own prices.</p>
            <button type="button" disabled={!saved || busy} onClick={reviewPrices} className={`${PRIMARY_BTN} w-full sm:w-auto px-6`}>
              Save prices
            </button>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Ordering closes at</h3>
              <p className="text-sm text-slate-600">Parents can order (brunch and extras) until this time on the meal day, for every class. Teachers have no cutoff.</p>
            </div>
            {isAdmin ? (
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Time (IST)</span>
                  <input
                    type="time"
                    step={60}
                    disabled={!saved || busy}
                    value={cutoffForm}
                    onChange={(e) => setCutoffForm(e.target.value)}
                    className="mt-1 w-full sm:w-40 min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
                  />
                </label>
                <button type="button" disabled={!saved || busy} onClick={reviewCutoff} className={`${PRIMARY_BTN} px-6`}>
                  Save time
                </button>
              </div>
            ) : (
              <p className="text-2xl font-black text-slate-900 tabular-nums" data-testid="ordering-cutoff">
                {saved?.orderingCutoff || DEFAULT_ORDERING_CUTOFF}
                <span className="block text-xs font-semibold text-slate-500">Only the admin can change this.</span>
              </p>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Default portions per class</h3>
              <p className="text-sm text-slate-600">Portions a new main dish starts with (monthly import, Add dish, Change dish into an empty class). Extras keep their own portions.</p>
            </div>
            {numberFields(portionForm, setPortionForm, '(portions)', MAX_DEFAULT_PORTIONS, (c) => String(DEFAULT_PORTIONS[c]))}
            <p className="text-xs text-slate-500">Whole numbers, 1 to {MAX_DEFAULT_PORTIONS}.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" disabled={!saved || busy} onClick={reviewPortions} className={`${PRIMARY_BTN} px-6`}>
                Save default portions
              </button>
              <button
                type="button"
                disabled={!saved || busy}
                onClick={() => {
                  setMessage('');
                  setProblem('');
                  setBulkOpen(true);
                }}
                className="min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Apply portions to upcoming days
              </button>
            </div>
          </div>
          {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
          {message && <p role="status" className="text-base font-semibold text-emerald-800">{message}</p>}
        </>
      )}
      {confirm && (
        <BottomSheet title={confirm.title} subtitle="Please check before saving." onClose={() => setConfirm(null)}>
          <ul className="space-y-1.5" aria-label="Changes">
            {confirm.lines.map((line) => (
              <li key={line} className="text-lg font-bold text-slate-900">
                {line}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">{confirm.note}</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-base font-bold hover:bg-slate-50">
              Go back
            </button>
            <button type="button" disabled={busy} onClick={save} className={`${PRIMARY_BTN} min-h-[48px]`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
          </div>
        </BottomSheet>
      )}
      {bulkOpen && saved && <BulkPortionsSheet defaults={saved.defaultPortions} onClose={() => setBulkOpen(false)} onApplied={onApplied} />}
    </section>
  );
}

/**
 * "Apply portions to upcoming days": choose classes and a number, confirm, and every upcoming main
 * menu entry for those classes gets it (never below what is already ordered). Shows what was
 * updated and lists what was skipped.
 */
function BulkPortionsSheet({ defaults, onClose, onApplied }: { defaults: DefaultPortions; onClose: () => void; onApplied: () => void }) {
  const [classes, setClasses] = useState<ClassName[]>([...CLASSES]);
  const [portions, setPortions] = useState(String(defaults.Primary));
  const [step, setStep] = useState<'choose' | 'confirm' | 'done'>('choose');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; skipped: Array<{ date: string; category: string; reason: string }> } | null>(null);

  const review = () => {
    const v = validateBulkPortions({ classes, portions });
    if (!v.ok) return setProblem(v.error);
    setProblem('');
    setStep('confirm');
  };

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await send('/api/admin/menus/portions/bulk', 'POST', { classes, portions: Number(portions) });
      if (r.ok) {
        setResult({ message: r.data.message || 'Done.', skipped: Array.isArray(r.data.skipped) ? r.data.skipped : [] });
        setStep('done');
        broadcastSyncEvent('MENU_UPDATED');
        onApplied();
      } else {
        setProblem(r.data.error || 'Not applied. Please try again.');
        setStep('choose');
      }
    } catch {
      setProblem('Not applied: no connection. Please try again.');
      setStep('choose');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title="Apply portions to upcoming days" subtitle="Main dishes only. Extras keep their own portions." onClose={onClose}>
      {step === 'choose' && (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-700 mb-1">Classes</legend>
            {CLASSES.map((c) => (
              <label key={c} className={`flex items-center gap-3 min-h-[48px] px-3 rounded-xl border cursor-pointer ${classes.includes(c) ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
                <input
                  type="checkbox"
                  checked={classes.includes(c)}
                  onChange={(e) => setClasses((prev) => (e.target.checked ? CLASSES.filter((x) => x === c || prev.includes(x)) : prev.filter((x) => x !== c)))}
                  className="w-5 h-5 accent-slate-900 text-base"
                />
                <span className="text-base font-semibold">{c}</span>
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Portions for each day</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DEFAULT_PORTIONS}
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
          {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
          <SheetActions busy={busy} onCancel={onClose} onSave={review} saveLabel="Next" />
        </>
      )}
      {step === 'confirm' && (
        <>
          <p className="text-base text-slate-900">
            Set portions to <span className="font-black">{Number(portions)}</span> for <span className="font-black">{classes.join(', ')}</span> on every upcoming day (today too, if ordering is still open)?
          </p>
          <p className="text-sm text-slate-600">Never below what is already ordered: those days are skipped and listed. Past and closed days are not changed.</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setStep('choose')} disabled={busy} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-base font-bold hover:bg-slate-50">
              Go back
            </button>
            <button type="button" disabled={busy} onClick={apply} className={`${PRIMARY_BTN} min-h-[48px]`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Apply
            </button>
          </div>
        </>
      )}
      {step === 'done' && result && (
        <>
          <p role="status" className="text-lg font-black text-slate-900">{result.message}</p>
          {result.skipped.length > 0 && (
            <ul className="max-h-[34dvh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl" aria-label="Skipped">
              {result.skipped.map((s) => (
                <li key={`${s.date}-${s.category}`} className="px-3 py-2 text-sm text-slate-700">
                  <span className="font-bold">{formatDatePretty(s.date)} · {s.category}</span>: {s.reason}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={onClose} className={`${PRIMARY_BTN} w-full`}>
            Done
          </button>
        </>
      )}
    </BottomSheet>
  );
}

const PRIMARY_BTN =
  'min-h-[48px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-base font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-colors';
const SECONDARY_BTN =
  'min-h-[48px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-left inline-flex items-center gap-2 disabled:opacity-60 transition-colors';

function StatusPill({ state }: { state: ClassCard['state'] }) {
  if (state === 'HOLIDAY') return <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold">Holiday</span>;
  if (state === 'ON_SALE')
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> On sale
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Not on sale
    </span>
  );
}

/** Ordered / Portions / Left, exactly as the server reports them. */
function Counts({ ordered, total, left, small = false }: { ordered: number; total: number | null; left: number | null; small?: boolean }) {
  const cell = (label: string, value: number | null, strong = false) => (
    <div className="flex-1 min-w-0 px-2 py-1.5 text-center">
      <p className={`${small ? 'text-base' : 'text-xl'} font-black tabular-nums ${strong ? 'text-slate-900' : 'text-slate-800'}`}>{value ?? '–'}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
  return (
    <div className="flex divide-x divide-slate-200 rounded-xl bg-slate-50 border border-slate-200">
      {cell('Ordered', ordered, true)}
      {cell('Portions', total)}
      {cell('Left', left)}
    </div>
  );
}

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
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 pt-4">
        <h3 className="text-base font-black text-slate-900">{c.category}</h3>
        <StatusPill state={c.state} />
      </header>

      <div className="p-4 space-y-4">
        {c.state === 'HOLIDAY' ? (
          <>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
              <p className="text-sm font-bold text-rose-700">No brunch</p>
              <p className="text-lg font-black text-slate-900 break-words">{c.holidayReason}</p>
            </div>
            {!day.isPast && (
              <button type="button" disabled={busy} onClick={onUndoHoliday} className={`${SECONDARY_BTN} w-full justify-center font-bold`}>
                Undo holiday
              </button>
            )}
          </>
        ) : onSale ? (
          <>
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-black text-slate-900 leading-snug break-words min-w-0">{c.mealName}</p>
                <span className="text-lg font-black text-slate-900 shrink-0 text-right leading-tight">
                  {c.price !== null ? formatINR(c.price) : ''}
                  {c.price !== null && <span className="block text-[11px] font-semibold text-slate-500">class price</span>}
                </span>
              </div>
              {c.isVegetarian !== null && <VegBadge isVegetarian={c.isVegetarian} size="sm" showLabel />}
            </div>
            <Counts ordered={c.ordered} total={c.maxQuantity} left={c.availableQuantity} />

            {c.shared && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Shared by all 3 classes (older entry). Changing one class gives each class its own.
              </p>
            )}
            {c.duplicates > 0 && (
              <p className="text-sm text-slate-600">
                {c.duplicates} older duplicate {c.duplicates === 1 ? 'entry is' : 'entries are'} hidden from parents.
              </p>
            )}

            {c.editable && (
              <button type="button" disabled={busy} onClick={onAdd} className={`${PRIMARY_BTN} w-full`}>
                <Repeat className="w-4 h-4" /> Change dish
              </button>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
              {c.editable && c.mealId && (
                <button type="button" disabled={busy} onClick={onDayEdit} className={SECONDARY_BTN}>
                  <CalendarCheck className="w-4 h-4 shrink-0 text-slate-500" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">Edit for this day</span>
                    <span className="block text-xs text-slate-500 leading-tight">This date only</span>
                  </span>
                </button>
              )}
              {c.mealId && (
                <button type="button" disabled={busy} onClick={onEdit} className={SECONDARY_BTN}>
                  <Pencil className="w-4 h-4 shrink-0 text-slate-500" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">Edit everywhere</span>
                    <span className="block text-xs text-slate-500 leading-tight">Every day it&apos;s used</span>
                  </span>
                </button>
              )}
              {c.editable && (
                <button type="button" disabled={busy} onClick={onPortions} className={SECONDARY_BTN}>
                  <Layers className="w-4 h-4 shrink-0 text-slate-500" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">Portions</span>
                    <span className="block text-xs text-slate-500 leading-tight">{c.maxQuantity ?? '–'} in total</span>
                  </span>
                </button>
              )}
              {c.removable && (
                <button type="button" disabled={busy} onClick={onRemove} className={`${SECONDARY_BTN} border-rose-200 hover:bg-rose-50 text-rose-700`}>
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-bold">Remove</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center space-y-3">
            <p className="text-base font-bold text-slate-500">Nothing on sale</p>
            {c.editable && (
              <button type="button" disabled={busy} onClick={onAdd} className={`${PRIMARY_BTN} w-full`}>
                <Plus className="w-4 h-4" /> Add dish
              </button>
            )}
          </div>
        )}
      </div>

      {/* Extras: optional add-ons, ordered by parents together with the brunch. */}
      {onSale && (c.extras.length > 0 || c.editable) && (
        <section className="border-t border-amber-100 bg-amber-50/50 px-4 py-3 space-y-2" aria-label={`Extras for ${c.category}`}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-black text-amber-900">Extras</p>
            <p className="text-xs text-amber-800">Optional add-ons with the brunch</p>
          </div>
          {c.extras.length === 0 && <p className="text-sm text-slate-600">No extras for this day.</p>}
          {c.extras.map((x) => (
            <div key={x.mealId} className="rounded-xl bg-white border border-amber-100 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  {x.isVegetarian !== null && <VegBadge isVegetarian={x.isVegetarian} size="sm" />}
                  <span className="text-base font-bold text-slate-900 break-words min-w-0">{x.mealName}</span>
                </span>
                <span className="text-base font-bold text-slate-900 shrink-0">{x.price !== null ? formatINR(x.price) : ''}</span>
              </div>
              <Counts ordered={x.ordered} total={x.maxQuantity} left={x.availableQuantity} small />
              {(c.editable || !day.isPast) && (
                <div className="grid grid-cols-2 gap-2">
                  {c.editable && (
                    <button type="button" disabled={busy} onClick={() => onExtraPortions(x)} className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-bold hover:bg-slate-50 disabled:opacity-60">
                      Portions
                    </button>
                  )}
                  {!day.isPast && (
                    <button type="button" disabled={busy} onClick={() => onExtraRemove(x)} className="min-h-[44px] rounded-xl border border-rose-200 bg-white text-rose-700 text-sm font-bold hover:bg-rose-50 disabled:opacity-60">
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {c.editable && (
            <button type="button" disabled={busy} onClick={onExtraAdd} className="w-full min-h-[44px] rounded-xl border border-dashed border-amber-400 bg-white text-amber-900 text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-amber-50 disabled:opacity-60">
              <Plus className="w-4 h-4" /> Add extra
            </button>
          )}
        </section>
      )}
    </article>
  );
}

function BottomSheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  // Escape closes; the page behind does not scroll while the sheet is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-lg font-black text-slate-900 break-words">{title}</p>
            {subtitle && <p className="text-sm text-slate-600 break-words">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ConfirmSheet({
  title,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
  children,
}: {
  title: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className="text-base text-slate-900">{children}</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-base font-bold hover:bg-slate-50">
          Keep it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

/** Two big choices (radio cards): "All 3 classes" and "<class> only". */
function ApplyTo({ name, category, value, onChange, allFirst = true }: { name: string; category: ClassName; value: boolean; onChange: (all: boolean) => void; allFirst?: boolean }) {
  const options = [
    { v: true, label: 'All 3 classes', hint: 'Pre-primary, Primary and Secondary' },
    { v: false, label: `${category} only`, hint: 'The other classes stay as they are' },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold text-slate-700 mb-1">Apply to</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(allFirst ? options : [...options].reverse()).map((o) => (
          <label
            key={String(o.v)}
            className={`flex items-start gap-3 min-h-[52px] px-3 py-2 rounded-xl border cursor-pointer ${value === o.v ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}
          >
            <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} className="w-5 h-5 mt-0.5 accent-slate-900" />
            <span>
              <span className="block text-base font-bold text-slate-900">{o.label}</span>
              <span className="block text-xs text-slate-500">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DishPicker({
  dishes,
  selectedId,
  onSelect,
  onNew,
  emptyText = 'No dish matches.',
  showPrice = true,
}: {
  dishes: Dish[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  emptyText?: string;
  /** Extras show each dish's (extra) price; a main brunch is priced by class, so no dish price. */
  showPrice?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dishes.filter((d) => !q || d.name.toLowerCase().includes(q));
  }, [dishes, search]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dishes"
          aria-label="Search dishes"
          className="w-full min-h-[48px] pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      <ul className="max-h-[34dvh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl" role="radiogroup" aria-label="Dishes">
        {filtered.map((d) => {
          const active = selectedId === d.id;
          return (
            <li key={d.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(d.id)}
                className={`w-full min-h-[52px] px-3 py-2 flex items-center justify-between gap-3 text-left ${active ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                    {active && <Check className="w-3 h-3" />}
                  </span>
                  <VegBadge isVegetarian={d.isVegetarian} size="sm" />
                  <span className="text-base font-semibold text-slate-900 break-words min-w-0">
                    {d.name}
                    {d.isExtra && <span className="ml-1.5 align-middle text-[11px] font-black uppercase tracking-wide text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Extra</span>}
                  </span>
                </span>
                {showPrice && <span className="text-base font-bold text-slate-800 shrink-0">{d.price !== null && d.price !== undefined ? formatINR(d.price) : 'No price'}</span>}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="p-4 text-base text-slate-500">{emptyText}</li>}
      </ul>
      <button type="button" onClick={onNew} className="w-full min-h-[44px] rounded-xl border border-dashed border-slate-400 text-base font-bold text-slate-800 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5">
        <Plus className="w-4 h-4" /> New dish
      </button>
    </div>
  );
}

function DishSheet({
  day,
  category,
  mode,
  dishes,
  defaultPortions,
  busy,
  onClose,
  onCreated,
  onSave,
}: {
  day: MenuDay;
  category: ClassName;
  mode: 'add' | 'change';
  dishes: Dish[];
  defaultPortions: DefaultPortions;
  busy: boolean;
  onClose: () => void;
  onCreated: (d: Dish) => void;
  onSave: (mealId: string, applyAll: boolean, portions: number | null) => void;
}) {
  const card = day.classes.find((c) => c.category === category)!;
  const [mealId, setMealId] = useState<string>(card.mealId || '');
  const [applyAll, setApplyAll] = useState(true);
  // Starts at the class's total, but never below what is already ordered (shown on screen; the
  // server still enforces it).
  const [portions, setPortions] = useState(() =>
    String(Math.max(card.maxQuantity ?? defaultPortions[category], ...day.classes.filter((c) => c.editable && c.mealId && c.mealId === card.mealId).map((c) => c.ordered)))
  );
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState('');

  const choices = useMemo(() => dishes.filter((d) => !d.dayOnly), [dishes]);
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
    <BottomSheet
      title={mode === 'add' ? 'Add dish' : 'Change dish'}
      subtitle={`${formatDatePretty(day.date)} · ${category}${card.mealName && mode === 'change' ? ` · now: ${card.mealName}` : ''}`}
      onClose={onClose}
    >
      {creating ? (
        <DishFields
          submitLabel="Add dish"
          priceMode="extra-optional"
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
          <p className="text-sm text-slate-600">{BRUNCH_PRICE_NOTE}</p>
          <DishPicker dishes={choices} selectedId={mealId} onSelect={setMealId} onNew={() => setCreating(true)} showPrice={false} />
          <ApplyTo name="apply" category={category} value={applyAll} onChange={setApplyAll} />
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Portions {applyAll ? '(each class)' : ''}</span>
            <input
              type="number"
              inputMode="numeric"
              min={minPortions}
              max={10000}
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {minPortions > 0 && <span className="text-sm text-slate-600">At least {minPortions} (already ordered).</span>}
          </label>
          {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
          <SheetActions busy={busy} onCancel={onClose} onSave={save} saveLabel="Save" />
        </>
      )}
    </BottomSheet>
  );
}

function SheetActions({ busy, onCancel, onSave, saveLabel, danger = false }: { busy: boolean; onCancel: () => void; onSave: () => void; saveLabel: string; danger?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
      <button type="button" onClick={onCancel} disabled={busy} className="min-h-[52px] px-5 rounded-xl border border-slate-300 bg-white text-base font-bold hover:bg-slate-50">
        Cancel
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className={`min-h-[52px] rounded-xl text-white text-lg font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'}`}
      >
        {busy && <Loader2 className="w-5 h-5 animate-spin" />} {saveLabel}
      </button>
    </div>
  );
}

/** price: the extra price (null = none); left out when the sheet has no price field. */
type DishValues = { name: string; price?: number | null; isVegetarian: boolean; description: string };

const BRUNCH_PRICE_NOTE = 'Brunch price is set by class.';
const EXTRA_PRICE_LABEL = 'Extra price (₹), used only when this dish is sold as an extra. Brunch price is set by class.';

/**
 * extra-optional: "Edit everywhere" and "New dish": optional extra price.
 * extra-required: a new dish made from "Add extra" (an extra needs a price).
 * none: "Edit for this day" on a main brunch: no price (set by class).
 */
type PriceMode = 'extra-optional' | 'extra-required' | 'none';

function DishFields({
  initial,
  submitLabel,
  busy,
  onCancel,
  cancelLabel = 'Back',
  onSubmit,
  notes,
  priceMode,
}: {
  initial?: Partial<Dish>;
  priceMode: PriceMode;
  submitLabel: string;
  busy: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  onSubmit: (v: DishValues) => void;
  notes?: React.ReactNode;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState(initial?.price !== undefined && initial?.price !== null ? String(initial.price) : '');
  const [veg, setVeg] = useState(initial?.isVegetarian !== false);
  const [description, setDescription] = useState(cleanDescription(initial?.description));
  const [problem, setProblem] = useState('');

  const submit = () => {
    const clean = name.trim().replace(/\s+/g, ' ');
    const p = Number(price);
    if (clean.length < 2) return setProblem('Please write the dish name (at least 2 letters).');
    if (priceMode === 'none') {
      setProblem('');
      return onSubmit({ name: clean, isVegetarian: veg, description: description.trim() });
    }
    if (!price.trim() && priceMode === 'extra-required') return setProblem('An extra needs a price. Please enter the extra price.');
    if (price.trim() && (!Number.isFinite(p) || p <= 0 || p > 10000)) return setProblem('Please enter an extra price above ₹0 (up to ₹10,000), or leave it empty.');
    setProblem('');
    onSubmit({ name: clean, price: price.trim() ? p : null, isVegetarian: veg, description: description.trim() });
  };

  return (
    <div className="space-y-3">
      {notes}
      <label className="block">
        <span className="text-sm font-bold text-slate-700">Dish name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </label>
      {priceMode === 'none' ? (
        <p className="text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">{BRUNCH_PRICE_NOTE}</p>
      ) : (
        <label className="block">
          <span className="text-sm font-bold text-slate-700">{EXTRA_PRICE_LABEL}</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={price}
            placeholder={priceMode === 'extra-required' ? 'Needed for an extra' : 'Optional'}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </label>
      )}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <span className="text-sm font-bold text-slate-700">Type</span>
          <div className="mt-1 grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100" role="radiogroup" aria-label="Veg or non-veg">
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
                className={`min-h-[44px] rounded-lg text-sm font-bold ${veg === o.v ? (o.v ? 'bg-white text-emerald-800 shadow-sm' : 'bg-white text-rose-800 shadow-sm') : 'text-slate-600'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="block">
        <span className="text-sm font-bold text-slate-700">Description (optional)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </label>
      {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
      {onCancel ? (
        <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-[52px] px-5 rounded-xl border border-slate-300 bg-white text-base font-bold hover:bg-slate-50">
            {cancelLabel}
          </button>
          <button type="button" disabled={busy} onClick={submit} className={`${PRIMARY_BTN} min-h-[52px] text-lg`}>
            {busy && <Loader2 className="w-5 h-5 animate-spin" />} {submitLabel}
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={submit} className={`${PRIMARY_BTN} w-full min-h-[52px] text-lg`}>
          {busy && <Loader2 className="w-5 h-5 animate-spin" />} {submitLabel}
        </button>
      )}
    </div>
  );
}

function Note({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'amber' }) {
  return (
    <div className={`flex gap-2 text-sm rounded-xl p-3 border ${tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DishForm({ title, initial, busy, onClose, onSave }: { title: string; initial?: Dish; busy: boolean; onClose: () => void; onSave: (v: DishValues) => void }) {
  return (
    <BottomSheet title={title} subtitle={initial ? initial.name : undefined} onClose={onClose}>
      <DishFields
        initial={initial}
        priceMode="extra-optional"
        submitLabel="Save"
        busy={busy}
        onCancel={onClose}
        cancelLabel="Cancel"
        onSubmit={onSave}
        notes={
          initial ? (
            <Note tone="amber">
              <p className="font-bold">Edits this dish everywhere it&apos;s used.</p>
              <p>Extra price changes apply to new orders only, on every day this dish is sold as an extra.</p>
              <p>The monthly menu file finds dishes by name. If you rename this dish, use the new name in future monthly files too, or the import will create a separate dish.</p>
            </Note>
          ) : null
        }
      />
    </BottomSheet>
  );
}

function PortionsSheet({
  title,
  subtitle,
  ordered,
  total,
  left,
  busy,
  onClose,
  onSave,
}: {
  title: string;
  subtitle: string;
  ordered: number;
  total: number | null;
  left: number | null;
  busy: boolean;
  onClose: () => void;
  onSave: (n: number) => void;
}) {
  const [value, setValue] = useState(String(total ?? 50));
  const [problem, setProblem] = useState('');
  const save = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 10000) return setProblem('Portions must be a whole number from 0 to 10000.');
    if (n < ordered) return setProblem(`${ordered} already ordered. Portions can't be lower than that.`);
    setProblem('');
    onSave(n);
  };
  return (
    <BottomSheet title={title} subtitle={subtitle} onClose={onClose}>
      <Counts ordered={ordered} total={total} left={left} />
      <label className="block">
        <span className="text-sm font-bold text-slate-700">New total portions</span>
        <input
          type="number"
          inputMode="numeric"
          min={ordered}
          max={10000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <span className="text-sm text-slate-600">At least {ordered} (already ordered).</span>
      </label>
      {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
      <SheetActions busy={busy} onCancel={onClose} onSave={save} saveLabel="Save portions" />
    </BottomSheet>
  );
}

function HolidaySheet({ day, busy, onClose, onSave }: { day: MenuDay; busy: boolean; onClose: () => void; onSave: (scope: 'ALL' | ClassName, reason: string) => void }) {
  const choices = day.classes.filter((c) => c.editable && c.state !== 'HOLIDAY').map((c) => c.category);
  const [scope, setScope] = useState<'ALL' | ClassName>(choices.length === 3 ? 'ALL' : choices[0] || 'ALL');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState('');
  return (
    <BottomSheet title="Mark as holiday" subtitle={formatDatePretty(day.date)} onClose={onClose}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-slate-700 mb-1">No brunch for</legend>
        {(choices.length === 3 ? (['ALL', ...choices] as Array<'ALL' | ClassName>) : choices).map((c) => (
          <label key={c} className={`flex items-center gap-3 min-h-[48px] px-3 rounded-xl border cursor-pointer ${scope === c ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
            <input type="radio" name="holiday-scope" checked={scope === c} onChange={() => setScope(c)} className="w-5 h-5 accent-slate-900" />
            <span className="text-base font-semibold">{c === 'ALL' ? 'All 3 classes' : `${c} only`}</span>
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="text-sm font-bold text-slate-700">Reason</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Diwali"
          maxLength={80}
          className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </label>
      {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
      <SheetActions
        busy={busy}
        onCancel={onClose}
        danger
        saveLabel="Mark as holiday"
        onSave={() => {
          if (reason.trim().length < 2) return setProblem('Please write a short reason.');
          setProblem('');
          onSave(scope, reason.trim());
        }}
      />
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
    <li key={d.id} className="px-4 py-3 flex items-center gap-3">
      <VegBadge isVegetarian={d.isVegetarian} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-slate-900 break-words">
          {d.name}
          {d.isExtra && <span className="ml-1.5 align-middle text-[11px] font-black uppercase tracking-wide text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Extra</span>}
        </p>
        <p className="text-sm text-slate-600">
          {d.price !== null && d.price !== undefined ? `Extra price ${formatINR(d.price)}` : 'No extra price'}
          {d.dayOnly && d.dayOnlyDate ? ` · only on ${formatDatePretty(d.dayOnlyDate)}` : ''}
        </p>
      </div>
      <button type="button" disabled={busy} onClick={() => onEdit(d)} className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold hover:bg-slate-50 disabled:opacity-60">
        Edit
      </button>
      {isAdmin && (
        <button type="button" disabled={busy} onClick={() => onDelete(d)} className="min-h-[44px] px-3 rounded-xl border border-rose-200 bg-white text-rose-700 text-sm font-bold hover:bg-rose-50 disabled:opacity-60">
          Delete
        </button>
      )}
    </li>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes"
            aria-label="Search dishes"
            className="w-full min-h-[48px] pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <button type="button" onClick={onNew} className={`${PRIMARY_BTN} px-5 shrink-0`}>
          <Plus className="w-4 h-4" /> Add dish
        </button>
      </div>
      <p className="text-sm text-slate-600">
        {main.length} {main.length === 1 ? 'dish' : 'dishes'}. Dishes marked <span className="font-bold text-amber-800">Extra</span> are used as optional add-ons. {BRUNCH_PRICE_NOTE}
      </p>
      <ul className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl shadow-sm lg:grid lg:grid-cols-2 lg:divide-y-0 lg:[&>li]:border-b lg:[&>li]:border-slate-100 lg:[&>li:nth-child(odd)]:border-r">
        {main.map(row)}
        {main.length === 0 && <li className="p-4 text-base text-slate-500">{search ? 'No dish matches this search.' : 'No dishes yet. Tap “Add dish”.'}</li>}
      </ul>
      {copies.length > 0 && (
        <details className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <summary className="min-h-[48px] px-4 flex items-center text-base font-bold text-slate-700 cursor-pointer">Day-only copies ({copies.length})</summary>
          <p className="px-4 pb-2 text-sm text-slate-600">Made with “Edit for this day”. Each is used on one date only.</p>
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
  const initial = dish || { id: card.mealId || '', name: card.mealName || '', isVegetarian: card.isVegetarian !== false };
  return (
    <BottomSheet title="Edit for this day" subtitle={`${formatDatePretty(day.date)} · ${card.mealName || ''}`} onClose={onClose}>
      <Note>
        <p className="font-bold">Changes this dish for this date only. Other days remain unchanged.</p>
        <p>Parents see the new name for {formatDatePretty(day.date)}. {BRUNCH_PRICE_NOTE}</p>
      </Note>
      <ApplyTo name="day-edit-apply" category={card.category} value={applyAll} onChange={setApplyAll} />
      <DishFields initial={initial} priceMode="none" submitLabel="Save for this day" busy={busy} onCancel={onClose} cancelLabel="Cancel" onSubmit={(v) => onSave(applyAll, v)} />
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
  const [mealId, setMealId] = useState('');
  const [applyAll, setApplyAll] = useState(false);
  const [portions, setPortions] = useState('20');
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState('');
  const choices = useMemo(() => {
    const taken = new Set([card.mealId, ...card.extras.map((x) => x.mealId)]);
    return dishes
      .filter((d) => !d.dayOnly && !taken.has(d.id))
      .sort((a, b) => Number(Boolean(b.isExtra)) - Number(Boolean(a.isExtra)) || a.name.localeCompare(b.name));
  }, [dishes, card]);

  const save = () => {
    const n = Number(portions);
    if (!mealId) return setProblem('Choose a dish first.');
    if (!Number.isInteger(n) || n < 1 || n > 10000) return setProblem('Portions must be a whole number from 1 to 10000.');
    setProblem('');
    onSave(mealId, applyAll, n);
  };

  return (
    <BottomSheet title="Add extra" subtitle={`${formatDatePretty(day.date)} · ${category}`} onClose={onClose}>
      {creating ? (
        <DishFields
          submitLabel="Add dish"
          priceMode="extra-required"
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
          <Note tone="amber">
            <p>Extras are optional add-ons. Parents can add up to 3 of each extra per child, only with that day&apos;s brunch.</p>
            <p>An extra is sold at the dish&apos;s own extra price.</p>
          </Note>
          <DishPicker dishes={choices} selectedId={mealId} onSelect={setMealId} onNew={() => setCreating(true)} />
          <ApplyTo name="extra-apply" category={category} value={applyAll} onChange={setApplyAll} allFirst={false} />
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Portions {applyAll ? '(each class)' : ''}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
          {problem && <p role="alert" className="text-base font-semibold text-rose-700">{problem}</p>}
          <SheetActions busy={busy} onCancel={onClose} onSave={save} saveLabel="Add extra" />
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

  const cell = (c: ClassCard) =>
    c.state === 'ON_SALE' ? (
      <span className="text-slate-900">
        {c.mealName}
        {c.extras.length > 0 && <span className="ml-1 text-xs font-bold text-amber-800">+{c.extras.length} extra{c.extras.length > 1 ? 's' : ''}</span>}
      </span>
    ) : c.state === 'HOLIDAY' ? (
      <span className="text-rose-700 font-semibold">Holiday</span>
    ) : (
      <span className="text-slate-400">Nothing on sale</span>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
        <button type="button" disabled={idx <= thisMonth - 6} onClick={() => setMonth(monthOf(idx - 1))} aria-label="Previous month" className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-lg font-black text-slate-900">{label}</p>
        <button type="button" disabled={idx >= thisMonth + 6} onClick={() => setMonth(monthOf(idx + 1))} aria-label="Next month" className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      {error && <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold">{error}</div>}
      {!days ? (
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Column titles on wide screens */}
          <div className="hidden md:grid grid-cols-[8rem_1fr_1fr_1fr] gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-black uppercase tracking-wide text-slate-500">
            <span>Date</span>
            <span>Pre-primary</span>
            <span>Primary</span>
            <span>Secondary</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {days.map((d) => {
              const holiday = d.classes.find((c) => c.state === 'HOLIDAY');
              const whole = d.isSunday ? 'Sunday · canteen closed' : d.status === 'HOLIDAY' ? `Holiday: ${holiday?.holidayReason || ''}` : d.status === 'NONE' ? 'Nothing on sale' : null;
              return (
                <li key={d.date}>
                  <button
                    type="button"
                    onClick={() => onOpenDay(d.date)}
                    className={`w-full min-h-[52px] px-4 py-2.5 text-left hover:bg-slate-50 grid gap-1 md:grid-cols-[8rem_1fr_1fr_1fr] md:gap-3 md:items-center ${d.isToday ? 'bg-amber-50/60' : ''} ${d.isPast ? 'opacity-60' : ''}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                      <span className={`w-2 h-2 shrink-0 rounded-full ${DOT[d.status].color}`} aria-label={DOT[d.status].label} />
                      {d.weekday} {Number(d.date.slice(8, 10))}
                      {d.isToday && <span className="text-[11px] font-bold text-amber-700 uppercase">Today</span>}
                    </span>
                    {whole ? (
                      <span className={`text-sm md:col-span-3 ${d.isSunday || d.status === 'NONE' ? 'text-slate-500' : 'text-rose-700 font-semibold'}`}>{whole}</span>
                    ) : (
                      d.classes.map((c) => (
                        <span key={c.category} className="text-sm min-w-0 break-words">
                          <span className="md:hidden font-bold text-slate-500">{c.category}: </span>
                          {cell(c)}
                        </span>
                      ))
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
