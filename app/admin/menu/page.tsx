'use client';

import React, { useEffect, useState } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Flame,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
  Search,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import { formatINR, formatDatePretty, getTodayString, getOffsetDateString } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';
import { MealData, MenuDayItem } from '@/types';

export default function AdminMenuPage() {
  const { showToast } = useToast();

  const [meals, setMeals] = useState<MealData[]>([]);
  const [scheduledMenus, setScheduledMenus] = useState<MenuDayItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [loading, setLoading] = useState(true);

  // Meal Modal (Add / Edit Master Meal)
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealData | null>(null);

  // Meal Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('LUNCH');
  const [isVegetarian, setIsVegetarian] = useState(true);
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');
  const [calories, setCalories] = useState<number | string>(450);
  const [price, setPrice] = useState<number | string>(100);
  const [imageUrl, setImageUrl] = useState('');

  // Schedule Modal (Assign Meal to Date)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleMealId, setScheduleMealId] = useState('');
  const [scheduleDate, setScheduleDate] = useState(getTodayString());
  const [scheduleQty, setScheduleQty] = useState(50);
  const [scheduleDeadline, setScheduleDeadline] = useState('08:30');

  const fetchData = async () => {
    try {
      const [mealsRes, menusRes] = await Promise.all([
        fetch('/api/admin/meals'),
        fetch(`/api/admin/menus?date=${selectedDate}`),
      ]);

      if (mealsRes.ok) {
        const m = await mealsRes.json();
        setMeals(m.meals || []);
      }
      if (menusRes.ok) {
        const s = await menusRes.json();
        setScheduledMenus(s.menus || []);
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

  const openAddMealModal = () => {
    setEditingMeal(null);
    setName('');
    setDescription('');
    setCategory('LUNCH');
    setIsVegetarian(true);
    setIngredients('Basmati Rice, Vegetables, Ghee, Spices');
    setAllergens('Dairy');
    setCalories(450);
    setPrice(100);
    setImageUrl('https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80');
    setIsMealModalOpen(true);
  };

  const openEditMealModal = (m: MealData) => {
    setEditingMeal(m);
    setName(m.name);
    setDescription(m.description);
    setCategory(m.category);
    setIsVegetarian(m.isVegetarian);
    setIngredients(m.ingredients || '');
    setAllergens(m.allergens || '');
    setCalories(m.calories || 400);
    setPrice(m.price);
    setImageUrl(m.imageUrl || '');
    setIsMealModalOpen(true);
  };

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        id: editingMeal?.id,
        name,
        description,
        category,
        isVegetarian,
        ingredients,
        allergens,
        calories: Number(calories),
        price: Number(price),
        imageUrl,
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
      showToast('Please select a meal', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealId: scheduleMealId,
          date: scheduleDate,
          availableQuantity: Number(scheduleQty),
          maxQuantity: Number(scheduleQty),
          orderingDeadline: scheduleDeadline,
        }),
      });

      if (res.ok) {
        showToast(`Meal added to daily menu for ${formatDatePretty(scheduleDate)}!`, 'success');
        setIsScheduleModalOpen(false);
        await fetchData();
      } else {
        showToast('Failed to schedule meal', 'error');
      }
    } catch {
      showToast('Network error scheduling meal', 'error');
    }
  };

  const handleRemoveFromSchedule = async (id: string) => {
    if (!confirm('Remove this dish from the daily menu?')) return;
    try {
      const res = await fetch(`/api/admin/menus?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Removed from daily menu', 'info');
        await fetchData();
      }
    } catch {
      showToast('Failed to remove from schedule', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UtensilsCrossed className="w-7 h-7 text-purple-600" />
            <span>Menu & Cutoff Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Maintain school meal catalog, assign daily menus with portion quotas, and configure 08:30 AM order deadlines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => {
              if (meals.length > 0) setScheduleMealId(meals[0].id);
              setScheduleDate(selectedDate);
              setIsScheduleModalOpen(true);
            }}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            <span>Assign Meal to Date</span>
          </button>

          <button
            onClick={openAddMealModal}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Meal</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Daily Menu Schedule for Selected Date */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span>Menu Schedule for: {formatDatePretty(selectedDate)}</span>
            </h2>
            <p className="text-xs text-slate-500">
              Meals that parents can currently select and order for this specific date
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500">Pick Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
            />
          </div>
        </div>

        {scheduledMenus.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl space-y-2">
            <p className="text-xs text-slate-500 font-medium">No meals scheduled yet for this date.</p>
            <button
              onClick={() => {
                if (meals.length > 0) setScheduleMealId(meals[0].id);
                setScheduleDate(selectedDate);
                setIsScheduleModalOpen(true);
              }}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold"
            >
              + Schedule a Meal Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scheduledMenus.map((sm) => (
              <div
                key={sm.id}
                className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                    <img
                      src={
                        sm.meal.imageUrl ||
                        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=200&auto=format&fit=crop&q=80'
                      }
                      alt={sm.meal.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <VegBadge isVegetarian={sm.meal.isVegetarian} size="sm" />
                      <h4 className="font-bold text-slate-900 text-xs">{sm.meal.name}</h4>
                    </div>
                    <p className="text-xs font-bold text-amber-700">{formatINR(sm.meal.price)}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>Portions: <strong>{sm.availableQuantity}/{sm.maxQuantity}</strong></span>
                      <span>•</span>
                      <span>Cutoff: <strong>{sm.orderingDeadline}</strong></span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveFromSchedule(sm.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove from date"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Master Meals Catalog */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Master Meals Catalog ({meals.length})</h2>
          <p className="text-xs text-slate-500">
            All configured dishes available in the canteen recipe book.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meals.map((meal) => (
            <div
              key={meal.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="relative h-40 overflow-hidden bg-slate-100">
                  <img
                    src={
                      meal.imageUrl ||
                      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&auto=format&fit=crop&q=80'
                    }
                    alt={meal.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <VegBadge isVegetarian={meal.isVegetarian} size="sm" showLabel={true} />
                  </div>
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 text-[10px] font-bold bg-black/60 text-white rounded-md">
                    {meal.category}
                  </span>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-extrabold text-slate-900 text-sm">{meal.name}</h4>
                    <span className="font-extrabold text-amber-700 text-base">{formatINR(meal.price)}</span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{meal.description}</p>

                  <div className="text-[11px] space-y-1 pt-1 text-slate-500">
                    {meal.calories && (
                      <p className="flex items-center gap-1 text-amber-800">
                        <Flame className="w-3.5 h-3.5 text-amber-600" />
                        <span>{meal.calories} kcal</span>
                      </p>
                    )}
                    {meal.allergens && (
                      <p className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                        Allergens: {meal.allergens}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                <button
                  onClick={() => {
                    setScheduleMealId(meal.id);
                    setScheduleDate(selectedDate);
                    setIsScheduleModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors"
                >
                  + Add to Day
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditMealModal(meal)}
                    className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Edit Recipe & Price"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteMeal(meal.id, meal.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Recipe"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CREATE / EDIT MEAL MODAL */}
      {isMealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingMeal ? `Edit Recipe: ${editingMeal.name}` : 'Create New Meal Recipe'}
                </h3>
                <p className="text-xs text-slate-500">Configure Indian school canteen dish specifications</p>
              </div>
              <button
                onClick={() => setIsMealModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description *
                </label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="e.g. Mildly spiced tomato paneer curry with steamed basmati rice..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Price in INR (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="1000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  >
                    <option value="LUNCH">Lunch Meal</option>
                    <option value="SNACKS">Snack & Quick Bite</option>
                    <option value="BEVERAGE">Healthy Beverage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dietary Classification
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="radio"
                      name="adminDiet"
                      checked={isVegetarian === true}
                      onChange={() => setIsVegetarian(true)}
                      className="accent-emerald-600"
                    />
                    <VegBadge isVegetarian={true} showLabel={true} />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="radio"
                      name="adminDiet"
                      checked={isVegetarian === false}
                      onChange={() => setIsVegetarian(false)}
                      className="accent-rose-600"
                    />
                    <VegBadge isVegetarian={false} showLabel={true} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="450"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Known Allergens
                  </label>
                  <input
                    type="text"
                    value={allergens}
                    onChange={(e) => setAllergens(e.target.value)}
                    placeholder="e.g. Dairy, Gluten, Nuts"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ingredients List
                </label>
                <input
                  type="text"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="Basmati Rice, Paneer, Tomatoes, Cumin, Ghee"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMealModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                >
                  {editingMeal ? 'Update Recipe' : 'Save New Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Schedule Meal to Date</h3>
                <p className="text-xs text-slate-500">Publish this dish to the parent ordering calendar</p>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleMeal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Meal Recipe *
                </label>
                <select
                  value={scheduleMealId}
                  onChange={(e) => setScheduleMealId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                >
                  {meals.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({formatINR(m.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date for Lunch *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Portions Quota *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="500"
                    value={scheduleQty}
                    onChange={(e) => setScheduleQty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Kitchen prep limit</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Cutoff Deadline *
                  </label>
                  <input
                    type="text"
                    required
                    value={scheduleDeadline}
                    onChange={(e) => setScheduleDeadline(e.target.value)}
                    placeholder="08:30"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Format: HH:mm AM</p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                >
                  Publish to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
