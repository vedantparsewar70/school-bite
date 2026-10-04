'use client';

import React from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Utensils, QrCode } from 'lucide-react';
import { formatINR, formatDateTimePretty, formatDatePretty } from '@/lib/utils';
import VegBadge from './VegBadge';
import { BUSINESS_CONFIG } from '@/lib/business-config';

interface OrderReceiptModalProps {
  order: any;
  onClose: () => void;
}

export default function OrderReceiptModal({ order, onClose }: OrderReceiptModalProps) {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const primaryPayment = order.payments?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-100 print:shadow-none print:border-none print:max-h-none print:m-0 print:p-0">
        {/* Modal Controls - hidden in print */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Official Meal Voucher</span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
              PAID & CONFIRMED
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Content */}
        <div className="p-6 sm:p-8 space-y-6 print:p-0" id="receipt-printable">
          {/* Header */}
          <div className="text-center border-b border-dashed border-slate-200 pb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 text-white mb-2 shadow-md">
              <Utensils className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{BUSINESS_CONFIG.brandName.toUpperCase()}</h2>
            <p className="text-xs text-slate-500 font-medium">School Meal Pre-Ordering Service</p>
            <p className="text-[11px] text-slate-400">
              {BUSINESS_CONFIG.schoolName} Canteen • Ravet, Pune
            </p>
          </div>

          {/* Meta Details */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Order ID</p>
              <p className="font-mono font-bold text-slate-800 text-sm">{order.id}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Order Date & Time</p>
              <p className="font-medium text-slate-800">{formatDateTimePretty(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Payment Method</p>
              <p className="font-semibold text-slate-800">
                {primaryPayment?.paymentMethod || 'UPI'} • {primaryPayment?.transactionRef || 'TXN-CONFIRMED'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Payment Status</p>
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Successful
              </span>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Meal Order Details</p>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <VegBadge isVegetarian={item.isVegetarian !== false} size="sm" />
                      <span className="font-bold text-slate-800">{item.mealName}</span>
                      <span className="text-slate-400">× {item.quantity}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Student: <span className="font-semibold text-slate-700">{item.studentName}</span> (Class {item.studentGrade}-{item.studentDivision}, Roll: {item.studentRollNo})
                    </div>
                    <div className="text-[11px] text-amber-700 font-medium">
                      Date of Meal: {formatDatePretty(item.date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-sm">{formatINR(item.totalPrice)}</span>
                    <p className="text-[10px] text-slate-400">₹{item.unitPrice} each</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="space-y-1.5 text-xs border-t border-slate-200 pt-4">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatINR(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Taxes & Fees</span>
              <span className="text-emerald-600 font-medium">₹0</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-2">
              <span>Total Paid</span>
              <span className="text-amber-600">{formatINR(order.totalAmount)}</span>
            </div>
          </div>

          {/* Verification Token / Barcode Mock */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-900">Student Lunch Pickup Voucher</p>
              <p className="text-[11px] text-amber-800/80 leading-snug">
                Student needs to present their name/roll number or this token ID at the canteen lunch counter.
              </p>
              <p className="text-[11px] font-mono font-bold text-amber-950">TOKEN: {order.id.slice(-6)}</p>
            </div>
            <div className="w-16 h-16 bg-white border border-amber-300 rounded-xl flex flex-col items-center justify-center p-1 shrink-0 text-slate-800">
              <QrCode className="w-10 h-10 text-slate-800" />
              <span className="text-[8px] font-mono">SCAN</span>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200 pt-4">
            <p>Thank you for ordering with us.</p>
            <p className="mt-0.5">{BUSINESS_CONFIG.brandName} Canteen Portal • Generated automatically</p>
          </div>
        </div>
      </div>
    </div>
  );
}
