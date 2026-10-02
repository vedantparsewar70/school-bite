import React from 'react';
import Link from 'next/link';
import { UtensilsCrossed, ShieldCheck, HeartHandshake, Phone, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Nutri<span className="text-amber-500">Kids</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Empowering Indian schools and parents with hygienic, chef-curated wholesome meals planned in advance for active students.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>FSSAI & Hygiene Compliant</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 text-xs">
            <p className="text-sm font-semibold text-white tracking-wide uppercase">Parent Portal</p>
            <ul className="space-y-2">
              <li>
                <Link href="/parent/dashboard" className="hover:text-amber-400 transition-colors">
                  Parent Dashboard
                </Link>
              </li>
              <li>
                <Link href="/parent/children" className="hover:text-amber-400 transition-colors">
                  Manage Children
                </Link>
              </li>
              <li>
                <Link href="/parent/menu" className="hover:text-amber-400 transition-colors">
                  Daily & Weekly Lunch Menu
                </Link>
              </li>
              <li>
                <Link href="/parent/orders" className="hover:text-amber-400 transition-colors">
                  Order Status & Tracking
                </Link>
              </li>
            </ul>
          </div>

          {/* School Admin */}
          <div className="space-y-3 text-xs">
            <p className="text-sm font-semibold text-white tracking-wide uppercase">Canteen Admin</p>
            <ul className="space-y-2">
              <li>
                <Link href="/admin/dashboard" className="hover:text-amber-400 transition-colors">
                  Admin Analytics
                </Link>
              </li>
              <li>
                <Link href="/admin/kitchen" className="hover:text-amber-400 transition-colors">
                  Kitchen Prep Display
                </Link>
              </li>
              <li>
                <Link href="/admin/menu" className="hover:text-amber-400 transition-colors">
                  Menu & Deadline Settings
                </Link>
              </li>
              <li>
                <Link href="/admin/reports" className="hover:text-amber-400 transition-colors">
                  Sales & Class Reports
                </Link>
              </li>
            </ul>
          </div>

          {/* Payment & Contact */}
          <div className="space-y-3 text-xs">
            <p className="text-sm font-semibold text-white tracking-wide uppercase">Payments & Support</p>
            <p className="text-slate-400 text-xs">
              Designed for Indian Schools: instant simulated checkout supporting UPI (GPay, PhonePe, Paytm), RuPay, Visa, Net Banking, and School Meal Wallet.
            </p>
            <div className="pt-2 space-y-1.5 text-slate-400">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-amber-500" />
                <span>support@vidyalayanutribox.in</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-500" />
                <span>1800-202-MEALS (Mon-Sat, 7am - 4pm)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 NutriKids School Canteen Management System. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Demo Mode Active</span>
            <span>•</span>
            <span>INR (₹) Enabled</span>
            <span>•</span>
            <span>100% Pure Veg & Nutrition Standards</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
