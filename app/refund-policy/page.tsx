import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  CreditCard,
  Mail,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy | School-Bite - School Meal Pre-Ordering Platform',
  description:
    'Read the Refund and Cancellation Policy of School-Bite for S.B. Patil School. Understand advance cutoff deadlines, eligible refund scenarios, payment reconciliation, and refund timelines.',
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
              <span>1. Overview & Operational Model</span>
            </h2>
            <p>
              At <strong>{BUSINESS_CONFIG.brandName}</strong>, we are committed to transparent and dependable service for parents and students of <strong>{BUSINESS_CONFIG.schoolName}</strong> (Ravet, Pune).
            </p>
            <p>
              Because school canteen meals are prepared fresh daily based on advance pre-orders, our cancellation and refund guidelines are structured around real kitchen workflows and preparation cutoffs.
            </p>
            <p>
              This policy explains what happens when payments fail, when orders can be cancelled, when refunds are issued, and how funds are returned to you.
            </p>
          </section>

          {/* Section 2: Order Cancellation Guidelines */}
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span>2. Order Cancellation Guidelines</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Before Daily Cutoff Time</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  You can cancel an order prior to the daily cutoff deadline (<strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong>) directly from your Order History page or by contacting support. A 100% full refund will be initiated back to your original payment method, and the canteen portion quota is restored.
                </p>
              </div>

              <div className="p-5 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>After Daily Cutoff Time</span>
                </div>
                <p className="text-xs text-rose-900 leading-relaxed">
                  Once the cutoff time has passed (after 08:30 AM on the meal date), the {BUSINESS_CONFIG.schoolName} canteen kitchen begins fresh ingredient prep and cooking. Consequently, orders cannot be cancelled, modified, or refunded once kitchen preparation has commenced.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: When Refunds Are Issued */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>3. Eligible Refund Scenarios</span>
            </h2>
            <p>A full refund will be promptly issued under the following conditions:</p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>Canteen Inability to Fulfill:</strong> If an ordered food item becomes unavailable due to unexpected ingredient shortages or kitchen equipment issues at the {BUSINESS_CONFIG.schoolName} canteen.
              </li>
              <li>
                <strong>Unscheduled School Closure:</strong> If {BUSINESS_CONFIG.schoolName} declares an unscheduled holiday, emergency closure, or unforeseen operational shut-down on the scheduled meal date.
              </li>
              <li>
                <strong>Technical Duplicate Deduction:</strong> If your bank account or UPI app was debited multiple times for a single order due to network latency.
              </li>
              <li>
                <strong>Payment Debited but Order Not Generated:</strong> If your payment was deducted by the bank/gateway but the order failed to generate on School-Bite due to a connectivity drop, the transaction is automatically reconciled and refunded.
              </li>
              <li>
                <strong>Timely Cancellation:</strong> Any order successfully cancelled prior to the designated cutoff deadline (08:30 AM on meal date).
              </li>
            </ul>
          </section>

          {/* Section 4: Non-Refundable Situations */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>4. Non-Refundable Situations</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>Student Absence without Timely Cancellation:</strong> If a student is absent on the meal date and the order was not cancelled before the 08:30 AM cutoff, a refund cannot be issued because the meal has already been prepared by the canteen.
              </li>
              <li>
                <strong>Failure to Collect Meal:</strong> If the student does not visit the canteen lunch counter during the scheduled break to receive their meal.
              </li>
              <li>
                <strong>Incorrect Student Information:</strong> If an incorrect roll number or class division was submitted by the parent, leading to confusion at the distribution counter.
              </li>
            </ul>
          </section>

          {/* Section 5: Payment Failures & Gateway Scenarios */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>5. Failed, Cancelled & Interrupted Payments</span>
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-slate-600">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900">A. Payment Fails During Checkout</h3>
                <p>
                  If an online transaction fails during checkout (due to wrong UPI PIN, insufficient balance, or bank downtime), no order is created on School-Bite. If funds are temporarily held or debited by your bank, they are reversed automatically by your issuing bank within 24 to 48 hours according to Reserve Bank of India (RBI) guidelines.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900">B. Payment is Cancelled by User</h3>
                <p>
                  If you cancel or exit the payment window before completing authorization, no transaction occurs and no order is booked.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900">C. Payment Succeeds but Order is Not Created</h3>
                <p>
                  If money is debited from your account but a network disconnection prevents the confirmation callback from reaching School-Bite, our backend reconciliation process identifies the orphan transaction via {BUSINESS_CONFIG.paymentGatewayPartner} and initiates a full automatic refund back to the source account.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: How Refunds Are Processed & Timeline */}
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-500" />
              <span>6. Refund Method & Processing Timeline</span>
            </h2>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs sm:text-sm text-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900">Destination Account</span>
                <span className="text-slate-600">Credited back directly to the original payment source (UPI ID, Debit/Credit Card, or Bank Account).</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900">Payment Gateway Partner</span>
                <span className="text-slate-600">{BUSINESS_CONFIG.paymentGatewayPartner}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-slate-900">Expected Processing Timeline</span>
                <span className="font-extrabold text-amber-700">{BUSINESS_CONFIG.refundProcessingDays} (subject to issuing bank clearing cycles)</span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Note: UPI refunds are frequently processed instantly or within 24–48 hours, while card and net banking transactions typically reflect within {BUSINESS_CONFIG.refundProcessingDays} based on inter-bank settlement schedules.
            </p>
          </section>

          {/* Section 7: How to Request Assistance */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>7. How to Contact Support for Cancellation or Refund</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              To request assistance regarding a cancellation before cutoff or report a payment discrepancy, please contact our support team with:
            </p>

            <ol className="list-decimal pl-5 space-y-1 text-xs sm:text-sm text-slate-600 font-medium">
              <li>Your registered Parent Email and Phone Number.</li>
              <li>Order ID (e.g. ORD-2026-XXXXX).</li>
              <li>Child / Student Name and Class/Division.</li>
              <li>Brief description of the request (e.g. cancellation before cutoff, duplicate deduction).</li>
            </ol>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-2 mt-3">
              <p><strong>Support Email:</strong>{' '}
                <a href={`mailto:${BUSINESS_CONFIG.supportEmail}`} className="text-amber-600 font-bold hover:underline">
                  {BUSINESS_CONFIG.supportEmail}
                </a>
              </p>
              <p><strong>Support Phone:</strong>{' '}
                <a href={`tel:${BUSINESS_CONFIG.supportPhone.replace(/\s+/g, '')}`} className="font-bold text-slate-800 hover:underline">
                  {BUSINESS_CONFIG.supportPhone}
                </a>
              </p>
              <p><strong>WhatsApp Support:</strong> {BUSINESS_CONFIG.whatsAppSupport} ({BUSINESS_CONFIG.supportPhone})</p>
              <p><strong>Support Availability:</strong> {BUSINESS_CONFIG.supportAvailability}</p>
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
              Terms & Conditions
            </Link>
            <Link href="/privacy-policy" className="hover:underline">
              Privacy Policy
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
