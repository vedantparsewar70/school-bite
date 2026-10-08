'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  AlertCircle,
  Plus,
  Minus,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { useCart } from '@/components/CartContext';
import { useToast } from '@/components/ToastContext';
import VegBadge from '@/components/VegBadge';
import ChildAvatar from '@/components/ChildAvatar';
import MealIcon from '@/components/MealIcon';
import MealCategoryBadge from '@/components/MealCategoryBadge';
import {
  formatINR,
  formatDatePretty,
  getOffsetDateString,
  isDeadlinePassed,
} from '@/lib/utils';
import { StudentData } from '@/types';

function MenuPageContent() {
  const searchParams = useSearchParams();
  const preselectedChildId = searchParams.get('childId');

  const { addToCart, updateQuantity, cartItems, totalItems, subtotal } = useCart();
  const { showToast } = useToast();

  // Strictly Next Day's Menu (Tomorrow's Meal)
  const tomorrowDate = getOffsetDateString(1);
  const [children, setChildren] = useState<StudentData[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch registered children
  useEffect(() => {
    async function loadChildren() {
      try {
        const res = await fetch('/api/parent/children');
        if (res.ok) {
          const data = await res.json();
          const list: StudentData[] = data.students || [];
          setChildren(list);
          if (list.length > 0) {
            if (preselectedChildId && list.some((c) => c.id === preselectedChildId)) {
              setSelectedChildId(preselectedChildId);
            } else {
              setSelectedChildId(list[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load children:', err);
      }
    }
    loadChildren();
  }, [preselectedChildId]);

  // Fetch Tomorrow's Menu evaluated against selected child
  useEffect(() => {
    async function fetchTomorrowMenu() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('date', tomorrowDate);
        if (selectedChildId) queryParams.append('childId', selectedChildId);

        const res = await fetch(`/api/menu?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setMenus(data.menus || []);
        }
      } catch (err) {
        console.error('Failed to fetch menu:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTomorrowMenu();
  }, [tomorrowDate, selectedChildId]);

  const selectedChild = children.find((c) => c.id === selectedChildId);

  const executeAddToCart = (menuItem: any, date: string, hasConflict: boolean, matchingAllergens: string[]) => {
    if (!selectedChild) return;

    addToCart({
      studentId: selectedChild.id,
      studentName: selectedChild.name,
      studentGrade: selectedChild.grade,
      studentDivision: selectedChild.division,
      mealId: menuItem.meal.id,
      mealName: menuItem.meal.name,
      mealPrice: menuItem.meal.price,
      mealCategory: menuItem.meal.category,
      mealImage: null,
      isVegetarian: menuItem.meal.isVegetarian,
      date,
      quantity: 1,
      orderingDeadline: menuItem.orderingDeadline,
      hasAllergyAlert: hasConflict,
      conflictAllergens: matchingAllergens,
    });

    showToast(
      `Added ${menuItem.meal.name} for ${selectedChild.name.split(' ')[0]}!`,
      hasConflict ? 'info' : 'success'
    );
  };

  const handleSelectMeal = (menuItem: any, date: string) => {
    if (!selectedChild) {
      showToast('Please select a child first', 'error');
      return;
    }

    if (menuItem.availableQuantity <= 0) {
      showToast('Sorry, this meal is sold out for tomorrow', 'error');
      return;
    }

    if (isDeadlinePassed(date, menuItem.orderingDeadline)) {
      showToast(`Ordering deadline (${menuItem.orderingDeadline}) for this meal has passed`, 'error');
      return;
    }

    executeAddToCart(menuItem, date, false, []);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white uppercase tracking-wider">
              Next Day&apos;s Meal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5 mt-1.5">
            <CalendarDays className="w-7 h-7 text-amber-500" />
            <span>Tomorrow&apos;s Lunch Menu</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Menu for <strong className="text-slate-800 font-bold">{formatDatePretty(tomorrowDate)}</strong> • Freshly prepared and delivered directly to the classroom.
          </p>
        </div>

        <Link
          href="/parent/orders"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <FileText className="w-4 h-4 text-amber-500" />
          <span>Order History</span>
        </Link>
      </div>

      {/* Child Selector Strip */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-200 p-4 sm:p-5 rounded-3xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              ORDER RECIPIENT
            </span>
            <h3 className="text-base font-extrabold text-slate-900">Which child is this meal for?</h3>
          </div>

          {children.length === 0 ? (
            <div className="text-xs text-rose-600 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>You have not registered any children yet.</span>
              <Link
                href="/parent/children"
                className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold"
              >
                Register Child
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              {children.map((child) => {
                const isSelected = selectedChildId === child.id;

                return (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-500/30'
                        : 'bg-white/70 border-slate-200 hover:bg-white text-slate-700'
                    }`}
                  >
                    <ChildAvatar size="sm" />
                    <div className="text-left">
                      <span className="text-xs font-extrabold text-slate-900 block">{child.name}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                        <span>Class {child.grade}-{child.division}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedChild && (
          <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">Current Student:</span>
              <span>{selectedChild.name} (Class {selectedChild.grade}-{selectedChild.division})</span>
            </div>
          </div>
        )}
      </div>

      {/* Next Day's Menu Grid */}
      <div className="space-y-6">
        {loading ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : menus.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3 max-w-md mx-auto">
            <Clock className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Meals Published For Tomorrow</h3>
            <p className="text-xs text-slate-500">
              The canteen kitchen is preparing tomorrow&apos;s menu. Please check back shortly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menus.map((menuItem) => {
              const isSoldOut = menuItem.availableQuantity <= 0;
              const deadlinePassed = isDeadlinePassed(tomorrowDate, menuItem.orderingDeadline);
              // Check if already in cart for this child for tomorrow
              const inCart = cartItems.find(
                (c) =>
                  c.mealId === menuItem.meal.id &&
                  c.date === tomorrowDate &&
                  c.studentId === selectedChildId
              );

              return (
                <div
                  key={menuItem.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-slate-300 transition-all space-y-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Illustrated Meal Graphic on Left + Category + Name + Price */}
                    <div className="flex items-start gap-4">
                      <MealIcon
                        name={menuItem.meal.name}
                        category={menuItem.meal.category}
                        size="lg"
                      />

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <MealCategoryBadge category={menuItem.meal.category} />
                          <VegBadge isVegetarian={menuItem.meal.isVegetarian} size="sm" />
                        </div>

                        <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                          {menuItem.meal.name}
                        </h3>

                        <p className="text-base font-black text-amber-700">
                          {formatINR(menuItem.meal.price)}
                        </p>

                        {menuItem.meal.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 pt-0.5">
                            {menuItem.meal.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Area: Availability Status & Order Button */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>AVAILABLE FOR TOMORROW</span>
                      </span>
                    </div>

                    {isSoldOut ? (
                      <button
                        disabled
                        className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed"
                      >
                        Sold Out
                      </button>
                    ) : deadlinePassed ? (
                      <button
                        disabled
                        className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed"
                      >
                        Deadline Passed ({menuItem.orderingDeadline})
                      </button>
                    ) : inCart ? (
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl p-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(inCart.cartItemId, inCart.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-amber-200 text-amber-900 font-bold hover:bg-amber-100 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-amber-900 px-3">
                          {inCart.quantity} in Cart
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (inCart.quantity >= menuItem.availableQuantity) {
                              showToast(`Only ${menuItem.availableQuantity} portions available`, 'error');
                              return;
                            }
                            updateQuantity(inCart.cartItemId, inCart.quantity + 1);
                          }}
                          className="w-8 h-8 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                          title="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelectMeal(menuItem, tomorrowDate)}
                        className="w-full py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/20"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add to Lunch Cart</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Mobile Floating Order Summary Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-amber-200 p-3 sm:p-4 shadow-2xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {totalItems} {totalItems === 1 ? 'Meal' : 'Meals'} Selected
              </span>
              <p className="text-base sm:text-xl font-black text-slate-900">
                {formatINR(subtotal)}
              </p>
            </div>
            <Link
              href="/parent/checkout"
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Order Summary & Pay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MenuPageContent />
    </Suspense>
  );
}
