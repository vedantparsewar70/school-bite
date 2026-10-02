'use client';

import React, { useEffect, useState } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
  Search,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Check,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import MealIcon from '@/components/MealIcon';
import MealCategoryBadge from '@/components/MealCategoryBadge';
import { formatINR, formatDatePretty, getTodayString, getOffsetDateString } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';
import { MealData, MenuDayItem } from '@/types';

const COMMON_ALLERGEN_TAGS = [
  'Milk',
  'Peanuts',
  'Egg',
  'Soy',
  'Wheat',
  'Tree Nuts',
  'Fish',
  'Shellfish',
  'Sesame',
];

export default function AdminMenuPage() {
  const { showToast } = useToast();

  const [meals, setMeals] = useState<MealData[]>([]);
  const [scheduledMenus, setScheduledMenus] = useState<MenuDayItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [loading, setLoading] = useState(true);

  // Policy Setting (Requirement 5)
  const [allowAllergyOrders, setAllowAllergyOrders] = useState(true);
  const [policySaving, setPolicySaving] = useState(false);

  // Meal Modal (Add / Edit Master Meal)
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealData | null>(null);

  // Meal Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('LUNCH');
  const [isVegetarian, setIsVegetarian] = useState(true);
  const [ingredients, setIngredients] = useState('');
  const [calories, setCalories] = useState<number | string>(450);
  const [price, setPrice] = useState<number | string>(100);

  // Multi-select allergens
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [customAllergenText, setCustomAllergenText] = useState('');

  // Schedule Modal (Assign Meal to Date)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleMealId, setScheduleMealId] = useState('');
  const [scheduleDate, setScheduleDate] = useState(getTodayString());
  const [scheduleQty, setScheduleQty] = useState(50);
  const [scheduleDeadline, setScheduleDeadline] = useState('08:30');

  const fetchData = async () => {
    try {
      const [mealsRes, menusRes, settingsRes] = await Promise.all([
        fetch('/api/admin/meals'),
        fetch(`/api/admin/menus?date=${selectedDate}`),
        fetch('/api/admin/settings'),
      ]);

      if (mealsRes.ok) {
        const m = await mealsRes.json();
        setMeals(m.meals || []);
      }
      if (menusRes.ok) {
        const s = await menusRes.json();
        setScheduledMenus(s.menus || []);
      }
      if (settingsRes.ok) {
        const sett = await settingsRes.json();
        if (sett.settings?.ALLOW_ALLERGY_ORDERS !== undefined) {
          setAllowAllergyOrders(sett.settings.ALLOW_ALLERGY_ORDERS);
        }
      }
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // Toggle Policy Setting
  const handleTogglePolicy = async () => {
    setPolicySaving(true);
    const newValue = !allowAllergyOrders;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ALLOW_ALLERGY_ORDERS',
          value: String(newValue),
        }),
      });

      if (res.ok) {
        setAllowAllergyOrders(newValue);
        showToast(
          newValue
            ? 'Policy updated: Parents CAN order meals with warning acknowledgment.'
            : 'Policy updated: Ordering meals with allergy conflicts is now STRICTLY BLOCKED.',
          'success'
        );
      } else {
        showToast('Failed to save policy setting', 'error');
      }
    } catch {
      showToast('Network error saving policy setting', 'error');
    } finally {
      setPolicySaving(false);
    }
  };

  const openAddMealModal = () => {
    setEditingMeal(null);
    setName('');
    setDescription('');
    setCategory('LUNCH');
    setIsVegetarian(true);
    setIngredients('Basmati Rice, Dal, Vegetables, Mild Spices');
    setSelectedAllergens(['Milk']);
    setCustomAllergenText('');
    setCalories(450);
    setPrice(100);
    setIsMealModalOpen(true);
  };

  const openEditMealModal = (m: MealData) => {
    setEditingMeal(m);
    setName(m.name);
    setDescription(m.description);
    setCategory(m.category);
    setIsVegetarian(m.isVegetarian);
    setIngredients(m.ingredients || '');
    setCalories(m.calories || 400);
    setPrice(m.price);

    // Parse allergens
    const existingList = m.allergensList || (m.allergens ? m.allergens.split(/[,;]/).map((s) => s.trim()) : []);
    const known = existingList.filter((a) => COMMON_ALLERGEN_TAGS.includes(a));
    const custom = existingList.filter((a) => !COMMON_ALLERGEN_TAGS.includes(a) && a.toLowerCase() !== 'none');

    setSelectedAllergens(known);
    setCustomAllergenText(custom.join(', '));
    setIsMealModalOpen(true);
  };

  const toggleAllergenTag = (tag: string) => {
    if (selectedAllergens.includes(tag)) {
      setSelectedAllergens(selectedAllergens.filter((t) => t !== tag));
    } else {
      setSelectedAllergens([...selectedAllergens, tag]);
    }
  };

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allTags = [...selectedAllergens];
      if (customAllergenText.trim()) {
        customAllergenText.split(/[,;]/).forEach((part) => {
          const clean = part.trim();
          if (clean && !allTags.includes(clean)) allTags.push(clean);
        });
      }

      const body = {
        id: editingMeal?.id,
        name,
        description,
        category,
        isVegetarian,
        ingredients,
        allergensList: allTags,
        calories: Number(calories),
        price: Number(price),
      };

      const res = await fetch('/api/admin/meals', {
        method: editingMeal ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(editingMeal ? 'Meal updated successfully!' : 'Meal created successfully!', 'success');
        setIsMealModalOpen(false);
        await fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save meal', 'error');
      }
    } catch {
      showToast('Network error saving meal', 'error');
    }
  };

  const handleDeleteMeal = async (id: string, mealName: string) => {
    if (!confirm(`Are you sure you want to delete ${mealName}?`)) return;
    try {
      const res = await fetch(`/api/admin/meals?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted ${mealName}`, 'info');
        await fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete meal', 'error');
      }
    } catch {
      showToast('Network error deleting meal', 'error');
    }
  };

  const handleScheduleMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleMealId) {
      showToast('Please select a meal to schedule', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealId: scheduleMealId,
          date: scheduleDate,
          maxQuantity: Number(scheduleQty),
          orderingDeadline: scheduleDeadline,
        }),
      });

      if (res.ok) {
        showToast('Meal successfully scheduled for date!', 'success');
        setIsScheduleModalOpen(false);
        await fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to schedule meal', 'error');
      }
    } catch {
      showToast('Network error scheduling meal', 'error');
    }
  };

  const handleRemoveFromSchedule = async (menuId: string) => {
    if (!confirm('Remove this meal from this date schedule?')) return;
    try {
      const res = await fetch(`/api/admin/menus?id=${menuId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Meal removed from date schedule', 'info');
        await fetchData();
      } else {
        showToast('Failed to remove scheduled meal', 'error');
      }
    } catch {
      showToast('Network error removing meal', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UtensilsCrossed className="w-7 h-7 text-amber-500" />
            <span>Menu & Allergen Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure master meals, assign allergens, publish daily meal schedules, and manage school allergy safety policy.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={openAddMealModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Master Meal</span>
          </button>
        </div>
      </div>

      {/* SECTION: School Allergy Policy Switch (Requirement 5) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                School Policy: Allow Ordering Meals with Allergy Warning
              </h3>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              When <strong>ON</strong>, parents may add a meal containing an allergen associated with their child&apos;s profile after explicitly confirming the warning modal. When <strong>OFF</strong>, conflicting meals are strictly blocked from being ordered.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                allowAllergyOrders
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {allowAllergyOrders ? 'ALLOWED (WITH CONFIRMATION)' : 'STRICTLY BLOCKED'}
            </span>

            <button
              onClick={handleTogglePolicy}
              disabled={policySaving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                allowAllergyOrders ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  allowAllergyOrders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: Daily Published Menu */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span>Published Daily Menu for {formatDatePretty(selectedDate)}</span>
            </h2>
            <p className="text-xs text-slate-500">Meals currently available for parents to order on this date</p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            />
            <button
              onClick={() => {
                if (meals.length > 0) setScheduleMealId(meals[0].id);
                setScheduleDate(selectedDate);
                setIsScheduleModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              + Schedule Meal
            </button>
          </div>
        </div>

        {scheduledMenus.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-3xl space-y-2">
            <p className="text-xs text-slate-500 font-medium">No meals scheduled yet for this date.</p>
            <button
              onClick={() => {
                if (meals.length > 0) setScheduleMealId(meals[0].id);
                setScheduleDate(selectedDate);
                setIsScheduleModalOpen(true);
              }}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              Schedule a Meal Now
            </button>
          </div>
        ) : (
          /* Cards matching Requirement 13 Design Reference */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {scheduledMenus.map((sm) => (
              <div
                key={sm.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div>
                  {/* Top: Meal Graphic on Left + Category + Name + Edit/Actions */}
                  <div className="flex items-start gap-3.5">
                    <MealIcon name={sm.meal.name} category={sm.meal.category} size="md" />

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <MealCategoryBadge category={sm.meal.category} />
                        <button
                          onClick={() => openEditMealModal(sm.meal)}
                          className="p-1 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Edit Master Recipe"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                        {sm.meal.name}
                      </h4>

                      <p className="text-sm font-black text-amber-700">{formatINR(sm.meal.price)}</p>
                    </div>
                  </div>

                  {/* Allergens tags if present */}
                  {sm.meal.allergens && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-slate-400 font-bold uppercase">Allergens:</span>
                      {sm.meal.allergens.split(/[,;]/).map((a, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-md border border-rose-200"
                        >
                          {a.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Row matching Reference: ☑ AVAILABLE TODAY TICKED ✓ & Remove Option */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>AVAILABLE TODAY</span>
                    </span>
                    <span className="text-emerald-800 text-[10px]">TICKED ✓</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Stock: {sm.availableQuantity}/{sm.maxQuantity} • Cutoff: {sm.orderingDeadline}
                    </span>

                    <button
                      onClick={() => handleRemoveFromSchedule(sm.id)}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove from date</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Master Meals Catalog (Requirement 13) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Master Meals Recipe Book ({meals.length})
            </h2>
            <p className="text-xs text-slate-500">All configured dishes available in the canteen recipe book.</p>
          </div>
        </div>

        {/* Master Meal Cards Grid (Requirement 13) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {meals.map((meal) => (
            <div
              key={meal.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-3.5">
                  <MealIcon name={meal.name} category={meal.category} size="lg" />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <MealCategoryBadge category={meal.category} />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditMealModal(meal)}
                          className="p-1 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Edit Recipe"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMeal(meal.id, meal.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Meal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                      {meal.name}
                    </h4>

                    <p className="text-sm font-black text-amber-700">{formatINR(meal.price)}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mt-3 leading-relaxed">
                  {meal.description}
                </p>

                {/* Allergen Tags */}
                <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Allergen Tags:
                  </span>
                  {meal.allergens && meal.allergens !== 'None' ? (
                    <div className="flex flex-wrap gap-1">
                      {meal.allergens.split(/[,;]/).map((alg, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold text-[10px] rounded-md border border-rose-200"
                        >
                          {alg.trim()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No allergens tagged</span>
                  )}
                </div>
              </div>

              {/* Add to day button */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setScheduleMealId(meal.id);
                    setScheduleDate(selectedDate);
                    setIsScheduleModalOpen(true);
                  }}
                  className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule For {formatDatePretty(selectedDate).split(',')[0]}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CREATE / EDIT MEAL MODAL (Requirement 4: Multi-allergen tag selector) */}
      {isMealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingMeal ? `Edit Recipe: ${editingMeal.name}` : 'Create Master Meal'}
                </h3>
                <p className="text-xs text-slate-500">Configure dish details and allergen tags for warning engine</p>
              </div>
              <button
                onClick={() => setIsMealModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMeal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Meal Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Paneer Rice Bowl"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Wholesome ingredients, cooking style, accompaniments..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold"
                  >
                    <option value="BREAKFAST">● BREAKFAST</option>
                    <option value="LUNCH">● LUNCH</option>
                    <option value="SNACK">● SNACK</option>
                    <option value="BEVERAGE">● BEVERAGE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Dietary Classification
                  </label>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                      <input
                        type="radio"
                        checked={isVegetarian === true}
                        onChange={() => setIsVegetarian(true)}
                        className="accent-emerald-600"
                      />
                      <VegBadge isVegetarian={true} showLabel={true} />
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                      <input
                        type="radio"
                        checked={isVegetarian === false}
                        onChange={() => setIsVegetarian(false)}
                        className="accent-rose-600"
                      />
                      <VegBadge isVegetarian={false} showLabel={true} />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ingredients
                </label>
                <input
                  type="text"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="e.g. Basmati Rice, Paneer, Tomatoes, Cashew Paste"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>

              {/* Requirement 4: Allergen Tag Selector */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Allergen Tags (Multi-Select)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Trigger warnings for children</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {COMMON_ALLERGEN_TAGS.map((tag) => {
                    const isSelected = selectedAllergens.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleAllergenTag(tag)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? `✓ ${tag}` : tag}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Other / Custom Allergen:
                  </label>
                  <input
                    type="text"
                    value={customAllergenText}
                    onChange={(e) => setCustomAllergenText(e.target.value)}
                    placeholder="e.g. Mustard, Sulfites, Coconut"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMealModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  {editingMeal ? 'Update Recipe' : 'Save Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Schedule Meal for Date</h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleMeal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Meal</label>
                <select
                  value={scheduleMealId}
                  onChange={(e) => setScheduleMealId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  {meals.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({formatINR(m.price)}) - {m.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Max Portions</label>
                  <input
                    type="number"
                    min={5}
                    value={scheduleQty}
                    onChange={(e) => setScheduleQty(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Order Cutoff Time</label>
                  <input
                    type="time"
                    value={scheduleDeadline}
                    onChange={(e) => setScheduleDeadline(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Publish to Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
