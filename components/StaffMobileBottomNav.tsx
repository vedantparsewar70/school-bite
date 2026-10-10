'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChefHat, ShoppingBag, GraduationCap, History } from 'lucide-react';

export default function StaffMobileBottomNav() {
  const pathname = usePathname();

  const links = [
    {
      href: '/staff/kitchen',
      label: 'Student Menu',
      icon: ChefHat,
      active: pathname.startsWith('/staff/kitchen'),
    },
    {
      href: '/staff/orders',
      label: 'Orders',
      icon: ShoppingBag,
      active: pathname === '/staff/orders',
    },
    {
      href: '/staff/history',
      label: 'History',
      icon: History,
      active: pathname.startsWith('/staff/history'),
    },
    {
      href: '/staff/teacher-menu',
      label: 'Teacher Menu',
      icon: GraduationCap,
      active: pathname.startsWith('/staff/teacher-menu'),
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-amber-200 px-2 py-1.5 shadow-lg shadow-amber-900/10 safe-area-bottom">
      <div className="grid grid-cols-4 gap-1.5 max-w-md mx-auto">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                link.active
                  ? 'text-amber-800 bg-amber-100 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${link.active ? 'text-amber-800 stroke-[2.5]' : 'text-slate-500'}`} />
              <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
