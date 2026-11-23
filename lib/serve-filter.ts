/** Client-safe filtering for the staff Serve screen (one row per child). */
import { divisionOf } from './division';

export interface ServeRowLike {
  studentName: string;
  rollNo?: string | null;
  studentCategory?: string | null;
  division?: string | null;
  served: boolean;
}

export type ServeStatusFilter = 'NOT_SERVED' | 'SERVED' | 'ALL';

export interface ServeFilter {
  status: ServeStatusFilter;
  /** 'ALL' or a category name: Pre-primary, Primary, Secondary. */
  category: string;
  /** 'ALL' or a division (A to H). */
  division?: string;
  /** Matches the child's name (any part) or roll number. */
  search: string;
}

export const DEFAULT_SERVE_FILTER: ServeFilter = { status: 'NOT_SERVED', category: 'ALL', division: 'ALL', search: '' };

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export function matchesServeFilter(row: ServeRowLike, filter: ServeFilter): boolean {
  if (filter.status === 'NOT_SERVED' && row.served) return false;
  if (filter.status === 'SERVED' && !row.served) return false;
  if (filter.category !== 'ALL' && norm(row.studentCategory) !== norm(filter.category)) return false;
  if (filter.division && filter.division !== 'ALL' && divisionOf(row.division) !== filter.division) return false;
  const q = norm(filter.search);
  if (!q) return true;
  const roll = norm(row.rollNo);
  // A number-only query matches the roll number exactly, or the start of the name/roll text.
  if (/^\d+$/.test(q) && roll === q) return true;
  return norm(row.studentName).includes(q) || (roll !== '' && roll.startsWith(q));
}

export function filterServeRows<T extends ServeRowLike>(rows: T[], filter: ServeFilter): T[] {
  return rows.filter((r) => matchesServeFilter(r, filter));
}

/** "Served X / Y" for the chosen category (search and status filters do not change the counter). */
export function serveCounter(rows: ServeRowLike[], category = 'ALL'): { served: number; total: number } {
  const inCategory = rows.filter((r) => category === 'ALL' || norm(r.studentCategory) === norm(category));
  return { served: inCategory.filter((r) => r.served).length, total: inCategory.length };
}
