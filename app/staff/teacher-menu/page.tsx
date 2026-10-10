'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import { formatINR } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';
import { broadcastSyncEvent } from '@/lib/client-sync';

interface TeacherMeal {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  isVegetarian: boolean;
  isAvailable: boolean;
}

export default function StaffTeacherMenuPage() {
  const { showToast } = useToast();

  const [meals, setMeals] = useState<TeacherMeal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<TeacherMeal | null>(null);

  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('80');
  const [formCategory, setFormCategory] = useState('LUNCH');
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchMeals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/teacher-menu');
      if (res.ok) {
        const data = await res.json();
        setMeals(data.meals || []);
      } else {
        showToast('Failed to load teacher menu items', 'error');
      }
    } catch {
      showToast('Network error loading menu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  const handleOpenAdd = () => {
    setEditingMeal(null);
    setFormName('');
    setFormPrice('80');
    setFormCategory('LUNCH');
    setFormIsVeg(true);
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (meal: TeacherMeal) => {
    setEditingMeal(meal);
    setFormName(meal.name);
    setFormPrice(String(meal.price));
    setFormCategory(meal.category || 'LUNCH');
    setFormIsVeg(meal.isVegetarian);
    setFormDescription(meal.description || '');
    setIsModalOpen(true);
  };

  const handleToggleAvailability = async (meal: TeacherMeal) => {
    setTogglingId(meal.id);
    const newStatus = !meal.isAvailable;
    try {
      const res = await fetch('/api/staff/teacher-menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: meal.id, isAvailable: newStatus }),
      });

      if (res.ok) {
        setMeals((prev) =>
          prev.map((m) => (m.id === meal.id ? { ...m, isAvailable: newStatus } : m))
        );
        broadcastSyncEvent('TEACHER_ORDERS_UPDATED');
        showToast(
          `"${meal.name}" marked as ${newStatus ? 'available' : 'unavailable'} for teachers`,
          'info'
        );
      } else {
        showToast('Failed to toggle status', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteMeal = async (meal: TeacherMeal) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${meal.name}" from the teacher menu?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/staff/teacher-menu?id=${meal.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMeals((prev) => prev.filter((m) => m.id !== meal.id));
        broadcastSyncEvent('TEACHER_ORDERS_UPDATED');
        showToast(`"${meal.name}" removed from teacher menu`, 'success');
      } else {
        showToast('Failed to delete item', 'error');
      }
    } catch {
      showToast('Network error deleting item', 'error');
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    const numPrice = parseFloat(formPrice);

    if (!cleanName) {
      showToast('Please enter a dish name', 'error');
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      showToast('Please enter a valid price greater than 0', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingMeal) {
        // PUT update
        const res = await fetch('/api/staff/teacher-menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingMeal.id,
            name: cleanName,
            price: numPrice,
            category: formCategory,
            isVegetarian: formIsVeg,
            description: formDescription.trim(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setMeals((prev) => prev.map((m) => (m.id === editingMeal.id ? data.meal : m)));
          broadcastSyncEvent('TEACHER_ORDERS_UPDATED');
          showToast(`"${cleanName}" updated successfully!`, 'success');
          setIsModalOpen(false);
        } else {
          showToast('Failed to update item', 'error');
        }
      } else {
        // POST create
        const res = await fetch('/api/staff/teacher-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            price: numPrice,
            category: formCategory,
            isVegetarian: formIsVeg,
            description: formDescription.trim(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setMeals((prev) => [data.meal, ...prev]);
          broadcastSyncEvent('TEACHER_ORDERS_UPDATED');
          showToast(`"${cleanName}" added to teacher menu!`, 'success');
          setIsModalOpen(false);
        } else {
          showToast('Failed to create item', 'error');
        }
      }
    } catch {
      showToast('Network error saving item', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <Link
            href="/staff/kitchen"
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs"
            title="Back to Kitchen"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
              <GraduationCap className="w-3 h-3" />
              <span>Staff Portal</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-emerald-600" />
              <span>Teacher Menu Manager</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMeals}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Teacher Dish</span>
            <span className="sm:hidden">Add Dish</span>
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between gap-3 text-emerald-950 text-xs">
        <div>
          <span className="font-extrabold block text-sm text-emerald-900">
            Separate Menu for Teachers & Staff
          </span>
          <span className="text-emerald-800 font-medium">
            Toggle switches ON or OFF to control which dishes teachers can order today without login.
          </span>
        </div>
        <span className="px-3 py-1 bg-white border border-emerald-200 rounded-xl font-black text-emerald-800 shrink-0 shadow-2xs">
          {meals.filter((m) => m.isAvailable !== false).length} of {meals.length} Active
        </span>
      </div>

      {/* List of Meals */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : meals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-2">
          <UtensilsCrossed className="w-10 h-10 mx-auto text-slate-300" />
          <h3 className="font-extrabold text-slate-800 text-base">No Teacher Dishes Created</h3>
          <p className="text-xs text-slate-500">
            Click &quot;Add Teacher Dish&quot; above to create items that teachers can order.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map((meal) => {
            const isAvail = meal.isAvailable !== false;
            const isToggling = togglingId === meal.id;

            return (
              <div
                key={meal.id}
                className={`bg-white p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 shadow-2xs ${
                  isAvail ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/60 opacity-60'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <VegBadge isVegetarian={meal.isVegetarian} size="sm" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {meal.category || 'LUNCH'}
                    </span>
                    {!isAvail && (
                      <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                        Unavailable
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                    {meal.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-black text-emerald-700">{formatINR(meal.price)}</span>
                    {meal.description && (
                      <span className="text-slate-400 truncate max-w-xs">{meal.description}</span>
                    )}
                  </div>
                </div>

                {/* Right controls: Toggle & Edit/Delete */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(meal)}
                    disabled={isToggling}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      isAvail
                        ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isAvail ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{isAvail ? 'Available' : 'Hidden'}</span>
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(meal)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Edit Item"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteMeal(meal)}
                    className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingMeal ? 'Edit Teacher Dish' : 'Add Teacher Dish'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dish Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Executive Deluxe Veg Thali"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="80"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="LUNCH">Lunch</option>
                    <option value="BREAKFAST">Breakfast</option>
                    <option value="BEVERAGE">Beverage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Served with paneer sabzi, dal tadka, jeera rice and 3 rotis"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Vegetarian Dish Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">Vegetarian Dish</span>
                <input
                  type="checkbox"
                  checked={formIsVeg}
                  onChange={(e) => setFormIsVeg(e.target.checked)}
                  className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{editingMeal ? 'Save Changes' : 'Add Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
