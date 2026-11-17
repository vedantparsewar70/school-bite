'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Shown instead of an empty state when data could not be loaded, so a server or connection problem
 * never looks like "nothing here" (no orders, no menu, all zeros).
 */
export default function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-3 max-w-xl mx-auto">
      <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
      <p className="flex-1 text-base font-semibold text-rose-900">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] px-4 rounded-xl bg-white border border-rose-300 text-rose-900 text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-rose-100"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      )}
    </div>
  );
}

export const loadFailedMessage = (what: string, status?: number) =>
  status ? `Could not load ${what} (error ${status}). Please try again.` : `Could not load ${what}. Check the connection and try again.`;
