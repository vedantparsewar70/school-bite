import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Database, CreditCard, UserCheck, FileText, Mail } from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How School-Bite collects and uses parent, child and order information for the S.B. Patil School canteen.',
};

export default function PrivacyPolicyPage() {
  const formattedAddress = getFormattedAddress();

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-bold text-amber-800">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Trust & Data Protection</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Privacy Policy
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium pt-1">
            <span>Service: <strong className="text-slate-700">{BUSINESS_CONFIG.brandName}</strong></span>
            <span>•</span>
            <span>Operating School: <strong className="text-slate-700">{BUSINESS_CONFIG.schoolName}</strong></span>
            <span>•</span>
            <span>Applies to: Parents and teachers who order meals</span>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs space-y-8 text-sm sm:text-base text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>1. Who We Are</span>
            </h2>
            <p>
              <strong>{BUSINESS_CONFIG.brandName}</strong> ({BUSINESS_CONFIG.websiteUrl}) is the meal pre-ordering website for the <strong>{BUSINESS_CONFIG.schoolName}</strong> canteen, Ravet, Pune. Parents register, add their children, choose meals from the published menu and pay online through {BUSINESS_CONFIG.paymentGatewayPartner}.
            </p>
            <p>
              School-Bite is operated by <strong>{BUSINESS_CONFIG.legalEntityName}</strong> (Registered Business / Trade Names: <strong>BRIGHT DESIGNERS / NEW BRIGHT XEROX / BRIGHT CATERING</strong>; Legal Proprietor: <strong>{BUSINESS_CONFIG.proprietorName}</strong>).
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>2. Information We Collect</span>
            </h2>
            <p>
              We collect:
            </p>

            <div className="space-y-3 pt-1">
              {/* Parent account */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>A. Parent Account & Contact Information</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Parent account: your name, email address, mobile number and a hashed password (we never store your password itself). We use these to sign you in and to help you with your orders.
                </p>
              </div>

              {/* Student info */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>B. Child / Student Information</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Child details: name, date of birth, class/category, division, roll number and any allergies you enter. The canteen uses these to prepare the right meals and hand them to the right child.
                </p>
              </div>

              {/* Order info */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>C. Order & Payment Information</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Orders and payments: the meals ordered, meal date, amount, order ID and the {BUSINESS_CONFIG.paymentGatewayPartner} payment reference and status. Payments are processed by {BUSINESS_CONFIG.paymentGatewayPartner}. We do not see or store your card, UPI or bank details.
                </p>
              </div>

              {/* Cookies / Storage */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-600" />
                  <span>D. Cookies and Browser Storage</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  We use a login session cookie to keep you signed in, and a guest cookie so a teacher can view their order without an account. Your cart is saved in your browser. We do not use advertising or tracking cookies.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>3. How We Use Your Information</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              We use this information only to run your account, take and verify payments, prepare and hand over meals, process approved refunds and answer your questions.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>4. Security</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Data is stored with Google Cloud Firestore and sent over HTTPS. Only canteen staff and administrators can see order and student lists.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>5. Sharing</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              We do not sell your data. We share it only with the {BUSINESS_CONFIG.schoolName} canteen (to prepare and hand over meals), with {BUSINESS_CONFIG.paymentGatewayPartner} (to process payments), and with authorities when the law requires it.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>6. Data Retention & Your Choices</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              We keep your account while it is active, and keep order and payment records as the law requires.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              You can view and edit your children&apos;s details and see your past orders in your account. To correct or delete your data, contact us.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>7. Privacy Inquiries & Contact Details</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Questions about your data? Contact us:
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

        {/* Footer Navigation Back to Site */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-slate-500">
          <Link href="/" className="font-bold text-amber-600 hover:underline">
            ← Back to Home
          </Link>
          <div className="flex flex-wrap gap-4 font-semibold text-slate-600">
            <Link href="/terms-and-conditions" className="hover:underline">
              Terms &amp; Conditions
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
