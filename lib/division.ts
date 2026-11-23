/**
 * A child's division (section) within their class: exactly one of DIVISIONS (A to H).
 * This is the only place the allowed divisions are listed; every check, dropdown, filter and message uses it.
 * Older children may have none ("-" or empty); they are asked to add it before ordering.
 *
 * The internal student ID (e.g. "STU-2026-633", field `studentId` on a student document) is kept in
 * the database but never displayed or sent to a screen or export: see `withoutInternalId`.
 *
 * Safe for client components: no server imports.
 */

export const DIVISIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type Division = (typeof DIVISIONS)[number];

/** "A, B, C, D, E, F, G or H" (for messages). */
export const DIVISION_LIST_TEXT = `${DIVISIONS.slice(0, -1).join(', ')} or ${DIVISIONS[DIVISIONS.length - 1]}`;
/** "A to H" (for short messages). */
export const DIVISION_RANGE_TEXT = `${DIVISIONS[0]} to ${DIVISIONS[DIVISIONS.length - 1]}`;

/** True only for exactly one of DIVISIONS (as sent by the form; no trimming or case folding). */
export const isDivision = (v: unknown): v is Division => typeof v === 'string' && (DIVISIONS as readonly string[]).includes(v);

/** A stored division for display/sorting: one of DIVISIONS (case and spaces forgiven), else null. */
export function divisionOf(v: unknown): Division | null {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return isDivision(s) ? s : null;
}

/** "Primary · B" (or just "Primary" when the division is not set). */
export function classDivisionLabel(category: unknown, division: unknown): string {
  const c = typeof category === 'string' ? category.trim() : '';
  const d = divisionOf(division);
  return [c, d].filter(Boolean).join(' · ');
}

/** A roll number worth showing ("" for empty or "-"). */
export function realRollNo(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s === '-' ? '' : s;
}

const CLASS_ORDER: Record<string, number> = { 'pre-primary': 0, primary: 1, secondary: 2 };

/** Sort children by class (Pre-primary, Primary, Secondary), then division (in DIVISIONS order, none last), then name. */
export function compareByClassDivisionName(
  a: { studentCategory?: string | null; division?: string | null; studentName?: string | null },
  b: { studentCategory?: string | null; division?: string | null; studentName?: string | null }
): number {
  const cls = (v: unknown) => CLASS_ORDER[String(v ?? '').trim().toLowerCase()] ?? 3;
  const div = (v: unknown) => {
    const d = divisionOf(v);
    return d ? DIVISIONS.indexOf(d) : DIVISIONS.length;
  };
  return (
    cls(a.studentCategory) - cls(b.studentCategory) ||
    div(a.division) - div(b.division) ||
    String(a.studentName || '').localeCompare(String(b.studentName || ''), 'en', { sensitivity: 'base' })
  );
}

/** A STUDENT document without its internal student ID (never use on order lines, whose studentId is the child key). */
export function withoutInternalId<T extends Record<string, any>>(s: T): Omit<T, 'studentId'> {
  const { studentId, ...rest } = s;
  void studentId;
  return rest;
}
