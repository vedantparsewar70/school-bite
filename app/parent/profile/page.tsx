'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  Wallet,
  Phone,
  Mail,
  ShieldCheck,
  Plus,
  ArrowRight,
  CheckCircle2,
  Users,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import { formatINR } from '@/lib/utils';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [topUpAmount, setTopUpAmount] = useState('500');
  const [loading, setLoading] = useState(false);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/parent/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Wallet recharged successfully!', 'success');
        await refreshUser();
      } else {
        showToast(data.error || 'Failed to recharge wallet', 'error');
      }
    } catch {
      showToast('Network error recharging wallet', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <User className="w-7 h-7 text-amber-500" />
          <span>Parent Profile & Meal Wallet</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your account credentials, emergency phone number, and pre-fund your child's meal wallet.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Parent Info Card */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-amber-500/20">
                {user?.name?.charAt(0) || 'P'}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">{user?.name}</h2>
                <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                  Parent Account
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs divide-y divide-slate-100">
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                </span>
                <span className="font-semibold text-slate-800">{user?.email}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Mobile
                </span>
                <span className="font-semibold text-slate-800">{user?.phone || '+91 98765 43210'}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" /> Registered Children
                </span>
                <Link
                  href="/parent/children"
                  className="font-bold text-amber-700 hover:underline flex items-center gap-1"
                >
                  Manage Children →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Wallet Management Card */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Prepaid School Balance
                </span>
                <h3 className="text-3xl font-black text-emerald-700 mt-1">
                  {formatINR(user?.walletBalance || 0)}
                </h3>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Wallet className="w-7 h-7" />
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Use your Meal Wallet for instant 1-click checkouts without entering OTPs or UPI apps every day.
            </p>

            {/* Quick Top-up Form */}
            <form onSubmit={handleTopUp} className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Recharge Amount
              </label>

              <div className="grid grid-cols-3 gap-2">
                {['200', '500', '1000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      topUpAmount === amt
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 hover:border-emerald-300 bg-white text-slate-700'
                    }`}
                  >
                    + ₹{amt}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Or enter custom amount (₹):
                </label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{loading ? 'Recharging...' : `Top Up Wallet with ₹${topUpAmount}`}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
