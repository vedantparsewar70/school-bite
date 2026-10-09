import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, CheckCircle2, ShieldAlert, Clock, CreditCard, Mail } from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress } from '@/lib/business-config';

export const metadata: Metadata = {
  title: 'Terms & Conditions | School-Bite - School Meal Pre-Ordering Platform',
  description:
    'Terms and Conditions for using School-Bite. Understand rules, advance meal pre-ordering guidelines, payment terms, and S.B. Patil School canteen fulfillment.',
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
              These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User&quot; or &quot;Parent&quot;) and <strong>{BUSINESS_CONFIG.legalEntityName}</strong> (operating the <strong>{BUSINESS_CONFIG.brandName}</strong> platform, Proprietor: <strong>{BUSINESS_CONFIG.proprietorName}</strong>, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
            </p>
            <p>
              School-Bite is operated by <strong>{BUSINESS_CONFIG.legalEntityName}</strong> (Proprietor: <strong>{BUSINESS_CONFIG.proprietorName}</strong>). By creating an account, browsing menus, or placing meal orders on our website ({BUSINESS_CONFIG.websiteUrl}), you acknowledge that you have read, understood, and agreed to be bound by these Terms, together with our Privacy Policy, Refund &amp; Cancellation Policy, and Shipping &amp; Delivery Policy.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>2. Description of School-Bite Service</span>
            </h2>
            <p>
              School-Bite is an online school meal pre-ordering platform designed to facilitate advance meal pre-orders for students attending <strong>{BUSINESS_CONFIG.schoolName}</strong> (Ravet, Pune).
            </p>
            <p>
              School-Bite allows parents to register their children, view published canteen menus for upcoming school days, select nutritious meal portions, and make cashless payments online. All meals are prepared and provided by the on-premise {BUSINESS_CONFIG.schoolName} canteen catering team.
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
                <strong>Eligibility:</strong> Parent accounts must be registered by an adult parent or legal guardian of a student enrolled at {BUSINESS_CONFIG.schoolName}.
              </li>
              <li>
                <strong>Credential Security:</strong> You are responsible for maintaining the confidentiality of your login email and password. Any actions taken through your authenticated account are your responsibility.
              </li>
              <li>
                <strong>Accuracy of Child Details:</strong> You agree to provide true, accurate, and up-to-date student information (child&apos;s full name, roll number, class/grade, and division). Neither School-Bite nor the school canteen staff can be held responsible for delayed or misdelivered meals resulting from incorrect student roll numbers, classes, or divisions provided by the user.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>4. Menu Availability & Pure Vegetarian Standard</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>100% Pure Vegetarian:</strong> All meals prepared and provided through School-Bite by the {BUSINESS_CONFIG.schoolName} canteen are strictly pure vegetarian.
              </li>
              <li>
                <strong>Pricing:</strong> All item prices are clearly displayed in Indian Rupees (INR) and are inclusive of all applicable taxes. There are no hidden surcharges.
              </li>
              <li>
                <strong>Daily Menu Publishing & Portion Quotas:</strong> Menus are published for upcoming school days. Portion quantities are limited by canteen kitchen preparation capacity. Once an item&apos;s portion quota is exhausted, it is marked as sold out and cannot be ordered.
              </li>
              <li>
                <strong>Kitchen Adjustments:</strong> The school canteen kitchen reserves the right to make minor ingredient adjustments based on daily fresh produce availability.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>5. Advance Pre-Order Model & Cutoff Deadlines</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>
                <strong>Pre-Order Requirement:</strong> School-Bite operates strictly on an advance pre-order model. Meals must be booked and paid for in advance so that the school canteen kitchen can procure fresh ingredients and prepare appropriate portioned batches.
              </li>
              <li>
                <strong>Daily Cutoff Time:</strong> Orders for a scheduled meal date must be placed and completed prior to the daily cutoff time (<strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong>). Once the cutoff time passes, ordering closes for that service date to permit fresh cooking and packaging.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>6. Online Payments & Order Confirmation</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              School-Bite supports 100% cashless advance payments.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>
                Payments may be made online using UPI (Google Pay, PhonePe, Paytm, BHIM, etc.), Debit/Credit Cards, or Net Banking.
              </li>
              <li>
                All payment transactions are processed securely through certified payment gateway partner (<strong>{BUSINESS_CONFIG.paymentGatewayPartner}</strong>).
              </li>
              <li>
                <strong>Order Confirmation:</strong> An order is officially confirmed only upon verified receipt of payment authorization from the payment gateway.
              </li>
              <li>
                <strong>Pre-Payment Review:</strong> Prior to payment, you will be presented with a clear order summary displaying your child&apos;s name, meal date, selected dishes, portion quantities, individual item prices, and the total payable amount.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>7. Food Fulfilment by S.B. Patil School Canteen</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Food is freshly prepared, packed, and provided by the on-premises canteen team of <strong>{BUSINESS_CONFIG.schoolName}</strong>.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              Meals are served to students during scheduled school lunch breaks. Depending on school distribution protocols, meals are either delivered to classrooms or collected by students at the designated canteen meal distribution counter upon stating their name, grade, and roll number.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>8. Cancellations & Refunds</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Due to the perishable nature of fresh culinary preparation, cancellations and refunds are governed strictly by our <Link href="/refund-policy" className="text-amber-600 font-bold hover:underline">Refund &amp; Cancellation Policy</Link>:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-600">
              <li>Cancellations are accepted prior to the daily cutoff time (<strong>{BUSINESS_CONFIG.cancellationCutoffTime}</strong>) for that meal date. Full refund is initiated to the original payment source.</li>
              <li>Cancellations cannot be processed once the cutoff time has passed and fresh kitchen cooking has commenced.</li>
              <li>Full refunds are automatically or promptly issued if the school canteen is unable to serve an ordered item or in the event of an unscheduled school closure.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>9. Customer Responsibilities</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>Parents are responsible for reminding their child to collect their meal during lunch break.</li>
              <li>Parents are responsible for reviewing ingredient and allergen tags before selecting items for children with specific dietary restrictions.</li>
              <li>Parents must ensure that their registered contact number and email are active for order notifications.</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>10. Service Availability & Limitation of Liability</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              We make every effort to maintain continuous website availability and accurate meal tracking. However, to the maximum extent permitted under applicable Indian law:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-600">
              <li>School-Bite shall not be liable for technical delays caused by telecom interruptions or third-party bank server downtimes during payment.</li>
              <li>Culinary preparation, food hygiene, and on-premise distribution are the direct operational responsibility of the {BUSINESS_CONFIG.schoolName} canteen.</li>
              <li>Our aggregate liability for any claim regarding an order is strictly limited to the amount paid for that specific order.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>11. Governing Law & Dispute Resolution</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              These Terms shall be governed by and interpreted in accordance with the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts in Pune, Maharashtra, India.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>12. Customer Support & Contact Information</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              For any questions, order assistance, or clarification regarding these Terms, please contact our support team:
            </p>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-2">
              <p><strong>Operating Business:</strong> {BUSINESS_CONFIG.legalEntityName}</p>
              <p><strong>Proprietor:</strong> {BUSINESS_CONFIG.proprietorName}</p>
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
