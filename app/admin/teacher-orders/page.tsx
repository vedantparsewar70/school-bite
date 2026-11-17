'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Phone, RefreshCw } from 'lucide-react';
import { formatDatePretty, formatINR, getTodayString } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';
import { useSyncWatcher } from '@/lib/client-sync';
import LoadError, { loadFailedMessage } from '@/components/LoadError';

type TeacherOrder = {
  id: string;
  teacherName: string | null;
  teacherPhone: string | null;
  date: string;
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
  refundAmount?: number;
  items: Array<{ mealName: string; quantity: number }>;
};

const STATUS: Record<string, { label: string; tone: string }> = {
  CONFIRMED: { label: 'Paid', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  GIVEN: { label: 'Given', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  COLLECTED: { label: 'Given', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-rose-50 text-rose-800 border-rose-200' },
};
const REFUND: Record<string, string> = {
  REFUND_PENDING: 'Refund in progress',
  REFUNDED: 'Refunded',
  REFUND_FAILED: 'Refund failed: try again',
};

/** Admin → Teacher orders: list a day's teacher orders and cancel + fully refund a paid one. */
export default function AdminTeacherOrdersPage() {
  const { showToast } = useToast();
  const [date, setDate] = useState(() => getTodayString());
  const [orders, setOrders] = useState<TeacherOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await fetch(`/api/staff/teacher-orders?date=${date}&withCancelled=1`, { cache: 'no-store' });
      if (mine !== seq.current) return;
      if (!res.ok) {
        setLoadError(loadFailedMessage('teacher orders', res.status));
        return;
      }
      setOrders(((await res.json()).orders || []) as TeacherOrder[]);
      setLoadError('');
    } catch {
      if (mine === seq.current) setLoadError(loadFailedMessage('teacher orders'));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useSyncWatcher({ pollIntervalMs: 30000, onTeacherOrdersUpdate: () => load() });

  const cancel = async (o: TeacherOrder) => {
    if (working) return;
    const items = o.items.map((i) => `${i.mealName}${i.quantity > 1 ? ` x ${i.quantity}` : ''}`).join(', ');
    if (
      !window.confirm(
        `Cancel ${o.teacherName || 'this teacher'}'s order for ${formatDatePretty(o.date)} (${items}) and refund ${formatINR(o.totalAmount)} to the original payment method?`
      )
    ) {
      return;
    }
    setWorking(o.id);
    try {
      const res = await fetch('/api/staff/teacher-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: o.id, orderStatus: 'CANCELLED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(
          data.alreadyCancelled
            ? data.message || 'This order was already cancelled.'
            : `Order cancelled. ${formatINR(data.refundAmount ?? o.totalAmount)} refund sent to the teacher's original payment method.`,
          'success'
        );
        await load();
      } else {
        showToast(data.error || `The order could not be cancelled (error ${res.status}).`, 'error');
      }
    } catch {
      showToast('Could not reach the server. Please try again.', 'error');
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-12 space-y-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <Link href="/admin/orders" className="min-h-[44px] px-4 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 inline-flex items-center">
          Student orders
        </Link>
        <span className="min-h-[44px] px-4 rounded-xl text-sm font-bold bg-slate-900 text-white inline-flex items-center" aria-current="page">
          Teacher orders
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">Teacher orders</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Date"
            className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-base"
          />
          <button type="button" onClick={() => load()} aria-label="Refresh" className="w-11 h-11 rounded-xl border border-slate-300 bg-white flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-hidden />
      ) : loadError && orders.length === 0 ? (
        <LoadError message={loadError} onRetry={() => load()} />
      ) : orders.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-base text-slate-600">
          No paid teacher orders on {formatDatePretty(date)}.
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const status = STATUS[o.orderStatus] || { label: o.orderStatus, tone: 'bg-slate-100 text-slate-700 border-slate-200' };
            const cancellable = o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'GIVEN' && o.orderStatus !== 'COLLECTED';
            const retry = o.orderStatus === 'CANCELLED' && (o.paymentStatus === 'REFUND_PENDING' || o.paymentStatus === 'REFUND_FAILED');
            return (
              <li key={o.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-slate-900">{o.teacherName || 'Teacher'}</p>
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${status.tone}`}>{status.label}</span>
                    {REFUND[o.paymentStatus] && <span className="text-xs font-bold text-rose-700">{REFUND[o.paymentStatus]}</span>}
                  </div>
                  {o.teacherPhone && (
                    <a href={`tel:${o.teacherPhone}`} className="inline-flex items-center gap-1 text-sm text-slate-600">
                      <Phone className="w-4 h-4" /> {o.teacherPhone}
                    </a>
                  )}
                  <p className="text-sm text-slate-700 break-words">{o.items.map((i) => `${i.mealName}${i.quantity > 1 ? ` x ${i.quantity}` : ''}`).join(', ')}</p>
                  <p className="text-xs text-slate-500">
                    {o.id} · {formatINR(o.totalAmount)}
                  </p>
                </div>
                {(cancellable || retry) && (
                  <button
                    type="button"
                    disabled={working !== null}
                    onClick={() => cancel(o)}
                    className="min-h-[44px] px-4 rounded-xl border-2 border-rose-200 bg-white text-rose-700 text-sm font-bold hover:bg-rose-50 disabled:opacity-60 shrink-0"
                  >
                    {working === o.id ? 'Working…' : retry ? 'Retry refund' : 'Cancel & refund'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
