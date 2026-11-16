'use client';

import React, { useMemo } from 'react';
import { Download, Phone, Printer } from 'lucide-react';
import { formatDatePretty } from '@/lib/utils';
import {
  classLabel,
  dishLabel,
  notServedChildren,
  notServedCsv,
  notServedTeachers,
  type NotServedChild,
  type NotServedTeacher,
} from '@/lib/not-served';

/**
 * "Not served" for a date, for staff (History) and admin: children first, teachers in their own
 * section, with Print and a CSV download (Name, Class, Roll, Dish).
 */
export default function NotServedList({
  date,
  rows,
  teachers,
}: {
  date: string;
  rows: Array<NotServedChild & { key?: string }>;
  teachers: Array<NotServedTeacher & { id?: string }>;
}) {
  const children = useMemo(() => notServedChildren(rows), [rows]);
  const waitingTeachers = useMemo(() => notServedTeachers(teachers), [teachers]);

  const downloadCsv = () => {
    const blob = new Blob([`﻿${notServedCsv(date, rows, teachers)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `not-served-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-black text-slate-900">Not served: {formatDatePretty(date)}</p>
          <p className="text-sm text-slate-600">
            {children.length} {children.length === 1 ? 'child' : 'children'}
            {waitingTeachers.length ? `, ${waitingTeachers.length} ${waitingTeachers.length === 1 ? 'teacher' : 'teachers'}` : ''}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold inline-flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold inline-flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {children.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-base text-slate-600">
          Every child with a paid meal was served.
        </div>
      ) : (
        <table className="w-full text-left bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Roll</th>
              <th className="px-3 py-2">Dish</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-base">
            {children.map((r, i) => (
              <tr key={r.key || `${r.studentName}-${i}`} className="break-inside-avoid">
                <td className="px-3 py-2 font-bold text-slate-900 break-words">{r.studentName}</td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{classLabel(r)}</td>
                <td className="px-3 py-2 text-slate-700 tabular-nums">{r.rollNo || ''}</td>
                <td className="px-3 py-2 text-slate-800 break-words">{dishLabel(r.meals)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="space-y-2 break-inside-avoid">
        <p className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Teachers (separate)</p>
        {waitingTeachers.length === 0 ? (
          <p className="text-base text-slate-600">No teacher meals waiting.</p>
        ) : (
          <ul className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200">
            {waitingTeachers.map((t, i) => (
              <li key={t.id || i} className="px-3 py-2 flex flex-wrap items-center justify-between gap-x-3">
                <span className="text-base font-bold text-slate-900">{t.teacherName || 'Teacher'}</span>
                {t.teacherPhone && (
                  <a href={`tel:${t.teacherPhone}`} className="inline-flex items-center gap-1 text-sm text-slate-600 min-h-[44px] print:min-h-0">
                    <Phone className="w-4 h-4 print:hidden" /> {t.teacherPhone}
                  </a>
                )}
                <span className="w-full text-base text-slate-800">{dishLabel(t.items)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
