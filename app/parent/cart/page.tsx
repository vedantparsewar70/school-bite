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
  ShieldCheck,
  FileText,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { useCart } from '@/components/CartContext';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import VegBadge from '@/components/VegBadge';
import MealIcon from '@/components/MealIcon';
import { formatINR, formatDatePretty } from '@/lib/utils';

export default function CartPage() {
  const router = useRouter();
  const { cartItems, updateQuantity, removeFromCart, clearCart, subtotal, totalItems } = useCart();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Group cart items by student and date for clear visual organization
  const groupedByChildAndDate: Record<string, typeof cartItems> = {};
  cartItems.forEach((item) => {
    const key = `${item.studentName} (Class ${item.studentGrade}-${item.studentDivision})__${item.date}`;
    if (!groupedByChildAndDate[key]) groupedByChildAndDate[key] = [];
    groupedByChildAndDate[key].push(item);
  });

  const loadCashfreeSdk = (): Promise<any> => {
    if (typeof window !== 'undefined' && (window as any).Cashfree) {
      return Promise.resolve((window as any).Cashfree);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => {
        if ((window as any).Cashfree) {
          resolve((window as any).Cashfree);
        } else {
          reject(new Error('Cashfree SDK failed to initialize'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Cashfree SDK script'));
      document.body.appendChild(script);
    });
  };

  const handleProceedToPayment = async () => {
    if (processing) return;
    if (cartItems.length === 0) return;

    if (!user) {
      router.push('/login?redirect=/parent/cart');
      return;
    }

    setErrorMessage('');
    setProcessing(true);

    try {
      const idempotencyKey = `ORD-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

      const res = await fetch('/api/parent/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems,
          paymentMethod: 'UPI',
          notes: notes.trim() || undefined,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText = data.error || 'Unable to create order. Please try again.';
        setErrorMessage(errorText);
        showToast(errorText, 'error');
        setProcessing(false);
        return;
      }

      // If Cashfree Payment Gateway Session is returned, launch official Cashfree modal directly
      if (data.paymentSessionId) {
        try {
          const CashfreeSDK = await loadCashfreeSdk();
          const mode = process.env.NEXT_PUBLIC_CASHFREE_ENV === 'prod' ? 'production' : 'sandbox';
          const cashfree = CashfreeSDK({ mode });

          cashfree
            .checkout({
              paymentSessionId: data.paymentSessionId,
              redirectTarget: '_modal',
            })
            .then((result: any) => {
              if (result?.error) {
                setErrorMessage(result.error.message || 'Payment was cancelled or could not be completed.');
                showToast(result.error.message || 'Payment cancelled', 'error');
                setProcessing(false);
              } else {
                // Completed inside modal or redirected
                clearCart();
                refreshUser().catch(() => {});
                showToast('Payment submitted! Verifying order...', 'success');
                router.push(`/parent/confirmation/${data.orderId}`);
              }
            });
          return;
        } catch (sdkErr: any) {
          console.error('Error opening Cashfree Checkout:', sdkErr);
          setErrorMessage('Could not open payment window. Please try again.');
          showToast('Payment window could not be opened', 'error');
          setProcessing(false);
          return;
        }
      }

      // Fallback for direct confirmation (e.g. if Cashfree disabled)
      clearCart();
      refreshUser().catch(() => {});
      showToast('Order confirmed!', 'success');
      router.push(`/parent/confirmation/${data.orderId}`);
    } catch {
      setErrorMessage('A network error occurred while connecting to payment gateway. Please retry.');
      showToast('Network error connecting to payment gateway', 'error');
      setProcessing(false);
    }
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
            disabled={processing}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
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
            Browse today&apos;s or the weekly lunch menu, select a child, and add delicious nutritious meals.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link
              href="/parent/menu"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md hover:from-amber-600 hover:to-orange-600 transition-all"
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Explore Menu</span>
            </Link>
            <Link
              href="/parent/orders"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all"
            >
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Order History</span>
            </Link>
          </div>
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
                  <div className="bg-amber-50/70 px-4 sm:px-5 py-3 border-b border-amber-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{studentInfo}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-amber-900 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>{formatDatePretty(dateStr)}</span>
                    </div>
                  </div>

                  {/* Items for this student & date */}
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <div
                        key={item.cartItemId}
                        className="p-3.5 sm:p-5 hover:bg-slate-50/50 transition-colors space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4"
                      >
                        {/* Top on mobile, Left on desktop: Meal Icon & Info */}
                        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                          <div className="shrink-0 mt-0.5 sm:mt-0">
                            <MealIcon
                              name={item.mealName}
                              category={item.mealCategory}
                              size="md"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <VegBadge isVegetarian={item.isVegetarian} size="sm" />
                              <h4 className="font-bold text-slate-900 text-sm leading-snug break-words">
                                {item.mealName}
                              </h4>
                            </div>
                            <p className="text-xs font-semibold text-amber-700 mt-0.5">
                              {formatINR(item.mealPrice)} each
                            </p>
                          </div>

                          {/* Mobile-only trash button in top-right corner */}
                          <button
                            onClick={() => removeFromCart(item.cartItemId)}
                            disabled={processing}
                            className="sm:hidden p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                            title="Remove meal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Bottom on mobile, Right on desktop: Quantity Controls & Subtotal */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-2.5 sm:pt-0 border-t border-slate-100 sm:border-0">
                          <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-2xs">
                            <button
                              onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                              disabled={processing}
                              className="p-1.5 sm:p-2 hover:bg-white text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-bold text-slate-800 min-w-6 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              disabled={processing}
                              className="p-1.5 sm:p-2 hover:bg-white text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-slate-900 text-sm sm:text-base text-right whitespace-nowrap">
                              {formatINR(item.mealPrice * item.quantity)}
                            </span>

                            {/* Desktop-only trash button */}
                            <button
                              onClick={() => removeFromCart(item.cartItemId)}
                              disabled={processing}
                              className="hidden sm:block p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                              title="Remove meal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Payment & Order Box */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-xl space-y-5 sticky top-24">
            <h3 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              Order Summary
            </h3>

            {/* Price Breakdown */}
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
                <span>Taxes & Fees</span>
                <span className="font-bold text-emerald-600">₹0</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-base font-extrabold text-slate-900">Total Payable</span>
                <span className="text-2xl font-black text-amber-600">{formatINR(subtotal)}</span>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                <span>Kitchen Instructions (Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Mild spice, warm packing..."
                rows={2}
                disabled={processing}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Proceed to Payment Button */}
            <button
              onClick={handleProceedToPayment}
              disabled={processing || cartItems.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to Cashfree...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Security & Gateway Trust Badge */}
            <div className="pt-1 text-center space-y-1">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Secured by Cashfree Payments</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Supports UPI, Cards, Net Banking & Wallets • 256-bit Bank Grade Security
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
