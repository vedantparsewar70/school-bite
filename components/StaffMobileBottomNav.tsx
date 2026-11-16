'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckSquare, ChefHat, History, MoreHorizontal, UtensilsCrossed, GraduationCap, CalendarDays, X } from 'lucide-react';

/** Staff phone navigation: the three daily jobs, plus the menu tools under "More". */
export default function StaffMobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const main = [
    { href: '/staff/orders', label: 'Serve', icon: CheckSquare, active: pathname === '/staff/orders' },
    { href: '/staff/prepare', label: 'Prepare', icon: ChefHat, active: pathname.startsWith('/staff/prepare') },
    { href: '/staff/history', label: 'History', icon: History, active: pathname.startsWith('/staff/history') },
  ];
  const more = [
    { href: '/staff/kitchen', label: 'Student Menu', icon: UtensilsCrossed },
    { href: '/staff/teacher-menu', label: 'Teacher Menu', icon: GraduationCap },
    { href: '/staff/menu-import', label: 'Menu Import', icon: CalendarDays },
  ];
  const moreActive = more.some((m) => pathname.startsWith(m.href));

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl p-4 pb-8 space-y-2 safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="More"
          >
            <div className="flex items-center justify-between pb-1">
              <p className="text-base font-black text-slate-900">More</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="w-11 h-11 flex items-center justify-center text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            {more.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`flex items-center gap-3 min-h-[52px] px-4 rounded-2xl text-base font-bold ${
                    pathname.startsWith(m.href) ? 'bg-amber-100 text-amber-900' : 'bg-slate-50 text-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {m.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="print:hidden md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-amber-200 px-2 py-1.5 shadow-lg shadow-amber-900/10 safe-area-bottom">
        <div className="grid grid-cols-4 gap-1.5 max-w-md mx-auto">
          {main.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center min-h-[52px] px-1 rounded-xl ${
                  link.active ? 'text-amber-800 bg-amber-100 font-bold' : 'text-slate-600 font-semibold'
                }`}
              >
                <Icon className={`w-6 h-6 ${link.active ? 'stroke-[2.5]' : ''}`} />
                <span className="text-xs mt-0.5">{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center min-h-[52px] px-1 rounded-xl ${
              moreActive ? 'text-amber-800 bg-amber-100 font-bold' : 'text-slate-600 font-semibold'
            }`}
          >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-xs mt-0.5">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
