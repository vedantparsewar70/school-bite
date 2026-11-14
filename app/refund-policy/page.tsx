import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RotateCcw, CheckCircle2, XCircle, AlertTriangle, Clock, CreditCard, Mail } from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'How to cancel a School-Bite order and how refunds work.',
};

export default function RefundPolicyPage() {
  const formattedAddress = getFormattedAddress();

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-bold text-amber-800">
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span>Customer Payments & Refunds</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Refund & Cancellation Policy
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium pt-1">
            <span>Service: <strong className="text-slate-700">{BUSINESS_CONFIG.brandName}</strong></span>
            <span>•</span>
            <span>Operating School: <strong className="text-slate-700">{BUSINESS_CONFIG.schoolName}</strong></span>
            <span>•</span>
            <span>Payment Partner: {BUSINESS_CONFIG.paymentGatewayPartner}</span>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs space-y-8 text-sm sm:text-base text-slate-600 leading-relaxed">
          {/* Section 1: Overview */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>1. Overview</span>
            </h2>
            <p>
              <strong>{BUSINESS_CONFIG.brandName}</strong> (<a href={BUSINESS_CONFIG.websiteUrl} className="text-amber-700 hover:underline">{BUSINESS_CONFIG.websiteUrl}</a>) is operated by <strong>{BUSINESS_CONFIG.legalEntityName}</strong> (Registered Business / Trade Names: <strong>BRIGHT DESIGNERS / NEW BRIGHT XEROX / BRIGHT CATERING</strong>; Legal Proprietor: <strong>{BUSINESS_CONFIG.proprietorName}</strong>) for the <strong>{BUSINESS_CONFIG.schoolName}</strong> canteen, Ravet, Pune.
            </p>
          </section>

          {/* Section 2: Order Cancellation Guidelines */}
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span>2. How to Cancel</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>How to Cancel</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Orders cannot be cancelled online. To cancel an order, please contact the canteen at <a href={`tel:${BUSINESS_CONFIG.cancellationContactPhone}`} className="font-bold hover:underline">{BUSINESS_CONFIG.cancellationContactPhone}</a> before the daily cutoff deadline (<strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong>). Approved refunds go back to your original payment method.
                </p>
              </div>

              <div className="p-5 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>After Daily Cutoff Time</span>
                </div>
                <p className="text-xs text-rose-900 leading-relaxed">
                  After {BUSINESS_CONFIG.cancellationCutoffTime}, orders cannot be cancelled or refunded.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: When Refunds Are Issued */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>3. When a Refund May Be Approved</span>
            </h2>
            <p>A refund may be approved in these cases:</p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
              <li>The canteen cannot serve an item you paid for.</li>
              <li>The school is closed on the meal day.</li>
              <li>You were charged twice for one order.</li>
              <li>You were charged but no order was created.</li>
              <li>The canteen cancelled your order at your request (call {BUSINESS_CONFIG.cancellationContactPhone}) before the cutoff.</li>
            </ul>
          </section>

          {/* Section 4: Non-Refundable Situations */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>4. No Refund</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              No refund if the order was not cancelled before the cutoff (for example, the student was absent), the meal was not collected at the canteen counter during the brunch break, or the child&apos;s details were wrong.
            </p>
          </section>

          {/* Section 5: Payment Failures & Gateway Scenarios */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>5. Failed Payments</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              If a payment fails or you close the payment window, no order is created. If money was deducted but no order was created, contact us and the amount will be refunded to your original payment method.
            </p>
          </section>

          {/* Section 6: How Refunds Are Processed & Timeline */}
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-500" />
              <span>6. How Refunds Are Paid</span>
            </h2>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs sm:text-sm text-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900">Where refunds go</span>
                <span className="text-slate-600">Approved refunds go to the original payment method.</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900">Payment Gateway Partner</span>
                <span className="text-slate-600">{BUSINESS_CONFIG.paymentGatewayPartner}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-slate-900">Timeline</span>
                <span className="font-extrabold text-amber-700">Refunds usually take {BUSINESS_CONFIG.refundProcessingDays}, depending on your bank.</span>
              </div>
            </div>
          </section>

          {/* Section 7: How to Request Assistance */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>7. Contact</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              To cancel, call the canteen at <a href={`tel:${BUSINESS_CONFIG.cancellationContactPhone}`} className="font-bold hover:underline">{BUSINESS_CONFIG.cancellationContactPhone}</a>. For a payment problem, contact us with your registered email or phone, the Order ID, and your child&apos;s name and class.
            </p>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-2 mt-3">
              <p><strong>Operating Business:</strong> {BUSINESS_CONFIG.legalEntityName}</p>
              <p><strong>Registered Business / Trade Names:</strong> BRIGHT DESIGNERS / NEW BRIGHT XEROX / BRIGHT CATERING</p>
              <p><strong>Legal Proprietor:</strong> {BUSINESS_CONFIG.proprietorName}</p>
              <p><strong>Platform Brand:</strong> {BUSINESS_CONFIG.brandName}</p>
              <p><strong>Official Website:</strong> <a href={BUSINESS_CONFIG.websiteUrl} className="text-amber-600 font-bold hover:underline">{BUSINESS_CONFIG.websiteUrl}</a></p>
              <p><strong>Support Email:</strong>{' '}
                <a href={`mailto:${BUSINESS_CONFIG.supportEmail}`} className="text-amber-600 font-bold hover:underline">
                  {BUSINESS_CONFIG.supportEmail}
                </a>
              </p>
              <p><strong>Canteen phone:</strong>{' '}
                <a href={`tel:${BUSINESS_CONFIG.cancellationContactPhone}`} className="font-bold text-slate-800 hover:underline">
                  {BUSINESS_CONFIG.cancellationContactPhone}
                </a>
              </p>
              <p><strong>School Location:</strong> {formattedAddress}</p>
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
            <Link href="/delivery-policy" className="hover:underline">
              Shipping &amp; Delivery Policy
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
