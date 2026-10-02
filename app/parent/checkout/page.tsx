'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  QrCode,
  Building2,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  User,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useCart } from '@/components/CartContext';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import VegBadge from '@/components/VegBadge';
import { formatINR, formatDatePretty } from '@/lib/utils';
import { PaymentMethod } from '@/types';

export default function CheckoutPage() {
  const router = useRouter();
  const { cartItems, subtotal, totalItems, clearCart } = useCart();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [upiId, setUpiId] = useState('sharma.pooja@okhdfcbank');
  const [upiApp, setUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'custom'>('gpay');
  const [cardHolder, setCardHolder] = useState('Pooja Sharma');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('08/29');
  const [cardCvv, setCardCvv] = useState('888');
  const [bankName, setBankName] = useState('State Bank of India');
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const savedNotes = sessionStorage.getItem('nutribox_order_notes');
    if (savedNotes) setNotes(savedNotes);
  }, []);

  if (cartItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">No items to checkout</h2>
        <p className="text-xs text-slate-500">Your cart is empty. Please add meals from the menu first.</p>
        <Link
          href="/parent/menu"
          className="inline-block px-5 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md"
        >
          View Menu
        </Link>
      </div>
    );
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const res = await fetch('/api/parent/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems,
          paymentMethod,
          upiId: paymentMethod === 'UPI' ? upiId : undefined,
          cardLastFour: paymentMethod === 'CARD' ? cardNumber.slice(-4) : undefined,
          bankName: paymentMethod === 'NET_BANKING' ? bankName : undefined,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Payment failed. Please try again.', 'error');
        setProcessing(false);
        return;
      }

      // Success
      clearCart();
      sessionStorage.removeItem('nutribox_order_notes');
      await refreshUser();
      showToast('Payment successful! Order confirmed.', 'success');
      router.push(`/parent/confirmation/${data.orderId}`);
    } catch {
      showToast('A network error occurred while processing payment', 'error');
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <CreditCard className="w-7 h-7 text-amber-500" />
          <span>Complete Payment & Checkout</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Simulated checkout for Indian Schools with UPI, RuPay/Cards, Net Banking, and School Meal Wallet.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Payment Method & Parent Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Parent & Student Summary Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-amber-500" />
              <span>Parent Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px]">Name</p>
                <p className="font-extrabold text-slate-800">{user?.name || 'Pooja Sharma'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px]">Email</p>
                <p className="font-medium text-slate-800 truncate">{user?.email || 'parent@example.com'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px]">Phone</p>
                <p className="font-medium text-slate-800">{user?.phone || '+91 98765 43210'}</p>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-500" />
                <span>Select Payment Method</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                100% Mock / Test Mode
              </span>
            </div>

            {/* Methods Tab */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'UPI', label: 'UPI / QR', icon: QrCode, sub: 'GPay, PhonePe' },
                { id: 'WALLET', label: 'Meal Wallet', icon: Wallet, sub: `Bal: ${formatINR(user?.walletBalance || 0)}` },
                { id: 'CARD', label: 'Cards', icon: CreditCard, sub: 'Debit / Credit' },
                { id: 'NET_BANKING', label: 'Net Banking', icon: Building2, sub: 'All Indian Banks' },
              ].map((m) => {
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-400/20'
                        : 'border-slate-200 hover:border-amber-200 bg-white'
                    }`}
                  >
                    <m.icon
                      className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`}
                    />
                    <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-amber-900' : 'text-slate-800'}`}>
                      {m.label}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{m.sub}</p>
                  </button>
                );
              })}
            </div>

            {/* Sub-Form Based on Method */}
            <form onSubmit={handlePay} className="space-y-4 pt-2">
              {paymentMethod === 'UPI' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Quick UPI Apps:</span>
                    <div className="flex gap-2">
                      {['GPay', 'PhonePe', 'Paytm'].map((app) => (
                        <button
                          key={app}
                          type="button"
                          onClick={() => setUpiId(`sharma.pooja@ok${app.toLowerCase()}`)}
                          className="px-2.5 py-1 bg-white border border-slate-200 hover:border-amber-400 rounded-lg text-xs font-semibold text-slate-700"
                        >
                          {app}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Enter UPI ID / VPA</label>
                    <input
                      type="text"
                      required
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="username@okhdfcbank"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">A mock payment confirmation will be simulated.</p>
                  </div>
                </div>
              )}

              {paymentMethod === 'WALLET' && (
                <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Parent Meal Wallet Balance</p>
                      <p className="text-2xl font-black text-emerald-800">{formatINR(user?.walletBalance || 0)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                      <Wallet className="w-6 h-6" />
                    </div>
                  </div>

                  {(user?.walletBalance || 0) < subtotal ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs space-y-1">
                      <p className="font-bold">⚠️ Insufficient Wallet Balance</p>
                      <p>
                        Your current balance is {formatINR(user?.walletBalance || 0)}, but order total is {formatINR(subtotal)}. Please recharge your wallet or choose UPI/Cards.
                      </p>
                      <Link
                        href="/parent/profile"
                        className="inline-block mt-1 font-bold text-rose-900 underline"
                      >
                        Recharge Wallet Now →
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-700 font-medium">
                      ✓ Instant 1-click deduction. Balance after order will be{' '}
                      <strong>{formatINR((user?.walletBalance || 0) - subtotal)}</strong>.
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === 'CARD' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Card Number (Visa / RuPay / MasterCard)</label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CVV</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'NET_BANKING' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Bank</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="State Bank of India">State Bank of India (SBI)</option>
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="Axis Bank">Axis Bank</option>
                    <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    <option value="Punjab National Bank">Punjab National Bank</option>
                  </select>
                </div>
              )}

              {/* Pay Button */}
              <button
                type="submit"
                disabled={processing || (paymentMethod === 'WALLET' && (user?.walletBalance || 0) < subtotal)}
                className={`w-full py-4 rounded-2xl font-bold text-white text-sm sm:text-base shadow-lg transition-all flex items-center justify-center gap-2 mt-4 ${
                  processing
                    ? 'bg-amber-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25 hover:shadow-xl'
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Authorizing Payment of {formatINR(subtotal)}...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Confirm & Pay {formatINR(subtotal)}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Detailed Order Breakdown */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
          <h3 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3 flex items-center justify-between">
            <span>Selected Meals ({totalItems})</span>
            <Link href="/parent/cart" className="text-xs font-semibold text-amber-600 hover:underline">
              Edit Cart
            </Link>
          </h3>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {cartItems.map((item) => (
              <div key={item.cartItemId} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <VegBadge isVegetarian={item.isVegetarian} size="sm" />
                    <span className="font-bold text-slate-900">{item.mealName}</span>
                    <span className="text-slate-400 font-semibold">× {item.quantity}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    For: <strong className="text-slate-700">{item.studentName}</strong> (Class {item.studentGrade}-{item.studentDivision})
                  </p>
                  <p className="text-[10px] text-amber-700 font-semibold">
                    Date: {formatDatePretty(item.date)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900">{formatINR(item.mealPrice * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>

          {notes && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-0.5">
              <span className="font-bold text-amber-900 text-[10px] uppercase">Special Instructions:</span>
              <p className="text-amber-800">{notes}</p>
            </div>
          )}

          <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-bold text-slate-900">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Platform Fee</span>
              <span className="font-bold text-emerald-600">FREE</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Taxes</span>
              <span className="font-bold text-emerald-600">₹0</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-base font-extrabold text-slate-900">
              <span>Total Payable</span>
              <span className="text-2xl font-black text-amber-600">{formatINR(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
