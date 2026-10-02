'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShoppingCart,
  Users,
  AlertCircle,
  CheckCircle2,
  Plus,
  Minus,
  Sparkles,
  CalendarDays,
  Flame,
  Info,
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
  getTodayString,
  getOffsetDateString,
  isDeadlinePassed,
} from '@/lib/utils';
import { MenuDayItem, StudentData } from '@/types';

function MenuPageContent() {
  const searchParams = useSearchParams();
  const preselectedChildId = searchParams.get('childId');
  const preselectedDate = searchParams.get('date');

  const { user } = useAuth();
  const { addToCart, cartItems } = useCart();
  const { showToast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(preselectedDate || getTodayString());
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [children, setChildren] = useState<StudentData[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Weekly view date range (next 5 school days)
  const [weeklyMenus, setWeeklyMenus] = useState<Record<string, any[]>>({});
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // Fetch children
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

  // Fetch Daily Menu evaluated against selected child
  useEffect(() => {
    async function fetchDailyMenu() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('date', selectedDate);
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

    if (activeTab === 'daily') {
      fetchDailyMenu();
    }
  }, [selectedDate, selectedChildId, activeTab]);

  // Fetch Weekly Menu
  useEffect(() => {
    async function fetchWeeklyMenu() {
      setWeeklyLoading(true);
      try {
        const startDate = getTodayString();
        const endDate = getOffsetDateString(6);
        const queryParams = new URLSearchParams({ startDate, endDate });
        if (selectedChildId) queryParams.append('childId', selectedChildId);

        const res = await fetch(`/api/menu?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const grouped: Record<string, any[]> = {};
          (data.menus || []).forEach((item: any) => {
            if (!grouped[item.date]) grouped[item.date] = [];
            grouped[item.date].push(item);
          });
          setWeeklyMenus(grouped);
        }
      } catch (err) {
        console.error('Failed to fetch weekly menu:', err);
      } finally {
        setWeeklyLoading(false);
      }
    }

    if (activeTab === 'weekly') {
      fetchWeeklyMenu();
    }
  }, [selectedChildId, activeTab]);

  const selectedChild = children.find((c) => c.id === selectedChildId);

  const handlePrevDay = () => {
    const cur = new Date(selectedDate + 'T00:00:00');
    cur.setDate(cur.getDate() - 1);
    setSelectedDate(cur.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const cur = new Date(selectedDate + 'T00:00:00');
    cur.setDate(cur.getDate() + 1);
    setSelectedDate(cur.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(getTodayString());
  };

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
      `Added ${menuItem.meal.name} for ${selectedChild.name.split(' ')[0]} on ${formatDatePretty(date)}!`,
      hasConflict ? 'info' : 'success'
    );
  };

  const handleSelectMeal = (menuItem: any, date: string) => {
    if (!selectedChild) {
      showToast('Please select a child first', 'error');
      return;
    }

    if (menuItem.availableQuantity <= 0) {
      showToast('Sorry, this meal is sold out for this date', 'error');
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
      {/* Page Title & View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7 text-amber-500" />
            <span>School Lunch Menu</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Choose wholesome meals prepared fresh daily for your children.
          </p>
        </div>

        {/* Daily vs Weekly View Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily Menu
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'weekly'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Weekly Menu Plan
          </button>
        </div>
      </div>

      {/* STEP 1: Child Selector Bar (Generic Avatar - No Photos) */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-200 p-4 sm:p-5 rounded-3xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              STEP 1: SELECT RECIPIENT
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
                const allergies = child.allergiesList || (child.allergies ? child.allergies.split(/[,;]/).map((a) => a.trim()).filter(Boolean) : []);
                const hasAllergies = allergies.length > 0 && !allergies.includes('None');

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
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-900">{child.name}</span>
                        <VegBadge isVegetarian={child.isVegetarian} size="sm" />
                      </div>
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
              <span className="text-slate-400">•</span>
              <span>{selectedChild.isVegetarian ? 'Vegetarian' : 'Non-Vegetarian'}</span>
            </div>
          </div>
        )}
      </div>

      {/* DAILY VIEW */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Date Navigator Header */}
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevDay}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                <span className="text-base sm:text-lg font-black text-slate-900">
                  {formatDatePretty(selectedDate)}
                </span>
              </div>
              <button
                onClick={handleNextDay}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleToday}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Today
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* Meals Grid (Requirement 13: Clean Meal Card Structure with MealIcon) */}
          {loading ? (
            <div className="min-h-[40vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : menus.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3 max-w-md mx-auto">
              <Clock className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Meals Scheduled For This Date</h3>
              <p className="text-xs text-slate-500">
                The school kitchen has not published a menu for {formatDatePretty(selectedDate)}. Try choosing another date.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menus.map((menuItem) => {
                const isSoldOut = menuItem.availableQuantity <= 0;
                const deadlinePassed = isDeadlinePassed(selectedDate, menuItem.orderingDeadline);
                // Check if already in cart for this child on this date
                const inCart = cartItems.find(
                  (c) =>
                    c.mealId === menuItem.meal.id &&
                    c.date === selectedDate &&
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
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 line-clamp-2 mt-3 leading-relaxed">
                        {menuItem.meal.description}
                      </p>

                      {/* Ingredients Pills */}
                      <div className="mt-3 space-y-1 text-[11px]">
                        {menuItem.meal.ingredients && (
                          <p className="text-slate-500 truncate">
                            <strong className="text-slate-700">Ingredients:</strong> {menuItem.meal.ingredients}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Area: Availability Status & Order Button */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>AVAILABLE TODAY</span>
                        </span>
                        <span className="font-medium text-slate-400">
                          Cutoff: {menuItem.orderingDeadline}
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
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-2">
                          <span className="text-xs font-bold text-amber-900 px-2">
                            In Cart ({inCart.quantity})
                          </span>
                          <Link
                            href="/parent/cart"
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            View Cart
                          </Link>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectMeal(menuItem, selectedDate)}
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
      )}

      {/* WEEKLY VIEW */}
      {activeTab === 'weekly' && (
        <div className="space-y-8">
          {weeklyLoading ? (
            <div className="min-h-[40vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : Object.keys(weeklyMenus).length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3 max-w-md mx-auto">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Weekly Schedule Available</h3>
              <p className="text-xs text-slate-500">The upcoming week&apos;s meal schedule is being prepared by the canteen.</p>
            </div>
          ) : (
            Object.entries(weeklyMenus).map(([dateKey, dayItems]) => (
              <div key={dateKey} className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black text-slate-900">{formatDatePretty(dateKey)}</h3>
                  <span className="text-xs text-slate-400 font-semibold">({dayItems.length} meals available)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dayItems.map((menuItem) => {
                    const isSoldOut = menuItem.availableQuantity <= 0;
                    const deadlinePassed = isDeadlinePassed(dateKey, menuItem.orderingDeadline);

                    return (
                      <div
                        key={menuItem.id}
                        className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-lg transition-all space-y-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start gap-4">
                            <MealIcon
                              name={menuItem.meal.name}
                              category={menuItem.meal.category}
                              size="md"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <MealCategoryBadge category={menuItem.meal.category} />
                                <VegBadge isVegetarian={menuItem.meal.isVegetarian} size="sm" />
                              </div>
                              <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                                {menuItem.meal.name}
                              </h4>
                              <p className="text-sm font-black text-amber-700">{formatINR(menuItem.meal.price)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <button
                            disabled={isSoldOut || deadlinePassed}
                            onClick={() => handleSelectMeal(menuItem, dateKey)}
                            className="w-full py-2 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer bg-amber-500 hover:bg-amber-600 text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Order for {formatDatePretty(dateKey).split(',')[0]}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
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
