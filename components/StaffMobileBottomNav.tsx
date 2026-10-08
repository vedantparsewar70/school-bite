'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChefHat, ShoppingBag } from 'lucide-react';

export default function StaffMobileBottomNav() {
  const pathname = usePathname();

  const links = [
    {
      href: '/staff/kitchen',
      label: 'Kitchen Summary',
      icon: ChefHat,
      active: pathname.startsWith('/staff/kitchen'),
    },
    {
      href: '/staff/orders',
      label: 'Student Orders',
      icon: ShoppingBag,
      active: pathname.startsWith('/staff/orders'),
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-amber-200 px-4 py-1.5 shadow-lg shadow-amber-900/10 safe-area-bottom">
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl transition-all ${
                link.active
                  ? 'text-amber-800 bg-amber-100 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${link.active ? 'text-amber-800 stroke-[2.5]' : 'text-slate-500'}`} />
              <span className="text-xs mt-1 tracking-tight">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
