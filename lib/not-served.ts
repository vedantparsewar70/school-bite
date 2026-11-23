/** "Not served" list for a date: children (and, separately, teachers) with a paid meal not yet handed over. */
import { classDivisionLabel, compareByClassDivisionName, divisionOf } from './division';

export interface NotServedChild {
  studentName: string;
  grade?: string | null;
  division?: string | null;
  rollNo?: string | null;
  studentCategory?: string | null;
  served: boolean;
  meals: Array<{ mealName: string; quantity: number; isExtra?: boolean }>;
}

export interface NotServedTeacher {
  teacherName?: string | null;
  teacherPhone?: string | null;
  orderStatus: string;
  items: Array<{ mealName: string; quantity: number }>;
}

export const teacherServed = (t: { orderStatus: string }) => t.orderStatus === 'GIVEN' || t.orderStatus === 'COLLECTED';

/** "Primary · B": the class (category) and division; roll numbers are not shown. */
export const classLabel = (r: { studentCategory?: string | null; grade?: string | null; division?: string | null }) =>
  classDivisionLabel(r.studentCategory || r.grade || '', r.division);

export const dishLabel = (list: Array<{ mealName: string; quantity: number; isExtra?: boolean }>) =>
  list.map((m) => `${m.mealName}${m.quantity > 1 ? ` x ${m.quantity}` : ''}${m.isExtra ? ' (extra)' : ''}`).join('; ');

/** Children not served, by class (Pre-primary, Primary, Secondary), then division (A to H), then name. */
export function notServedChildren<T extends NotServedChild>(rows: T[]): T[] {
  return rows.filter((r) => !r.served).sort(compareByClassDivisionName);
}

export function notServedTeachers<T extends NotServedTeacher>(orders: T[]): T[] {
  return orders.filter((t) => !teacherServed(t)).sort((a, b) => String(a.teacherName || '').localeCompare(String(b.teacherName || '')));
}

/** One CSV cell: quoted, and a leading = + - @ is neutralised so a spreadsheet never runs it as a formula. */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** CSV for the date: children first (Name, Class, Division, Dish), then teachers in their own section. */
export function notServedCsv(date: string, children: NotServedChild[], teachers: NotServedTeacher[]): string {
  const line = (cells: unknown[]) => cells.map(csvCell).join(',');
  const out = [line([`Not served on ${date}`]), line(['Name', 'Class', 'Division', 'Dish'])];
  for (const r of notServedChildren(children)) {
    out.push(line([r.studentName, r.studentCategory || r.grade || '', divisionOf(r.division) || '', dishLabel(r.meals)]));
  }
  const t = notServedTeachers(teachers);
  if (t.length) {
    out.push('', line(['Teachers']), line(['Name', 'Phone', 'Dish']));
    for (const o of t) out.push(line([o.teacherName || 'Teacher', o.teacherPhone || '', dishLabel(o.items)]));
  }
  return out.join('\r\n') + '\r\n';
}
