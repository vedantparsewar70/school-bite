'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  UtensilsCrossed,
  ShoppingCart,
  User as UserIcon,
  LogOut,
  Menu as MenuIcon,
  X,
  Users,
  CalendarDays,
  FileText,
  CreditCard,
  ChefHat,
  BarChart3,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { formatINR } from '@/lib/utils';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const isParent = user?.role === 'PARENT';
  const isAdmin = user?.role === 'ADMIN';

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href={isAdmin ? '/admin/dashboard' : isParent ? '/parent/children' : '/'} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-800 tracking-tight flex items-center gap-1">
                <p>School<span className="text-amber-600">-Bite</span></p>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider bg-purple-100 text-purple-700 rounded-md uppercase">
                    Admin
                  </span>
                )}
              </span>
              <p className="text-[10px] text-slate-500 -mt-1 font-medium hidden sm:block">School Meal Portal • S.B. Patil School</p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {!user && (
              <>
                <Link
                  href="/about"
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/about'
                    ? 'bg-amber-50 text-amber-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  About
                </Link>
                <Link
                  href="/contact"
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/contact'
                    ? 'bg-amber-50 text-amber-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  Contact
                </Link>
              </>
            )}


            {isAdmin && (
              <>
                <Link
                  href="/admin/dashboard"
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${pathname === '/admin/dashboard'
                    ? 'bg-purple-50 text-purple-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  Overview
                </Link>
                <Link
                  href="/admin/menu"
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isActive('/admin/menu')
                    ? 'bg-purple-50 text-purple-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  Menu Management
                </Link>
                <Link
                  href="/admin/orders"
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isActive('/admin/orders')
                    ? 'bg-purple-50 text-purple-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  Orders
                </Link>
                <Link
                  href="/admin/kitchen"
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${isActive('/admin/kitchen')
                    ? 'bg-amber-500 text-white font-semibold shadow-xs'
                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100 font-medium'
                    }`}
                >
                  <ChefHat className="w-4 h-4" />
                  Kitchen View
                </Link>
                <Link
                  href="/admin/reports"
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isActive('/admin/reports')
                    ? 'bg-purple-50 text-purple-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  Reports
                </Link>
                <Link
                  href="/admin/users"
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isActive('/admin/users')
                    ? 'bg-purple-50 text-purple-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  Accounts
                </Link>
              </>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {!user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                >
                  Parent Login
                </Link>
                <Link
                  href="/?mode=register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-xs transition-all"
                >
                  Register
                </Link>
                <Link
                  href="/login?role=admin"
                  className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {isParent && (
                  <>
                    {/* Shopping Cart Button */}
                    <Link
                      href="/parent/cart"
                      className="relative p-2 text-slate-700 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                      title="View Cart"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {totalItems > 0 && (
                        <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-xs">
                          {totalItems}
                        </span>
                      )}
                    </Link>
                  </>
                )}

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-200 to-orange-200 border border-amber-300 flex items-center justify-center text-amber-800 font-bold text-xs">
                      {user.name.charAt(0)}
                    </div>
                    <div className="hidden lg:block text-xs">
                      <div className="font-semibold text-slate-800 leading-tight">{user.name.split(' ')[0]}</div>
                      <div className="text-[10px] text-slate-500 capitalize">{user.role.toLowerCase()}</div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {profileDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      </div>

                      {isParent && (
                        <Link
                          href="/parent/profile"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                        >
                          <UserIcon className="w-4 h-4 text-slate-400" />
                          Parent Profile
                        </Link>
                      )}

                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {isParent && (
              <Link
                href="/parent/cart"
                className="relative p-2 text-slate-700 hover:text-amber-600"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-6 space-y-1">
          {!user ? (
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl"
              >
                About School-Bite
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl"
              >
                Contact Support
              </Link>
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-sm font-medium border border-slate-200 rounded-xl"
                >
                  Parent Login
                </Link>
                <Link
                  href="/?mode=register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-xl"
                >
                  Register as Parent
                </Link>
                <Link
                  href="/login?role=admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 text-xs font-semibold text-purple-700 bg-purple-50 rounded-xl"
                >
                  Canteen Admin Login
                </Link>
              </div>
            </div>
          ) : isParent ? (
            <div className="flex flex-col gap-1 pt-2">
              <div className="px-3 py-2 bg-amber-50 rounded-xl mb-2">
                <p className="text-xs font-bold text-slate-800">{user.name}</p>
                <p className="text-[11px] text-amber-700 font-medium">Parent Account</p>
              </div>

              <Link
                href="/parent/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Profile & Settings
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="text-left px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 pt-2">
              <div className="px-3 py-2 bg-purple-50 rounded-xl mb-2">
                <p className="text-xs font-bold text-slate-800">{user.name}</p>
                <p className="text-[11px] text-purple-700 font-semibold uppercase">Canteen Admin</p>
              </div>
              <Link
                href="/admin/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Admin Overview
              </Link>
              <Link
                href="/admin/menu"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Menu Management
              </Link>
              <Link
                href="/admin/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Order Management
              </Link>
              <Link
                href="/admin/kitchen"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-bold text-amber-700 bg-amber-50 rounded-lg"
              >
                Kitchen Prep Display
              </Link>
              <Link
                href="/admin/reports"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Reports & Sales
              </Link>
              <Link
                href="/admin/users"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Parents & Students
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="text-left px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
