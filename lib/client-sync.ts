'use client';

import { useEffect, useRef } from 'react';

export type SyncEventType = 'MENU_UPDATED' | 'ORDERS_UPDATED' | 'TEACHER_ORDERS_UPDATED';

const CHANNEL_NAME = 'schoolbite_live_sync';
const STORAGE_KEY = 'schoolbite_sync_event';

/**
 * Broadcast an event locally across all open tabs/windows in the browser immediately (0ms latency).
 */
export function broadcastSyncEvent(type: SyncEventType) {
  if (typeof window === 'undefined') return;

  const payload = { type, timestamp: Date.now() };

  // 1. Same-window CustomEvent
  window.dispatchEvent(new CustomEvent('schoolbite_sync', { detail: payload }));

  // 2. Cross-tab BroadcastChannel
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // ignore
  }

  // 3. Cross-tab localStorage event fallback
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

interface UseSyncWatcherOptions {
  onMenuUpdate?: () => void;
  onOrdersUpdate?: () => void;
  onTeacherOrdersUpdate?: () => void;
  pollIntervalMs?: number;
  enabled?: boolean;
}

/**
 * React hook that listens for real-time changes across the application without requiring page refresh.
 * Combines BroadcastChannel (instant in same browser) with lightweight server version polling (cross-device).
 */
export function useSyncWatcher({
  onMenuUpdate,
  onOrdersUpdate,
  onTeacherOrdersUpdate,
  pollIntervalMs = 3500,
  enabled = true,
}: UseSyncWatcherOptions) {
  const lastVersionsRef = useRef<{
    menuVersion?: number;
    ordersVersion?: number;
    teacherOrdersVersion?: number;
    isInitialized: boolean;
  }>({ isInitialized: false });

  const callbacksRef = useRef({ onMenuUpdate, onOrdersUpdate, onTeacherOrdersUpdate });
  useEffect(() => {
    callbacksRef.current = { onMenuUpdate, onOrdersUpdate, onTeacherOrdersUpdate };
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // 1. Function to check server versions
    let isFetching = false;
    const checkServerVersions = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const res = await fetch('/api/sync/events', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        const prev = lastVersionsRef.current;
        if (!prev.isInitialized) {
          prev.menuVersion = data.menuVersion;
          prev.ordersVersion = data.ordersVersion;
          prev.teacherOrdersVersion = data.teacherOrdersVersion;
          prev.isInitialized = true;
          return;
        }

        if (data.menuVersion && data.menuVersion !== prev.menuVersion) {
          prev.menuVersion = data.menuVersion;
          callbacksRef.current.onMenuUpdate?.();
        }

        if (data.ordersVersion && data.ordersVersion !== prev.ordersVersion) {
          prev.ordersVersion = data.ordersVersion;
          callbacksRef.current.onOrdersUpdate?.();
        }

        if (data.teacherOrdersVersion && data.teacherOrdersVersion !== prev.teacherOrdersVersion) {
          prev.teacherOrdersVersion = data.teacherOrdersVersion;
          callbacksRef.current.onTeacherOrdersUpdate?.();
        }
      } catch (err) {
        // network hiccups ignored during background sync
      } finally {
        isFetching = false;
      }
    };

    // Initial check
    checkServerVersions();

    // 2. BroadcastChannel listener (Instant 0ms across tabs in same browser)
    let channel: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event) => {
          const { type } = event.data || {};
          if (type === 'MENU_UPDATED') {
            callbacksRef.current.onMenuUpdate?.();
          } else if (type === 'ORDERS_UPDATED') {
            callbacksRef.current.onOrdersUpdate?.();
          } else if (type === 'TEACHER_ORDERS_UPDATED') {
            callbacksRef.current.onTeacherOrdersUpdate?.();
          }
        };
      }
    } catch {
      // ignore
    }

    // 3. Local CustomEvent listener (Same tab)
    const handleCustomEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      const { type } = customEvt.detail || {};
      if (type === 'MENU_UPDATED') {
        callbacksRef.current.onMenuUpdate?.();
      } else if (type === 'ORDERS_UPDATED') {
        callbacksRef.current.onOrdersUpdate?.();
      } else if (type === 'TEACHER_ORDERS_UPDATED') {
        callbacksRef.current.onTeacherOrdersUpdate?.();
      }
    };
    window.addEventListener('schoolbite_sync', handleCustomEvent);

    // 4. LocalStorage event listener (Fallback for cross-tab in older browsers)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const { type } = JSON.parse(e.newValue);
          if (type === 'MENU_UPDATED') {
            callbacksRef.current.onMenuUpdate?.();
          } else if (type === 'ORDERS_UPDATED') {
            callbacksRef.current.onOrdersUpdate?.();
          } else if (type === 'TEACHER_ORDERS_UPDATED') {
            callbacksRef.current.onTeacherOrdersUpdate?.();
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 5. Visibility and Focus listeners (Immediate check when user returns to tab)
    const handleFocus = () => {
      checkServerVersions();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // 6. Adaptive periodic poll (Fast when tab active, slower when backgrounded)
    const intervalId = setInterval(() => {
      if (document.hidden) {
        // In background: poll only occasionally (e.g. 15s)
        return;
      }
      checkServerVersions();
    }, pollIntervalMs);

    return () => {
      clearInterval(intervalId);
      if (channel) channel.close();
      window.removeEventListener('schoolbite_sync', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [enabled, pollIntervalMs]);
}
