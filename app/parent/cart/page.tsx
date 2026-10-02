'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  UtensilsCrossed,
  Calendar,
  AlertCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { useCart } from '@/components/CartContext';
import { useAuth } from '@/components/AuthContext';
import VegBadge from '@/components/VegBadge';
import MealIcon from '@/components/MealIcon';
import { formatINR, formatDatePretty } from '@/lib/utils';

export default function CartPage() {
  const router = useRouter();
  const { cartItems, updateQuantity, removeFromCart, clearCart, subtotal, totalItems } = useCart();
  const { user } = useAuth();
  const [orderNotes, setOrderNotes] = useState('');

  // Group cart items by student and date for crystal clear visual organization
  const groupedByChildAndDate: Record<string, typeof cartItems> = {};
  cartItems.forEach((item) => {
    const key = `${item.studentName} (Class ${item.studentGrade}-${item.studentDivision})__${item.date}`;
    if (!groupedByChildAndDate[key]) groupedByChildAndDate[key] = [];
    groupedByChildAndDate[key].push(item);
  });

  const handleProceedToCheckout = () => {
    // Save optional notes in sessionStorage
    if (orderNotes) {
      sessionStorage.setItem('nutribox_order_notes', orderNotes);
    }
    router.push('/parent/checkout');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShoppingCart className="w-7 h-7 text-amber-500" />
            <span>Shopping Cart</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review your selected meals grouped by child and date before proceeding to payment.
          </p>
        </div>

        {cartItems.length > 0 && (
          <button
            onClick={clearCart}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Your Cart is Empty</h3>
          <p className="text-xs text-slate-500">
            Browse today's or the weekly lunch menu, select a child, and add delicious nutritious meals.
          </p>
          <Link
            href="/parent/menu"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md hover:from-amber-600 hover:to-orange-600 transition-all"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Explore Menu</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Cart Items List */}
          <div className="lg:col-span-8 space-y-6">
            {Object.entries(groupedByChildAndDate).map(([groupKey, items]) => {
              const [studentInfo, dateStr] = groupKey.split('__');
              return (
                <div
                  key={groupKey}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  {/* Group Header: Student & Date */}
                  <div className="bg-amber-50/70 px-5 py-3 border-b border-amber-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="font-extrabold text-slate-900 text-sm">{studentInfo}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>{formatDatePretty(dateStr)}</span>
                    </div>
                  </div>

                  {/* Items for this student & date */}
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <div
                        key={item.cartItemId}
                        className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          <MealIcon
                            name={item.mealName}
                            category={item.mealCategory}
                            size="md"
                          />

                          <div>
                            <div className="flex items-center gap-2">
                              <VegBadge isVegetarian={item.isVegetarian} size="sm" />
                              <h4 className="font-bold text-slate-900 text-sm">{item.mealName}</h4>
                            </div>
                            <p className="text-xs font-bold text-amber-700 mt-0.5">
                              {formatINR(item.mealPrice)} each
                            </p>
                          </div>
                        </div>

                        {/* Quantity Controls & Total */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                              className="p-1.5 hover:bg-white text-slate-600 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-bold text-slate-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              className="p-1.5 hover:bg-white text-slate-600 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="font-extrabold text-slate-900 text-sm min-w-16 text-right">
                            {formatINR(item.mealPrice * item.quantity)}
                          </span>

                          <button
                            onClick={() => removeFromCart(item.cartItemId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remove meal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Special Instructions / Chef Notes */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                Special Preparation Notes
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Mild spice for Aarav; please pack extra spoon."
                rows={2}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Right: Order Summary Box */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-xl space-y-5 sticky top-24">
            <h3 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              Order Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Meals</span>
                <span className="font-bold text-slate-800">{totalItems} portions</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-800">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>School Canteen Subsidy / Taxes (0%)</span>
                <span className="font-bold text-emerald-600">₹0</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-base font-extrabold text-slate-900">Total Payable</span>
                <span className="text-2xl font-black text-amber-600">{formatINR(subtotal)}</span>
              </div>
            </div>

            {/* Wallet quick indicator */}
            {user?.walletBalance !== undefined && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 flex items-center justify-between">
                <span>Available Meal Wallet:</span>
                <span className="font-extrabold">{formatINR(user.walletBalance)}</span>
              </div>
            )}

            <button
              onClick={handleProceedToCheckout}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Simulated INR Payment • 100% Secure</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
