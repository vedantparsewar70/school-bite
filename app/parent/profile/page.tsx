'use client';

import React from 'react';
import Link from 'next/link';
import {
  User,
  Phone,
  Mail,
  Users,
  ShieldCheck,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <User className="w-7 h-7 text-amber-500" />
          <span>Parent Profile</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your account credentials, emergency phone number, and registered children.
        </p>
      </div>

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

        <div className="space-y-4 pt-2 text-xs divide-y divide-slate-100">
          <div className="flex items-center justify-between py-3">
            <span className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" /> Email Address
            </span>
            <span className="font-semibold text-slate-800 text-sm">{user?.email}</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" /> Mobile Number
            </span>
            <span className="font-semibold text-slate-800 text-sm">{user?.phone || 'Not provided'}</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" /> Registered Children
            </span>
            <Link
              href="/parent/children"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-200 transition-colors"
            >
              <span>Manage Children</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" /> Order History
            </span>
            <Link
              href="/parent/orders"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-200 transition-colors"
            >
              <span>View Past Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-800">Account Security</p>
            <p className="text-slate-500 mt-0.5">
              Your details are verified with the school administration. Meals ordered are delivered directly to your child's classroom.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
