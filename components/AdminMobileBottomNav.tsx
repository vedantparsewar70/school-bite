'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UtensilsCrossed, ShoppingBag, ChefHat } from 'lucide-react';

export default function AdminMobileBottomNav() {
  const pathname = usePathname();

  const links = [
    {
      href: '/admin/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: pathname === '/admin/dashboard' || pathname === '/admin',
    },
    {
      href: '/admin/menu',
      label: 'Menu',
      icon: UtensilsCrossed,
      active: pathname.startsWith('/admin/menu'),
    },
    {
      href: '/admin/orders',
      label: 'Orders',
      icon: ShoppingBag,
      active: pathname.startsWith('/admin/orders'),
    },
    {
      href: '/admin/kitchen',
      label: 'Kitchen',
      icon: ChefHat,
      active: pathname.startsWith('/admin/kitchen'),
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-lg shadow-slate-900/10 safe-area-bottom">
      <div className="grid grid-cols-4 gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                link.active
                  ? 'text-purple-700 bg-purple-50 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${link.active ? 'text-purple-700 stroke-[2.5]' : 'text-slate-500'}`} />
              <span className="text-[11px] mt-1 tracking-tight">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
