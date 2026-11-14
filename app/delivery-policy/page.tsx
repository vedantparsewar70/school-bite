import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Truck, Clock, MapPin, AlertCircle, Mail } from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'Shipping & Delivery Policy',
  description: 'School-Bite meals are collected at the S.B. Patil School canteen. No shipping or home delivery.',
};

export default function DeliveryPolicyPage() {
  const formattedAddress = getFormattedAddress();

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-bold text-amber-800">
            <Truck className="w-3.5 h-3.5 text-amber-600" />
            <span>Meal Fulfillment & Delivery</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Shipping &amp; Delivery Policy
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium pt-1">
            <span>Service: <strong className="text-slate-700">{BUSINESS_CONFIG.brandName}</strong></span>
            <span>•</span>
            <span>Operating School: <strong className="text-slate-700">{BUSINESS_CONFIG.schoolName}</strong></span>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs space-y-8 text-sm sm:text-base text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>1. How Meals Are Delivered</span>
            </h2>
            <p>
              <strong>{BUSINESS_CONFIG.brandName}</strong> is operated by <strong>{BUSINESS_CONFIG.legalEntityName}</strong> (Registered Business / Trade Names: <strong>{BUSINESS_CONFIG.registeredBusinessNames}</strong>; Proprietor: <strong>{BUSINESS_CONFIG.proprietorName}</strong>; Website: <strong>{BUSINESS_CONFIG.websiteUrl}</strong>). It is the pre-ordering website for pure vegetarian meals from the <strong>{BUSINESS_CONFIG.schoolName}</strong> canteen, Ravet, Pune.
            </p>
            <p>
              <strong>There is no shipping or home delivery.</strong> Meals are collected by the student at the {BUSINESS_CONFIG.schoolName} canteen counter during the brunch break. Teachers who order as guests also collect at the canteen.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span>2. Order Cutoff</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 pt-1">
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1 text-xs">
                <span className="font-bold text-amber-900 text-sm block">Daily Order Cutoff</span>
                <p className="text-amber-800">
                  Orders for a given school date must be submitted by <strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              <span>3. Collection</span>
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>Where:</strong> the {BUSINESS_CONFIG.schoolName} canteen counter.
              </li>
              <li>
                <strong>When:</strong> during the school brunch break on the meal day.
              </li>
              <li>
                <strong>How:</strong> canteen staff hand the meal to the child by name and class.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>4. Charges</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              No delivery or handling charges apply.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span>5. Non-Collection &amp; School Absence</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              If a student is absent from school on a scheduled meal day:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>
                Orders cannot be cancelled online. To cancel, contact the canteen at <a href={`tel:${BUSINESS_CONFIG.cancellationContactPhone}`} className="font-bold hover:underline">{BUSINESS_CONFIG.cancellationContactPhone}</a> prior to the <strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong> cutoff. Approved refunds go back to the original payment method per our Refund &amp; Cancellation Policy.
              </li>
              <li>
                If the order is not cancelled before the cutoff, it cannot be refunded.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>6. Contact</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Contact us:
            </p>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-2">
              <p><strong>Operating Business:</strong> {BUSINESS_CONFIG.legalEntityName}</p>
              <p><strong>Registered Business / Trade Names:</strong> {BUSINESS_CONFIG.registeredBusinessNames}</p>
              <p><strong>Legal / Proprietor Name:</strong> {BUSINESS_CONFIG.proprietorName}</p>
              <p><strong>Brand / Platform Name:</strong> {BUSINESS_CONFIG.brandName}</p>
              <p>
                <strong>Official Website:</strong>{' '}
                <a href={BUSINESS_CONFIG.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 font-bold hover:underline">
                  {BUSINESS_CONFIG.websiteUrl}
                </a>
              </p>
              <p><strong>Operating School:</strong> {BUSINESS_CONFIG.schoolName}</p>
              <p>
                <strong>Customer Support Email:</strong>{' '}
                <a href={`mailto:${BUSINESS_CONFIG.supportEmail}`} className="text-amber-600 font-bold hover:underline">
                  {BUSINESS_CONFIG.supportEmail}
                </a>
              </p>
              <p>
                <strong>Canteen phone:</strong>{' '}
                <a href={`tel:${BUSINESS_CONFIG.cancellationContactPhone}`} className="font-bold text-slate-800 hover:underline">
                  {BUSINESS_CONFIG.cancellationContactPhone}
                </a>
              </p>
              <p><strong>Campus Location:</strong> {formattedAddress}</p>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-slate-500">
          <Link href="/" className="font-bold text-amber-600 hover:underline">
            ← Back to Home
          </Link>
          <div className="flex flex-wrap gap-4 font-semibold text-slate-600">
            <Link href="/terms-and-conditions" className="hover:underline">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy-policy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link href="/refund-policy" className="hover:underline">
              Refund &amp; Cancellation Policy
            </Link>
            <Link href="/contact" className="hover:underline">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
