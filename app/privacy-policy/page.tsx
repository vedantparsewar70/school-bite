import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Lock, Database, CreditCard, UserCheck, EyeOff, FileText, Mail, MapPin, Phone } from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'Privacy Policy | School-Bite - School Meal Pre-Ordering Platform',
  description:
    'Read the Privacy Policy of School-Bite. Learn how we handle parent and student data, order records, database storage, and secure payment processing for S.B. Patil School.',
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
            <span>Applies to: Parents, Students, and School Canteen Users</span>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs space-y-8 text-sm sm:text-base text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>1. Introduction & Overview</span>
            </h2>
            <p>
              Welcome to <strong>{BUSINESS_CONFIG.brandName}</strong> ({BUSINESS_CONFIG.websiteUrl}).
              School-Bite is an online school meal pre-ordering platform that allows parents to select nutritious meals for their children attending <strong>{BUSINESS_CONFIG.schoolName}</strong> (Ravet, Pune) and complete secure online payments.
            </p>
            <p>
              The food is prepared and provided directly by the {BUSINESS_CONFIG.schoolName} canteen. School-Bite is operated by the website operator. We are committed to respecting and protecting the privacy of parents, students, and users of our school pre-ordering service.
            </p>
            <p>
              This Privacy Policy explains what personal information we collect, why it is required, how it is stored and processed, and how you can contact us regarding your data.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>2. Information We Collect</span>
            </h2>
            <p>
              School-Bite collects only the information strictly necessary to register your parent account, associate your children, process advance meal orders, verify payments, and enable canteen fulfillment:
            </p>

            <div className="space-y-3 pt-1">
              {/* Parent account */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>A. Parent Account & Contact Information</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  When you create a parent account, we collect your full name, email address, phone number, and a cryptographically hashed password. We use this to authenticate your sessions, maintain your account, communicate order confirmations, and assist you via customer support.
                </p>
              </div>

              {/* Student info */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>B. Child / Student Information</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  To ensure meals are prepared and handed to the correct student at the school canteen, parents register their child&apos;s details: student name, grade/class, division/section, roll number, and optional dietary or food allergy preferences. This information is strictly used by kitchen staff to portion, pack, and distribute meals accurately to students.
                </p>
              </div>

              {/* Order info */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>C. Order & Payment Information</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  When an order is placed, we record the selected food items, portion quantities, order date, order reference ID, total amount, and payment status.
                </p>
                <p className="text-xs text-slate-600 font-medium pt-1">
                  <strong>Payment Security Note:</strong> Sensitive payment credentials — such as complete credit/debit card numbers, CVV codes, card PINs, UPI MPINs, and Net Banking passwords — are <strong>NEVER</strong> collected, stored, or processed on School-Bite servers. Online transactions are handled directly through our certified, PCI-DSS compliant payment gateway partner (<strong>{BUSINESS_CONFIG.paymentGatewayPartner}</strong>). School-Bite only receives payment gateway transaction reference numbers and payment authorization status.
                </p>
              </div>

              {/* Customer support */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-600" />
                  <span>D. Customer Support Inquiries</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  When you contact our support desk via email, phone, WhatsApp, or through the contact form, we maintain your message details, email address, phone number, and any associated Order ID so that our support team can assist you with your order, payment, or cancellation query.
                </p>
              </div>

              {/* Cookies / Storage */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-600" />
                  <span>E. Session & Local Storage</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  We utilize secure browser session tokens and local storage solely to keep you signed in to the parent portal and retain active items in your meal cart while you navigate the site. We do not use third-party advertising cookies or cross-site tracking mechanisms.
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
            <p>The information collected is used solely for genuine service purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>To allow the {BUSINESS_CONFIG.schoolName} canteen staff to prepare precise meal quantities and distribute them to students during scheduled school lunch breaks.</li>
              <li>To verify online payments through {BUSINESS_CONFIG.paymentGatewayPartner} and generate verified order receipts.</li>
              <li>To inform the school canteen kitchen of any dietary notes or allergy alerts specified for your child.</li>
              <li>To handle order cancellations submitted prior to the daily cutoff time and facilitate eligible refunds.</li>
              <li>To provide customer support and respond to parental inquiries regarding accounts or orders.</li>
              <li>To maintain orderly transaction and order records in compliance with applicable Indian legal and accounting standards.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>4. Database Infrastructure & Security Measures</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              School-Bite stores application data using secure cloud database infrastructure (Google Cloud Firestore / Firebase / PostgreSQL) hosted in secure data centers.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li><strong>Encryption in Transit:</strong> All communication between your device and School-Bite is encrypted using industry-standard Transport Layer Security (TLS/HTTPS).</li>
              <li><strong>Cryptographic Password Protection:</strong> Account passwords are never stored in plain text; they are hashed using secure one-way salted hashing algorithms.</li>
              <li><strong>Restricted Access:</strong> Access to order rosters and student lists is strictly restricted to authorized school canteen personnel and platform administrators.</li>
              <li><strong>No Secret Exposure:</strong> Payment gateway secret keys, database credentials, and API tokens are maintained securely in server-side environment variables and are never exposed to client browsers.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>5. Data Sharing & Service Providers</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              We do <strong>NOT</strong> sell, rent, monetize, or disclose your personal data or student records to any third-party marketing agencies or data brokers. Data is shared exclusively with:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>{BUSINESS_CONFIG.schoolName} Canteen Catering Staff:</strong> To view the daily preparation roster and distribute meals to the correct students during lunch breaks.
              </li>
              <li>
                <strong>Payment Gateway Partner ({BUSINESS_CONFIG.paymentGatewayPartner}):</strong> To authorize and process cashless transactions securely via UPI, cards, and net banking.
              </li>
              <li>
                <strong>Law Enforcement / Regulatory Authorities:</strong> Only when strictly required by applicable Indian laws, judicial orders, or governmental directives.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>6. Data Retention & User Rights</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Parent account details and child profiles are retained as long as your account remains active. Order records and transaction histories are retained in accordance with statutory accounting and record-keeping requirements in India.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              Parents have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-600">
              <li>View and update child details, class, division, roll number, and dietary notes anytime via the parent portal.</li>
              <li>Review past orders and payment receipts in the order history section.</li>
              <li>Request correction or deletion of personal data by contacting our support desk.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>7. Privacy Inquiries & Contact Details</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              If you have any questions, feedback, or concerns regarding this Privacy Policy or how your information is handled, please contact our support desk:
            </p>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-2">
              <p><strong>Service:</strong> {BUSINESS_CONFIG.brandName}</p>
              <p><strong>Operating School:</strong> {BUSINESS_CONFIG.schoolName}</p>
              <p>
                <strong>Support Email:</strong>{' '}
                <a href={`mailto:${BUSINESS_CONFIG.supportEmail}`} className="text-amber-600 font-bold hover:underline">
                  {BUSINESS_CONFIG.supportEmail}
                </a>
              </p>
              <p>
                <strong>Support Phone:</strong>{' '}
                <a href={`tel:${BUSINESS_CONFIG.supportPhone.replace(/\s+/g, '')}`} className="font-bold text-slate-800 hover:underline">
                  {BUSINESS_CONFIG.supportPhone}
                </a>
              </p>
              <p><strong>WhatsApp Support:</strong> {BUSINESS_CONFIG.whatsAppSupport} ({BUSINESS_CONFIG.supportPhone})</p>
              <p><strong>Support Availability:</strong> {BUSINESS_CONFIG.supportAvailability}</p>
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
              Terms & Conditions
            </Link>
            <Link href="/refund-policy" className="hover:underline">
              Refund & Cancellation Policy
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
