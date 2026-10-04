import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Clock,
  ShieldCheck,
  Leaf,
  CreditCard,
  ChefHat,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'About Us | School-Bite - School Meal Pre-Ordering Platform',
  description:
    'Learn about School-Bite, the simple and convenient school meal pre-ordering platform connecting parents with the S.B. Patil School canteen.',
};

export default function AboutPage() {
  const formattedAddress = getFormattedAddress();

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Breadcrumb & Title */}
        <div className="space-y-4 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-bold text-amber-800">
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
            <span>About Our Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            About <span className="text-amber-600">{BUSINESS_CONFIG.brandName}</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl">
            {BUSINESS_CONFIG.shortDescription}
          </p>
        </div>

        {/* Mission & Purpose Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Our Purpose</span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            School-Bite was developed to streamline daily canteen operations for <strong>{BUSINESS_CONFIG.schoolName}</strong>. Traditional school lunch breaks often involve rushed ordering, long queues, cash-handling bottlenecks, and food wastage due to unpredictable demand.
          </p>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            By enabling pre-orders for the next day, School-Bite allows the school canteen kitchen to know precise portion requirements in advance. Students receive freshly prepared, hot meals without waiting in line, and parents have complete peace of mind regarding the wholesome food choices their children enjoy every school day.
          </p>
        </div>

        {/* Key Operational Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Leaf className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">100% Pure Vegetarian</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Every meal prepared and scheduled on School-Bite adheres to strict pure vegetarian standards, prepared in hygienic, inspected school kitchen facilities.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Advance Fresh Pre-Orders</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Orders are placed in advance before the daily kitchen cutoff time ({BUSINESS_CONFIG.cancellationCutoffTime}). This ensures fresh ingredient sourcing and morning batch cooking.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Cashless & Secure Payments</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Transactions are processed directly and securely through certified payment partner ({BUSINESS_CONFIG.paymentGatewayPartner}) via UPI, debit/credit cards, and net banking.
            </p>
          </div>
        </div>

        {/* How the Ordering Flow Works */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>How School-Bite Operates</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Step 1</span>
              <h4 className="text-sm font-bold text-slate-900">Select Child Profile</h4>
              <p className="text-xs text-slate-500">
                Register or select your child with their grade, division, and roll number for accurate delivery.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Step 2</span>
              <h4 className="text-sm font-bold text-slate-900">Browse Menu</h4>
              <p className="text-xs text-slate-500">
                Review available meals published by the school canteen, complete with transparent portion pricing.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Step 3</span>
              <h4 className="text-sm font-bold text-slate-900">Pay Securely Online</h4>
              <p className="text-xs text-slate-500">
                Complete pre-order payment using UPI, debit/credit card, or net banking prior to the daily cutoff.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Step 4</span>
              <h4 className="text-sm font-bold text-slate-900">Lunch Break Collection</h4>
              <p className="text-xs text-slate-500">
                The school canteen prepares fresh meals, and students collect them during the scheduled lunch break.
              </p>
            </div>
          </div>
        </div>

        {/* Operating School & Fulfillment Information */}
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent rounded-3xl p-6 sm:p-8 border border-amber-200/80 space-y-4">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <GraduationCap className="w-5 h-5 text-amber-600" />
            <span>School & Food Fulfilment</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">{BUSINESS_CONFIG.schoolName} Canteen</h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            School-Bite works hand-in-hand with the on-premise canteen catering team of {BUSINESS_CONFIG.schoolName} in Ravet, Pune. Food is prepared and provided directly by the school canteen. Meal preparations are carried out strictly according to advance verified orders.
          </p>
          <div className="pt-2 flex flex-wrap gap-6 text-xs font-semibold text-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Operating Location</span>
              <span>{formattedAddress}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Daily Order Cutoff</span>
              <span>{BUSINESS_CONFIG.cancellationCutoffTime}</span>
            </div>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-slate-900 text-white rounded-3xl">
          <div>
            <h4 className="text-base font-bold">Have questions or need assistance?</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Our support team is here to assist parents with meal orders, payments, and account questions.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/contact"
              className="w-full sm:w-auto text-center px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Contact Support
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto text-center px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              Parent Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
