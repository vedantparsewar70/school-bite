import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Mail } from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'The terms for ordering S.B. Patil School canteen meals through School-Bite.',
};

export default function TermsAndConditionsPage() {
  const formattedAddress = getFormattedAddress();

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-bold text-amber-800">
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>Service Agreement</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Terms & Conditions
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium pt-1">
            <span>Service: <strong className="text-slate-700">{BUSINESS_CONFIG.brandName}</strong></span>
            <span>•</span>
            <span>Operating School: <strong className="text-slate-700">{BUSINESS_CONFIG.schoolName}</strong></span>
            <span>•</span>
            <span>Jurisdiction: India</span>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs space-y-8 text-sm sm:text-base text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>1. Introduction & Acceptance of Terms</span>
            </h2>
            <p>
              School-Bite ({BUSINESS_CONFIG.websiteUrl}) is operated by <strong>{BUSINESS_CONFIG.legalEntityName}</strong> (Registered Business / Trade Names: <strong>BRIGHT DESIGNERS / NEW BRIGHT XEROX / BRIGHT CATERING</strong>; Legal Proprietor: <strong>{BUSINESS_CONFIG.proprietorName}</strong>). By creating an account or placing an order you agree to these Terms and to our Privacy, Refund &amp; Cancellation, and Shipping &amp; Delivery policies.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>2. Description of School-Bite Service</span>
            </h2>
            <p>
              School-Bite is the meal pre-ordering website for the <strong>{BUSINESS_CONFIG.schoolName}</strong> canteen, Ravet, Pune. Parents register, add their children, choose meals from the published menu and pay online. Meals are prepared and handed over by the school canteen. Teachers can also order meals as guests.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>3. Parent Accounts & User Responsibilities</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>Eligibility:</strong> Accounts are for parents or guardians of {BUSINESS_CONFIG.schoolName} students.
              </li>
              <li>
                <strong>Password:</strong> Keep your password private. You are responsible for orders placed from your account.
              </li>
              <li>
                <strong>Child Details:</strong> Enter your child&apos;s details correctly. We are not responsible for problems caused by wrong details.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>4. Menu, Prices and Pure Vegetarian Standard</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>100% Pure Vegetarian:</strong> All meals prepared and provided through School-Bite by the {BUSINESS_CONFIG.schoolName} canteen are strictly pure vegetarian.
              </li>
              <li>
                <strong>Prices:</strong> Prices are shown in Indian Rupees (INR). You pay the price shown at checkout.
              </li>
              <li>
                <strong>Menus and Portions:</strong> Menus are published for upcoming school days. Items have limited portions and cannot be ordered once sold out.
              </li>
              <li>
                <strong>Allergies:</strong> Allergy information is entered by parents. The canteen cannot guarantee any meal is free of allergens.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>5. Ordering and Cutoff</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Ordering for a meal day closes at <strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong>.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>6. Payment</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Payment is made online through {BUSINESS_CONFIG.paymentGatewayPartner}. An order is confirmed only after the payment succeeds. You will see an order summary with the total before you pay.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>7. Meal Collection</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Meals are prepared by the {BUSINESS_CONFIG.schoolName} canteen and collected by the student at the canteen counter during the brunch break on the meal day. There is no home or classroom delivery.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>8. Cancellations & Refunds</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Cancellations and refunds follow our <Link href="/refund-policy" className="text-amber-600 font-bold hover:underline">Refund &amp; Cancellation Policy</Link>:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-600">
              <li>Orders cannot be cancelled online. Cancellations are only by contacting the canteen at <a href={`tel:${BUSINESS_CONFIG.cancellationContactPhone}`} className="font-bold hover:underline">{BUSINESS_CONFIG.cancellationContactPhone}</a>, prior to the daily cutoff time (<strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong>) for that meal date. Approved refunds go back to the original payment method.</li>
              <li>Orders cannot be cancelled after the cutoff.</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>9. Limitation of Liability</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              To the extent allowed by Indian law:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-600">
              <li>We are not responsible for delays caused by banks, payment networks or internet outages.</li>
              <li>Our liability for any order is limited to the amount paid for it.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>10. Governing Law</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              These Terms are governed by Indian law. Disputes are subject to the courts in Pune, Maharashtra.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>11. Contact</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Contact us:
            </p>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-2">
              <p><strong>Operating Business:</strong> {BUSINESS_CONFIG.legalEntityName}</p>
              <p><strong>Registered Business / Trade Names:</strong> BRIGHT DESIGNERS / NEW BRIGHT XEROX / BRIGHT CATERING</p>
              <p><strong>Legal Proprietor:</strong> {BUSINESS_CONFIG.proprietorName}</p>
              <p><strong>Platform Brand:</strong> {BUSINESS_CONFIG.brandName}</p>
              <p><strong>Official Website:</strong> <a href={BUSINESS_CONFIG.websiteUrl} className="text-amber-600 font-bold hover:underline">{BUSINESS_CONFIG.websiteUrl}</a></p>
              <p><strong>Operating School:</strong> {BUSINESS_CONFIG.schoolName}</p>
              <p>
                <strong>Support Email:</strong>{' '}
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
              <p><strong>Location:</strong> {formattedAddress}</p>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-slate-500">
          <Link href="/" className="font-bold text-amber-600 hover:underline">
            ← Back to Home
          </Link>
          <div className="flex flex-wrap gap-4 font-semibold text-slate-600">
            <Link href="/privacy-policy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link href="/refund-policy" className="hover:underline">
              Refund &amp; Cancellation Policy
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
