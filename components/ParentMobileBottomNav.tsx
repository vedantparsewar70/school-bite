'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UtensilsCrossed, FileText, ShoppingCart, Users } from 'lucide-react';
import { useCart } from './CartContext';

export default function ParentMobileBottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();

  const links = [
    {
      href: '/parent/menu',
      label: 'Order Lunch',
      icon: UtensilsCrossed,
      active: pathname.startsWith('/parent/menu'),
    },
    {
      href: '/parent/orders',
      label: 'Order History',
      icon: FileText,
      active: pathname.startsWith('/parent/orders'),
    },
    {
      href: '/parent/cart',
      label: 'Cart',
      icon: ShoppingCart,
      active: pathname.startsWith('/parent/cart'),
      badge: totalItems > 0 ? totalItems : undefined,
    },
    {
      href: '/parent/children',
      label: 'Children',
      icon: Users,
      active: pathname.startsWith('/parent/children'),
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-amber-200 px-2 py-1 shadow-lg shadow-amber-900/10 safe-area-bottom">
      <div className="grid grid-cols-4 gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                link.active
                  ? 'text-amber-700 bg-amber-50 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${link.active ? 'text-amber-600 stroke-[2.5]' : 'text-slate-500'}`} />
                {link.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 bg-amber-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {link.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] mt-0.5 sm:mt-1 tracking-tight truncate max-w-full text-center">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
