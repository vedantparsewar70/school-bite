'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

/** Errors stay a little longer so they can be read. */
const DURATION_MS: Record<ToastType, number> = { success: 4000, info: 4000, error: 7000 };
const MAX_VISIBLE = 3;

const STYLES: Record<ToastType, { box: string; icon: ReactNode }> = {
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> },
  error: { box: 'bg-red-50 border-red-200 text-red-900', icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" /> },
  info: { box: 'bg-white border-slate-200 text-slate-900', icon: <Info className="w-5 h-5 text-slate-500 shrink-0" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (!message) return;
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, type }].slice(-MAX_VISIBLE));
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS[type]));
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="no-print fixed top-20 left-4 right-4 sm:left-auto sm:w-96 z-[60] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg text-sm font-medium ${STYLES[toast.type].box}`}
          >
            {STYLES[toast.type].icon}
            <p className="flex-1 break-words">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-lg p-0.5 opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
