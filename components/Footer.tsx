import React from 'react';
import Link from 'next/link';
import { UtensilsCrossed, ShieldCheck, Mail, Phone, MapPin, MessageCircle, Building2 } from 'lucide-react';
import { BUSINESS_CONFIG, getFormattedAddress, getLegalOperatorString } from '@/lib/business-config';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const formattedAddress = getFormattedAddress();
  const whatsappNumber = BUSINESS_CONFIG.supportPhone.replace(/\D/g, '');

  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Brand & Description (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                School<span className="text-amber-500">-Bite</span>
              </span>
            </Link>

            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              School meal pre-ordering made simple for parents.
            </p>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              School-Bite enables parents to pre-order fresh, hygienic meals for their children. Food is prepared and provided by the {BUSINESS_CONFIG.schoolName} canteen.
            </p>

            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Operating Business: {BUSINESS_CONFIG.legalEntityName}</span>
              </div>
              <p className="text-[11px] text-slate-400 pl-5.5">
                Proprietor: {BUSINESS_CONFIG.proprietorName}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>100% Pure Vegetarian</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-slate-300 border border-slate-800 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Secure Online Payments</span>
              </span>
            </div>
          </div>

          {/* Quick Links (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Quick Links</p>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/" className="hover:text-amber-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-amber-400 transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-amber-400 transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-amber-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="hover:text-amber-400 transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-amber-400 transition-colors">
                  Refund & Cancellation Policy
                </Link>
              </li>
              <li>
                <Link href="/delivery-policy" className="hover:text-amber-400 transition-colors">
                  Shipping & Delivery Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Contact (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Customer Support</p>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <Mail className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Email</span>
                  <a href={`mailto:${BUSINESS_CONFIG.supportEmail}`} className="hover:text-amber-400 break-all text-slate-300 font-medium">
                    {BUSINESS_CONFIG.supportEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Phone ({BUSINESS_CONFIG.supportAvailability})</span>
                  <a href={`tel:${BUSINESS_CONFIG.supportPhone.replace(/\s+/g, '')}`} className="hover:text-amber-400 text-slate-300 font-medium">
                    {BUSINESS_CONFIG.supportPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MessageCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">WhatsApp</span>
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-green-400 text-slate-300 font-medium"
                  >
                    WhatsApp Support Available
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Operating Location</span>
                  <span className="text-[11px] leading-relaxed text-slate-400">
                    {formattedAddress}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>
            © {currentYear} {BUSINESS_CONFIG.legalEntityName}. All rights reserved. Operated by {BUSINESS_CONFIG.legalEntityName} (Proprietor: {BUSINESS_CONFIG.proprietorName}) for {BUSINESS_CONFIG.schoolName} canteen meal orders.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="hover:text-slate-400 transition-colors">
              Home
            </Link>
            <span>•</span>
            <Link href="/contact" className="hover:text-slate-400 transition-colors">
              Contact Us
            </Link>
            <span>•</span>
            <Link href="/privacy-policy" className="hover:text-slate-400 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms-and-conditions" className="hover:text-slate-400 transition-colors">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link href="/refund-policy" className="hover:text-slate-400 transition-colors">
              Refund Policy
            </Link>
            <span>•</span>
            <Link href="/delivery-policy" className="hover:text-slate-400 transition-colors">
              Delivery Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
