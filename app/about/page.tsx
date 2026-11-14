import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Clock,
  Leaf,
  CreditCard,
  GraduationCap,
} from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'About School-Bite, meal pre-ordering for the S.B. Patil School canteen.',
};

export default function AboutPage() {
  const formattedAddress = getFormattedAddress();

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Breadcrumb & Title */}
        <div className="space-y-4 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            About <span className="text-amber-600">{BUSINESS_CONFIG.brandName}</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl">
            School-Bite is the meal pre-ordering website for the {BUSINESS_CONFIG.schoolName} canteen, Ravet, Pune. Parents choose meals and pay online; the school canteen prepares the food.
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
              Every meal on School-Bite is pure vegetarian.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Ordering Cutoff</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Order before 08:30 AM on the meal day. Orders can't be cancelled online; to cancel, contact the canteen at <a href={`tel:${BUSINESS_CONFIG.cancellationContactPhone}`} className="font-bold hover:underline">{BUSINESS_CONFIG.cancellationContactPhone}</a>.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Online Payment</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Pay online through {BUSINESS_CONFIG.paymentGatewayPartner}.
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
                Add your child with their class.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Step 2</span>
              <h4 className="text-sm font-bold text-slate-900">Browse Menu</h4>
              <p className="text-xs text-slate-500">
                See the meals and prices published by the school canteen.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Step 3</span>
              <h4 className="text-sm font-bold text-slate-900">Pay Online</h4>
              <p className="text-xs text-slate-500">
                Pay online through {BUSINESS_CONFIG.paymentGatewayPartner} before 08:30 AM on the meal day.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Step 4</span>
              <h4 className="text-sm font-bold text-slate-900">Brunch Break Collection</h4>
              <p className="text-xs text-slate-500">
                Your child collects the meal at the canteen counter during the brunch break.
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
            School-Bite is operated by <strong>{BUSINESS_CONFIG.legalEntityName}</strong> (Proprietor: <strong>{BUSINESS_CONFIG.proprietorName}</strong>). Food is prepared and provided by the {BUSINESS_CONFIG.schoolName} canteen, Ravet, Pune.
          </p>
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Operating Business</span>
              <span>{BUSINESS_CONFIG.legalEntityName}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Business / Trade Names</span>
              <span>BRIGHT DESIGNERS / NEW BRIGHT XEROX / BRIGHT CATERING</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Legal Proprietor</span>
              <span>{BUSINESS_CONFIG.proprietorName}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Customer Email</span>
              <a href={`mailto:${BUSINESS_CONFIG.supportEmail}`} className="text-amber-700 hover:underline">
                {BUSINESS_CONFIG.supportEmail}
              </a>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Canteen phone</span>
              <a href={`tel:${BUSINESS_CONFIG.cancellationContactPhone}`} className="text-slate-900 hover:underline">
                {BUSINESS_CONFIG.cancellationContactPhone}
              </a>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Official Website</span>
              <a href={BUSINESS_CONFIG.websiteUrl} className="text-amber-700 hover:underline">
                {BUSINESS_CONFIG.websiteUrl}
              </a>
            </div>
            <div className="sm:col-span-2 md:col-span-3">
              <span className="text-slate-500 block text-[10px] uppercase">Operating Location</span>
              <span>{formattedAddress}</span>
            </div>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-slate-900 text-white rounded-3xl">
          <div>
            <h4 className="text-base font-bold">Have questions or need assistance?</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Contact us about orders, payments or your account.
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
