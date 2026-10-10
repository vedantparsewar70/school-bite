import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Truck, CheckCircle2, Clock, MapPin, AlertCircle, ShieldCheck, Mail, Building2 } from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'Shipping & Delivery Policy | School-Bite - S.B. Patil School',
  description:
    'Shipping and Delivery Policy for School-Bite meals at S.B. Patil School. Learn about order cutoffs, on-campus food fulfillment, counter collection during lunch breaks, and delivery terms.',
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
            <span>Operating Entity: <strong className="text-slate-700">{BUSINESS_CONFIG.legalEntityName}</strong></span>
            <span>•</span>
            <span>Business / Trade Names: <strong className="text-slate-700">{BUSINESS_CONFIG.registeredBusinessNames}</strong></span>
            <span>•</span>
            <span>Proprietor: <strong className="text-slate-700">{BUSINESS_CONFIG.proprietorName}</strong></span>
            <span>•</span>
            <span>Website: <strong className="text-slate-700">{BUSINESS_CONFIG.websiteUrl}</strong></span>
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
              <span>1. Fulfillment Model (On-Campus Canteen Service)</span>
            </h2>
            <p>
              <strong>{BUSINESS_CONFIG.brandName}</strong> is operated by <strong>{BUSINESS_CONFIG.legalEntityName}</strong> (Registered Business / Trade Names: <strong>{BUSINESS_CONFIG.registeredBusinessNames}</strong>; Proprietor: <strong>{BUSINESS_CONFIG.proprietorName}</strong>; Website: <strong>{BUSINESS_CONFIG.websiteUrl}</strong>). Our platform facilitates advance pre-ordering of fresh, hygienic, pure vegetarian school meals for students enrolled at <strong>{BUSINESS_CONFIG.schoolName}</strong> (Ravet, Pune).
            </p>
            <p>
              Because our service involves hot, freshly prepared meals consumed on campus, <strong>physical shipping via third-party couriers or doorstep home delivery is NOT applicable</strong>. All orders placed on our website are fulfilled directly on-premises at the <strong>{BUSINESS_CONFIG.schoolName} Canteen</strong>.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span>2. Daily Order Cutoff &amp; Preparation Timelines</span>
            </h2>
            <p>
              To ensure freshness, hygiene, and zero food wastage, meal orders must be placed and completed prior to the scheduled daily preparation deadline:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1 text-xs">
                <span className="font-bold text-amber-900 text-sm block">Daily Order Cutoff</span>
                <p className="text-amber-800">
                  Orders for a given school date must be submitted by <strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong>.
                </p>
              </div>

              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1 text-xs">
                <span className="font-bold text-emerald-900 text-sm block">Same-Day Fresh Preparation</span>
                <p className="text-emerald-800">
                  Kitchen staff prepares exact batch portions in the morning following cutoff for same-day consumption.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              <span>3. Meal Distribution &amp; Counter Collection Process</span>
            </h2>
            <p>
              On the scheduled date of service:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>Distribution Point:</strong> {BUSINESS_CONFIG.schoolName} on-campus canteen distribution counter.
              </li>
              <li>
                <strong>Distribution Time:</strong> During the student&apos;s scheduled school lunch / recess break.
              </li>
              <li>
                <strong>Student Identification:</strong> Meals are labeled and handed over based on the student&apos;s registered Name, Class/Grade, Division, and Roll Number as provided during pre-ordering. Parents can also provide their digital order voucher/token to the child.
              </li>
              <li>
                <strong>Hygiene Standards:</strong> Meals are packed in food-grade, thermal containers maintaining food temperature and hygiene until lunch collection.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>4. Shipping / Delivery Charges</span>
            </h2>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4 text-xs sm:text-sm">
              <div>
                <p className="font-bold text-slate-900">Standard Delivery / Handling Fee</p>
                <p className="text-slate-500 text-xs">Since meals are collected at the school canteen counter, no shipping fees apply.</p>
              </div>
              <span className="font-extrabold text-emerald-600 text-lg">₹0.00 (FREE)</span>
            </div>
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
                If you notify and cancel prior to the <strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong> cutoff, the order is cancelled and a 100% refund is initiated per our Refund &amp; Cancellation Policy.
              </li>
              <li>
                If cancellation is not requested prior to cutoff, food preparation is executed and the portion cannot be repurposed or refunded due to health and safety regulations governing perishable food items.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>6. Questions Regarding Fulfillment</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              For any questions regarding order fulfillment, canteen location, or special meal handling, please reach out to our support desk:
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
                <strong>Customer Support Phone:</strong>{' '}
                <a href={`tel:${BUSINESS_CONFIG.supportPhoneRaw}`} className="font-bold text-slate-800 hover:underline">
                  {BUSINESS_CONFIG.supportPhone} / {BUSINESS_CONFIG.supportPhoneRaw}
                </a>
              </p>
              <p><strong>Support Availability:</strong> {BUSINESS_CONFIG.supportAvailability}</p>
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
