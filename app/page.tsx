'use client';

import React from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  ShieldCheck,
  Calendar,
  CreditCard,
  ChefHat,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Heart,
  Sparkles,
  PhoneCall,
  HelpCircle,
  Award,
  Zap,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';

export default function LandingPage() {
  const sampleMeals = [
    {
      name: 'Paneer Rice Bowl',
      desc: 'Fresh paneer gravy, basmati rice, yellow dal & salad',
      price: '₹100',
      cal: '460 kcal',
      isVeg: true,
      image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Deluxe Veg Thali',
      desc: '2 Phulkas, Paneer butter masala, Dal, Jeera rice & Gulab Jamun',
      price: '₹120',
      cal: '620 kcal',
      isVeg: true,
      image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Creamy Garden Pasta',
      desc: 'Durum wheat pasta, broccoli, sweet corn, garlic toast',
      price: '₹95',
      cal: '480 kcal',
      isVeg: true,
      image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281788?w=500&auto=format&fit=crop&q=80',
    },
    {
      name: 'Rajma Chawal Bowl',
      desc: 'Slow-cooked Punjabi rajma, jeera rice & pickled onion',
      price: '₹90',
      cal: '410 kcal',
      isVeg: true,
      image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/70 via-white to-slate-50 py-16 sm:py-24 border-b border-amber-100">
        <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/80 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>India's Smart School Canteen Meal Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                School Meals <br />
                <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 bg-clip-text text-transparent">
                  Made Simple & Healthy
                </span>
              </h1>

              <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
                Choose healthy meals for your children, order in advance, and manage school canteen payments from one place. Designed specifically for Indian schools with UPI payments and allergy tracking.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                <Link
                  href="/login"
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600 hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                >
                  Parent Login
                </Link>
                <Link
                  href="/register"
                  className="px-6 py-3.5 rounded-2xl bg-white border border-slate-300 text-slate-800 font-bold text-sm sm:text-base hover:bg-slate-50 hover:border-amber-400 transition-all"
                >
                  Register Account
                </Link>
                <Link
                  href="/login?role=admin"
                  className="px-5 py-3.5 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 font-bold text-sm hover:bg-purple-100 transition-all flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Login
                </Link>
              </div>

              {/* Demo Credentials Quick Note */}
              <div className="pt-4 p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-semibold text-amber-900">Demo Credentials Available:</span>
                  <span>Parent: <code className="bg-white px-1.5 py-0.5 rounded text-amber-800 font-bold">parent@example.com</code> / <code className="bg-white px-1.5 py-0.5 rounded text-amber-800">Parent123</code></span>
                </div>
                <Link
                  href="/login"
                  className="shrink-0 text-amber-700 font-bold hover:underline flex items-center gap-1"
                >
                  One-Click Login <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Right Hero Visual Card */}
            <div className="lg:col-span-5 relative">
              <div className="bg-white rounded-3xl p-6 shadow-2xl border border-amber-100 relative z-10 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                      AS
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Aarav Sharma</p>
                      <p className="text-[11px] text-slate-500">Class 5-A • Roll No. 12</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                    Active Student
                  </span>
                </div>

                {/* Sample Meal Card in Hero */}
                <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50/50">
                  <img
                    src="https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80"
                    alt="Paneer Rice Bowl"
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <VegBadge isVegetarian={true} />
                        <h4 className="font-bold text-slate-800 text-sm">Paneer Rice Bowl</h4>
                      </div>
                      <span className="font-bold text-amber-700">₹100</span>
                    </div>
                    <p className="text-xs text-slate-500">Tomato paneer gravy, basmati rice, dal & salad</p>
                    <div className="pt-2 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ordered for Monday
                      </span>
                      <span className="text-slate-400">Cutoff: 08:30 AM</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Parent Balance</p>
                    <p className="text-base font-extrabold text-amber-900">₹500.00</p>
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Dietary Alert</p>
                    <p className="text-xs font-bold text-emerald-900">Peanuts Free ✓</p>
                  </div>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-4 -left-4 bg-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-2 z-20">
                <ChefHat className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-bold text-slate-800">Freshly Prepared Daily in School</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <h2 className="text-xs uppercase font-extrabold text-amber-600 tracking-wider">Simple 4-Step Journey</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900">How NutriKids Works for Parents</h3>
            <p className="text-slate-600 text-sm sm:text-base">
              No more morning rush or forgotten tiffin boxes. Plan hygienic school meals for the entire week in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Add Your Children',
                desc: 'Register child profile with Class, Division, Roll No, and dietary restrictions or allergies.',
                icon: Users,
              },
              {
                step: '02',
                title: 'Browse Menu',
                desc: 'Explore chef-designed daily and weekly Indian lunch menus with clear ingredient lists and prices in ₹.',
                icon: Calendar,
              },
              {
                step: '03',
                title: 'Order & Pay',
                desc: 'Select different meals for multiple children and pay seamlessly using UPI, Cards, NetBanking or School Wallet.',
                icon: CreditCard,
              },
              {
                step: '04',
                title: 'Hot Lunch Served',
                desc: 'The school canteen prepares exact meal portions and serves students right on time during the lunch break.',
                icon: UtensilsCrossed,
              },
            ].map((step, idx) => (
              <div
                key={idx}
                className="relative bg-slate-50/70 p-6 rounded-3xl border border-slate-100 hover:border-amber-200 hover:shadow-lg transition-all"
              >
                <span className="text-3xl font-black text-amber-200/80 absolute top-4 right-4">
                  {step.step}
                </span>
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-4 shadow-md shadow-amber-500/20">
                  <step.icon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-lg mb-2">{step.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Indian School Meals */}
      <section className="py-20 bg-amber-50/40 border-y border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <h2 className="text-xs uppercase font-extrabold text-amber-600 tracking-wider">Nutritious & Delicious</h2>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-1">Sample School Lunch Menu</h3>
            </div>
            <Link
              href="/login"
              className="text-amber-700 font-bold text-sm hover:underline mt-4 md:mt-0 flex items-center gap-1"
            >
              View Full 7-Day Menu <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sampleMeals.map((meal, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col"
              >
                <div className="relative h-44 overflow-hidden">
                  <img src={meal.image} alt={meal.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  <div className="absolute top-3 left-3">
                    <VegBadge isVegetarian={meal.isVeg} size="sm" showLabel={true} />
                  </div>
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 text-[10px] font-bold bg-black/60 text-white rounded-md backdrop-blur-xs">
                    {meal.cal}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{meal.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{meal.desc}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-lg font-extrabold text-amber-700">{meal.price}</span>
                    <Link
                      href="/login"
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors"
                    >
                      Order Now
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Parents & For Schools Dual Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* For Parents */}
            <div id="for-parents" className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-8 sm:p-10 rounded-3xl border border-amber-100 space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900">Why Parents Love NutriKids</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Parents get complete transparency on what their children eat at school, with verified nutrition profiles and zero cash handling for students.
              </p>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Multi-Child Support:</strong> Order different meals for siblings in one checkout.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Allergy Safety:</strong> Flag allergies (peanuts, dairy, gluten) visible to kitchen staff.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Order Tracking:</strong> Live status from Preparing to Ready and Collected.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Hassle-free Cancellation:</strong> Cancel orders before cutoff with instant wallet refund.</span>
                </li>
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors"
              >
                Create Parent Account <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* For Schools */}
            <div id="for-schools" className="bg-gradient-to-br from-purple-50 to-slate-50 p-8 sm:p-10 rounded-3xl border border-purple-100 space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900">Why Canteen Admins & Staff Rely on Us</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Streamline school kitchen operations, eliminate food wastage, and know exact headcounts before cooking starts.
              </p>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Dedicated Kitchen Display:</strong> Simple, tablet-ready view showing aggregated dish counts.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Classroom Distribution Sheets:</strong> Print or export lists grouped by Class & Division.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Automated Cutoffs:</strong> Configurable ordering deadlines (e.g., 08:30 AM).</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Sales & Revenue Analytics:</strong> Export daily, weekly, and monthly audit reports to CSV.</span>
                </li>
              </ul>
              <Link
                href="/login?role=admin"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-700 text-white font-bold text-sm hover:bg-purple-800 transition-colors"
              >
                Access Admin Portal <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-xs uppercase font-extrabold text-amber-600 tracking-wider">Frequently Asked Questions</h2>
            <h3 className="text-3xl font-extrabold text-slate-900">Got Questions? We Have Answers</h3>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'How does the ordering deadline work?',
                a: 'Each meal date has an ordering deadline set by the school admin (typically 08:30 AM on the day of the meal). Orders must be placed before this cutoff so the kitchen can prep the exact required portions.',
              },
              {
                q: 'Can I order different meals for my two children in one transaction?',
                a: 'Yes! You can select child Aarav, add his meal for Monday, switch to child Anaya, select her meal, and check out both children together in a single cart.',
              },
              {
                q: 'What happens if I need to cancel a meal?',
                a: 'You can easily cancel an order from your Orders tab as long as the cancellation cutoff deadline has not passed. The entire amount is immediately refunded back to your Parent Meal Wallet.',
              },
              {
                q: 'What payment modes are supported?',
                a: 'The system simulates real Indian payment options including UPI (Google Pay, PhonePe, Paytm), Credit & Debit cards, Net Banking, and School Meal Wallet.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  {faq.q}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold">Ready to modernize your school canteen?</h2>
          <p className="text-amber-100 text-sm sm:text-base max-w-xl mx-auto">
            Experience the complete user journey now with preloaded demo parents, children, and 7+ days of delicious Indian meals.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="px-6 py-3 rounded-2xl bg-white text-amber-800 font-bold hover:bg-amber-50 shadow-lg transition-all"
            >
              Sign In With Demo Parent
            </Link>
            <Link
              href="/login?role=admin"
              className="px-6 py-3 rounded-2xl bg-amber-900/60 border border-white/20 text-white font-bold hover:bg-amber-900/80 transition-all"
            >
              Sign In With Demo Admin
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
