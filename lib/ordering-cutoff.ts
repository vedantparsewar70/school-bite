/**
 * Parents' ordering cutoff: ONE setting for every class and day ("Ordering closes at", HH:MM IST),
 * stored with the class prices in systemSettings/BRUNCH_PRICES (field `orderingCutoff`) and edited
 * by the admin on the Student Menu settings card. 07:00 applies from code until someone saves.
 *
 * It overrides the `orderingDeadline` stored on each menu entry and extra (older entries still say
 * "08:30"; no database update is needed). Only if the setting cannot be read does the stored
 * per-entry time apply, as a fallback. Teacher orders have no cutoff and never use this.
 *
 * Server entry points call `loadOrderingCutoff()` (lib/ordering-cutoff-server.ts: one document
 * read, no cache, so a saved change applies at once); the synchronous helpers then use `cutoffFor()`.
 *
 * Safe for client components: no server imports.
 */
export const DEFAULT_ORDERING_CUTOFF = '07:00';
export const ORDERING_CUTOFF_FIELD = 'orderingCutoff';

/** "07:00" for a real 24-hour time "H:MM" or "HH:MM" (00:00 to 23:59), else null. */
export function validCutoff(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** The setting as last read on this server: a time, or null when it could not be read. */
let current: string | null = DEFAULT_ORDERING_CUTOFF;

/** Records the setting as read by lib/ordering-cutoff-server.ts (null = could not be read). */
export function setLoadedOrderingCutoff(value: string | null): void {
  current = value;
}

/** The setting as last loaded (null if it could not be read). */
export const orderingCutoffSetting = (): string | null => current;

/** The cutoff that applies: the setting; or, only if it could not be read, the entry's stored time. */
export function cutoffFor(storedDeadline?: string | null): string {
  return current || validCutoff(storedDeadline) || DEFAULT_ORDERING_CUTOFF;
}

/** "07:00 AM" / "1:30 PM" for display. */
export function cutoffLabel(time: string | null | undefined): string {
  const t = validCutoff(time) || DEFAULT_ORDERING_CUTOFF;
  const [h, m] = t.split(':').map(Number);
  if (h === 0) return `12:${String(m).padStart(2, '0')} AM`;
  if (h < 12) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} AM`;
  if (h === 12) return `12:${String(m).padStart(2, '0')} PM`;
  return `${h - 12}:${String(m).padStart(2, '0')} PM`;
}

