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
  ShoppingCart,
  Search,
  X,
  Utensils,
  Coffee,
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { useCart } from '@/components/CartContext';
import { useToast } from '@/components/ToastContext';
import { useChildren } from '@/components/ChildrenContext';
import { useSyncWatcher } from '@/lib/client-sync';
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
  const {
    children,
    isLoading: childrenLoading,
    selectedChildId,
    setSelectedChildId,
    selectedChild,
  } = useChildren();

  // Strictly Next Day's Menu (Tomorrow's Meal)
  const tomorrowDate = getOffsetDateString(1);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Category Filter states
  // Exactly two primary categories: 'LUNCH' and 'BREAKFAST'
  const [selectedCategory, setSelectedCategory] = useState<'LUNCH' | 'BREAKFAST'>('LUNCH');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle URL preselectedChildId
  useEffect(() => {
    if (preselectedChildId && children.some((c) => c.id === preselectedChildId)) {
      setSelectedChildId(preselectedChildId);
    }
  }, [preselectedChildId, children, setSelectedChildId]);

  // Fetch Tomorrow's Menu evaluated against selected child (single optimized request)
  const fetchTomorrowMenu = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('date', tomorrowDate);
      if (selectedChildId) queryParams.append('childId', selectedChildId);

      const res = await fetch(`/api/menu?${queryParams.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const loadedMenus = data.menus || [];
        setMenus(loadedMenus);

        // If no lunch meals but breakfast meals exist, auto-select breakfast
        const hasLunch = loadedMenus.some((m: any) => (m.meal?.category || '').toUpperCase().trim() === 'LUNCH');
        const hasBreakfast = loadedMenus.some((m: any) => {
          const cat = (m.meal?.category || '').toUpperCase().trim();
          return cat === 'BREAKFAST' || cat === 'SNACK';
        });

        if (!hasLunch && hasBreakfast) {
          setSelectedCategory((prev) => (prev === 'LUNCH' ? 'BREAKFAST' : prev));
        }
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    // Wait if children are in cold initial loading so we don't fire an unnecessary empty child query
    if (childrenLoading && !selectedChildId) return;
    fetchTomorrowMenu();
  }, [tomorrowDate, selectedChildId, childrenLoading]);

  // Real-time synchronization: update menu directly when staff saves or edits menu
  useSyncWatcher({
    onMenuUpdate: () => {
      fetchTomorrowMenu(true);
    },
  });

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

  // Category counts
  // Lunch matches 'LUNCH'
  // Breakfast matches 'BREAKFAST' as well as morning recess 'SNACK' items
  const lunchCount = menus.filter((m) => (m.meal?.category || '').toUpperCase().trim() === 'LUNCH').length;
  const breakfastCount = menus.filter((m) => {
    const cat = (m.meal?.category || '').toUpperCase().trim();
    return cat === 'BREAKFAST' || cat === 'SNACK';
  }).length;

  // Filter menus based on selected category and search query
  const filteredMenus = menus.filter((menuItem) => {
    const mealCategory = (menuItem.meal?.category || 'LUNCH').toUpperCase().trim();
    const mealName = (menuItem.meal?.name || '').toLowerCase();

    // 1. Strict Category Matching
    let matchesCategory = false;
    if (selectedCategory === 'LUNCH') {
      matchesCategory = mealCategory === 'LUNCH';
    } else if (selectedCategory === 'BREAKFAST') {
      matchesCategory = mealCategory === 'BREAKFAST' || mealCategory === 'SNACK';
    }

    if (!matchesCategory) return false;

    // 2. Search Query Matching within selected category
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return mealName.includes(q);
    }

    return true;
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className={`max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-4 sm:space-y-6 ${totalItems > 0 ? 'pb-36 sm:pb-40 md:pb-28' : 'pb-20'}`}>
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-amber-500 text-white uppercase tracking-wider">
              Next Day&apos;s Meal
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0" />
            <span>Tomorrow&apos;s Menu</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Menu for <strong className="text-slate-800 font-bold">{formatDatePretty(tomorrowDate)}</strong> • Freshly prepared at school canteen.
          </p>
        </div>

        <Link
          href="/parent/orders"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold shadow-2xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-amber-500" />
          <span>Order History</span>
        </Link>
      </div>

      {/* Child Selector Strip */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-200 p-3 sm:p-4 rounded-2xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              ORDER RECIPIENT
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">Which child is this meal for?</h3>
          </div>

          {childrenLoading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="h-8 w-28 bg-amber-200/50 rounded-xl animate-pulse" />
              <div className="h-8 w-28 bg-amber-200/30 rounded-xl animate-pulse" />
            </div>
          ) : children.length === 0 ? (
            <div className="text-xs text-rose-600 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>You have not registered any children yet.</span>
              <Link
                href="/parent/children"
                className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold"
              >
                Register Child
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {children.map((child) => {
                const isSelected = selectedChildId === child.id;

                return (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-amber-500 shadow-xs ring-2 ring-amber-500/30'
                        : 'bg-white/80 border-slate-200 hover:bg-white text-slate-700'
                    }`}
                  >
                    <ChildAvatar size="sm" />
                    <div className="text-left">
                      <span className="text-xs font-bold text-slate-900 block leading-tight">{child.name}</span>
                      <span className="text-[10px] text-slate-500 font-medium">Class {child.grade}-{child.division}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedChild && (
          <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-slate-600">
            <div>
              <span className="font-semibold text-slate-700">Ordering for: </span>
              <strong className="text-slate-900">{selectedChild.name}</strong> (Class {selectedChild.grade}-{selectedChild.division})
            </div>
          </div>
        )}
      </div>

      {/* Search Bar & Exactly Two Primary Category Filters */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Search Bar with dedicated Search button and clear trigger */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedCategory === 'LUNCH' ? 'lunch' : 'breakfast'} meals by name...`}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 transition-all font-medium placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </form>

        {/* Exactly Two Category Filters: Lunch and Breakfast */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setSelectedCategory('LUNCH')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedCategory === 'LUNCH'
                ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200/60 ring-2 ring-emerald-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Utensils className={`w-3.5 h-3.5 ${selectedCategory === 'LUNCH' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>Lunch</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedCategory === 'LUNCH' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {lunchCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('BREAKFAST')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedCategory === 'BREAKFAST'
                ? 'bg-white text-amber-800 shadow-xs border border-amber-200/60 ring-2 ring-amber-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Coffee className={`w-3.5 h-3.5 ${selectedCategory === 'BREAKFAST' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Breakfast</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedCategory === 'BREAKFAST' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {breakfastCount}
            </span>
          </button>
        </div>
      </div>

      {/* Next Day's Menu Grid (Compact 2-column mobile, 3-column tablet, 4-column desktop) */}
      <div className="space-y-4">
        {loading ? (
          <div className="min-h-[35vh] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : menus.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center space-y-3 max-w-md mx-auto">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Meals Published For Tomorrow</h3>
            <p className="text-xs text-slate-500">
              The canteen kitchen is preparing tomorrow&apos;s menu. Please check back shortly.
            </p>
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3 max-w-md mx-auto">
            <Search className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">No Meals Found</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {searchQuery
                ? `No ${selectedCategory.toLowerCase()} meals match "${searchQuery}".`
                : `No meals currently published under ${selectedCategory.toLowerCase()} for tomorrow.`}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'LUNCH' ? 'BREAKFAST' : 'LUNCH')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                View {selectedCategory === 'LUNCH' ? 'Breakfast' : 'Lunch'} Menu
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {filteredMenus.map((menuItem) => {
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
                  className="bg-white rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between h-full group"
                >
                  <div className="space-y-1.5 sm:space-y-2">
                    {/* Top Row: Category badge & Veg badge */}
                    <div className="flex items-center justify-between gap-1">
                      <MealCategoryBadge category={menuItem.meal.category} size="sm" />
                      <VegBadge isVegetarian={menuItem.meal.isVegetarian} size="sm" />
                    </div>

                    {/* Meal Illustration + Name + Price (Descriptions removed entirely) */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3 pt-0.5">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center justify-center shrink-0 p-1 group-hover:scale-105 transition-transform">
                        <MealIcon
                          name={menuItem.meal.name}
                          category={menuItem.meal.category}
                          size="sm"
                        />
                      </div>

                      <div className="min-w-0 flex-1 w-full">
                        <h3
                          className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2"
                          title={menuItem.meal.name}
                        >
                          {menuItem.meal.name}
                        </h3>

                        <p className="text-xs sm:text-base font-black text-amber-600 mt-0.5">
                          {formatINR(menuItem.meal.price)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Area: Compact Add button / Stepper */}
                  <div className="pt-2 sm:pt-2.5 mt-2 border-t border-slate-100">
                    {isSoldOut ? (
                      <button
                        disabled
                        className="w-full py-1.5 sm:py-2 bg-slate-100 text-slate-400 font-bold rounded-xl text-[10px] sm:text-xs cursor-not-allowed"
                      >
                        Sold Out
                      </button>
                    ) : deadlinePassed ? (
                      <button
                        disabled
                        className="w-full py-1.5 sm:py-2 bg-slate-100 text-slate-400 font-bold rounded-xl text-[10px] sm:text-xs cursor-not-allowed"
                      >
                        Closed
                      </button>
                    ) : inCart ? (
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl p-0.5 sm:p-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(inCart.cartItemId, inCart.quantity - 1)}
                          className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white border border-amber-200 text-amber-900 font-bold hover:bg-amber-100 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] sm:text-xs font-black text-amber-900 px-1 sm:px-2">
                          {inCart.quantity} in cart
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
                          className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                          title="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectMeal(menuItem, tomorrowDate)}
                        className="w-full py-1.5 sm:py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] text-white shadow-amber-500/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
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
        <div className="fixed bottom-[58px] md:bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-amber-200 px-3 py-2 sm:px-6 sm:py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.1)]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block leading-tight">
                  {totalItems} {totalItems === 1 ? 'Meal' : 'Meals'}
                </span>
                <p className="text-sm sm:text-lg font-black text-slate-900 leading-tight">
                  {formatINR(subtotal)}
                </p>
              </div>
            </div>

            <Link
              href="/parent/cart"
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/25 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>View Cart & Pay</span>
              <ArrowRight className="w-3.5 h-3.5" />
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
