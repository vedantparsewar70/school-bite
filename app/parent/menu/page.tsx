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
  Check,
  Plus,
  Minus,
  Sparkles,
  Info,
  CalendarDays,
  Flame,
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { useCart } from '@/components/CartContext';
import { useToast } from '@/components/ToastContext';
import VegBadge from '@/components/VegBadge';
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
  const [menus, setMenus] = useState<MenuDayItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Weekly view date range (next 5 school days: Monday to Friday)
  const [weeklyMenus, setWeeklyMenus] = useState<Record<string, MenuDayItem[]>>({});
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

  // Fetch Daily Menu
  useEffect(() => {
    async function fetchDailyMenu() {
      setLoading(true);
      try {
        const res = await fetch(`/api/menu?date=${selectedDate}`);
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
  }, [selectedDate, activeTab]);

  // Fetch Weekly Menu (5 days starting from selected date or today)
  useEffect(() => {
    async function fetchWeeklyMenu() {
      setWeeklyLoading(true);
      try {
        const startDate = getTodayString();
        const endDate = getOffsetDateString(6);
        const res = await fetch(`/api/menu?startDate=${startDate}&endDate=${endDate}`);
        if (res.ok) {
          const data = await res.json();
          const grouped: Record<string, MenuDayItem[]> = {};
          (data.menus || []).forEach((item: MenuDayItem) => {
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
  }, [activeTab]);

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

  const handleSelectMeal = (menuItem: MenuDayItem, date: string) => {
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

    // Check allergy warning
    if (selectedChild.allergies && menuItem.meal.allergens) {
      const childAllergy = selectedChild.allergies.toLowerCase();
      const mealAllergens = menuItem.meal.allergens.toLowerCase();
      if (
        (childAllergy.includes('peanut') && mealAllergens.includes('cashew')) ||
        (childAllergy.includes('lactose') && mealAllergens.includes('dairy'))
      ) {
        if (
          !confirm(
            `⚠️ ALLERGY ALERT: ${selectedChild.name} has restriction "${selectedChild.allergies}", and this meal contains "${menuItem.meal.allergens}". Do you still wish to proceed?`
          )
        ) {
          return;
        }
      }
    }

    addToCart({
      studentId: selectedChild.id,
      studentName: selectedChild.name,
      studentGrade: selectedChild.grade,
      studentDivision: selectedChild.division,
      mealId: menuItem.meal.id,
      mealName: menuItem.meal.name,
      mealPrice: menuItem.meal.price,
      mealImage: menuItem.meal.imageUrl,
      isVegetarian: menuItem.meal.isVegetarian,
      date,
      quantity: 1,
      orderingDeadline: menuItem.orderingDeadline,
    });

    showToast(`Added ${menuItem.meal.name} for ${selectedChild.name.split(' ')[0]} on ${formatDatePretty(date)}!`, 'success');
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
            Choose wholesome meals prepared fresh daily. Order individually for each child in your family.
          </p>
        </div>

        {/* Daily vs Weekly View Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'daily'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily Menu
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'weekly'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Weekly Menu Plan
          </button>
        </div>
      </div>

      {/* CRITICAL STEP 1: Child Selector Bar */}
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
              <span>No children registered yet.</span>
              <Link href="/parent/children" className="underline font-bold">
                Add Child
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {children.map((child) => {
                const isSelected = child.id === selectedChildId;
                return (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-102'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full overflow-hidden shrink-0 border ${
                        isSelected ? 'border-white' : 'border-slate-300'
                      }`}
                    >
                      <img
                        src={
                          child.profilePhoto ||
                          'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100&auto=format&fit=crop&q=80'
                        }
                        alt={child.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span>{child.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                        isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      Class {child.grade}-{child.division}
                    </span>
                    <VegBadge isVegetarian={child.isVegetarian} size="sm" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedChild && (
          <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <div>
              Currently selecting meals for:{' '}
              <strong className="text-slate-900 font-bold">{selectedChild.name}</strong> (Roll No:{' '}
              {selectedChild.rollNo}, Class {selectedChild.grade}-{selectedChild.division})
            </div>
            {selectedChild.allergies && (
              <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                Dietary Alert: {selectedChild.allergies}
              </span>
            )}
          </div>
        )}
      </div>

      {/* DAILY VIEW */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Date Selector Strip */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevDay}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleToday}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  selectedDate === getTodayString()
                    ? 'bg-amber-100 text-amber-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Today
              </button>
              <button
                onClick={handleNextDay}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-extrabold text-slate-900">
                {formatDatePretty(selectedDate)}
              </span>
              {selectedDate === getTodayString() && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                  TODAY
                </span>
              )}
            </div>

            {/* Date Input */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium hidden sm:inline">Jump to:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Meals Grid */}
          {loading ? (
            <div className="min-h-[30vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : menus.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 text-center space-y-3">
              <CalendarDays className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Meals Configured for {formatDatePretty(selectedDate)}</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                The canteen menu for this day has not been scheduled yet or it is a school holiday. Try selecting another date or check the weekly view.
              </p>
              <button
                onClick={handleToday}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-amber-600"
              >
                Go to Today's Menu
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menus.map((menuItem) => {
                const isPassed = isDeadlinePassed(selectedDate, menuItem.orderingDeadline);
                const isSoldOut = menuItem.availableQuantity <= 0;

                // Check how many of this item for this child are already in cart
                const cartQty = cartItems
                  .filter(
                    (ci) =>
                      ci.mealId === menuItem.meal.id &&
                      ci.date === selectedDate &&
                      ci.studentId === selectedChildId
                  )
                  .reduce((sum, ci) => sum + ci.quantity, 0);

                return (
                  <div
                    key={menuItem.id}
                    className={`bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between ${
                      isSoldOut || isPassed ? 'opacity-75' : ''
                    }`}
                  >
                    <div>
                      {/* Image Banner */}
                      <div className="relative h-48 overflow-hidden bg-slate-100">
                        <img
                          src={
                            menuItem.meal.imageUrl ||
                            'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80'
                          }
                          alt={menuItem.meal.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <VegBadge isVegetarian={menuItem.meal.isVegetarian} size="sm" showLabel={true} />
                        </div>

                        <div className="absolute bottom-3 left-3">
                          <span className="px-2.5 py-1 text-[11px] font-bold bg-black/60 text-white rounded-lg backdrop-blur-xs">
                            {menuItem.meal.category}
                          </span>
                        </div>

                        {menuItem.meal.calories && (
                          <span className="absolute bottom-3 right-3 px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-md flex items-center gap-1 shadow-xs">
                            <Flame className="w-3 h-3" />
                            {menuItem.meal.calories} kcal
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                            {menuItem.meal.name}
                          </h3>
                          <span className="text-xl font-black text-amber-700 shrink-0">
                            {formatINR(menuItem.meal.price)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {menuItem.meal.description}
                        </p>

                        {/* Ingredients & Allergens */}
                        <div className="space-y-1.5 pt-1 text-[11px]">
                          {menuItem.meal.ingredients && (
                            <p className="text-slate-500">
                              <strong className="text-slate-700">Ingredients:</strong> {menuItem.meal.ingredients}
                            </p>
                          )}
                          {menuItem.meal.allergens && (
                            <p className="text-amber-800 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-200">
                              <strong>Allergens:</strong> {menuItem.meal.allergens}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Order Bar */}
                    <div className="p-5 pt-0 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Order Cutoff: <strong>{menuItem.orderingDeadline} AM</strong>
                        </span>

                        <span
                          className={`font-bold text-[11px] ${
                            menuItem.availableQuantity <= 5 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {menuItem.availableQuantity > 0 ? `${menuItem.availableQuantity} portions left` : 'SOLD OUT'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleSelectMeal(menuItem, selectedDate)}
                        disabled={isSoldOut || isPassed || !selectedChild}
                        className={`w-full py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                          isSoldOut
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : isPassed
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25 hover:shadow-lg'
                        }`}
                      >
                        {isSoldOut ? (
                          <span>Sold Out</span>
                        ) : isPassed ? (
                          <span>Order Cutoff Passed</span>
                        ) : cartQty > 0 ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>In Cart ({cartQty}) • Add Another</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-4 h-4" />
                            <span>Select Meal for {selectedChild?.name.split(' ')[0] || 'Child'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* WEEKLY VIEW (Monday to Friday schedule) */}
      {activeTab === 'weekly' && (
        <div className="space-y-6">
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Plan upcoming lunches for the entire school week! You can pick meals for each day and checkout in one single transaction.
              </span>
            </div>
            <span className="font-bold text-slate-800">
              Recipient: {selectedChild?.name || 'Please select child above'}
            </span>
          </div>

          {weeklyLoading ? (
            <div className="min-h-[40vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {Object.keys(weeklyMenus).length === 0 ? (
                <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center text-xs text-slate-500">
                  No weekly menus currently published.
                </div>
              ) : (
                Object.entries(weeklyMenus).map(([dateStr, dayItems]) => (
                  <div key={dateStr} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                          {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base">{formatDatePretty(dateStr)}</h3>
                          <p className="text-[11px] text-slate-400">Cutoff: 08:30 AM</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                        {dayItems.length} Lunch Options
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dayItems.map((item) => {
                        const inCart = cartItems.some(
                          (c) => c.mealId === item.meal.id && c.date === dateStr && c.studentId === selectedChildId
                        );
                        return (
                          <div
                            key={item.id}
                            className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  item.meal.imageUrl ||
                                  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=100&auto=format&fit=crop&q=80'
                                }
                                alt={item.meal.name}
                                className="w-12 h-12 rounded-xl object-cover shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <VegBadge isVegetarian={item.meal.isVegetarian} size="sm" />
                                  <h4 className="font-bold text-slate-900 text-xs">{item.meal.name}</h4>
                                </div>
                                <p className="text-[11px] font-extrabold text-amber-700 mt-0.5">
                                  {formatINR(item.meal.price)}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleSelectMeal(item, dateStr)}
                              disabled={item.availableQuantity <= 0}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                inCart
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                              }`}
                            >
                              {inCart ? '✓ Added' : '+ Add'}
                            </button>
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
      )}

      {/* Floating Bottom Cart Bar (if items in cart) */}
      {cartItems.length > 0 && (
        <div className="sticky bottom-5 z-30 max-w-4xl mx-auto">
          <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl border border-slate-800 flex items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3 pl-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">
                  {cartItems.reduce((sum, i) => sum + i.quantity, 0)} meals in cart
                </p>
                <p className="text-[11px] text-slate-400">
                  Total:{' '}
                  <strong className="text-amber-400">
                    {formatINR(cartItems.reduce((acc, it) => acc + it.mealPrice * it.quantity, 0))}
                  </strong>
                </p>
              </div>
            </div>

            <Link
              href="/parent/cart"
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center gap-1.5"
            >
              <span>View Cart & Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center">Loading menu...</div>}>
      <MenuPageContent />
    </Suspense>
  );
}
