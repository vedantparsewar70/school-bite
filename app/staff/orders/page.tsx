'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  GraduationCap,
  Users,
  Clock,
  Sparkles,
  ChefHat,
  X,
  Printer,
  UtensilsCrossed,
  History,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import { formatDatePretty, getTodayString, formatINR } from '@/lib/utils';
import { useToast } from '@/components/ToastContext';

function StaffOrdersContent() {
  const todayDateStr = getTodayString();
  const { showToast } = useToast();

  // Active tab: 'STUDENTS' | 'TEACHERS'
  const [activeTab, setActiveTab] = useState<'STUDENTS' | 'TEACHERS'>('STUDENTS');

  // Student orders state (active only)
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyStudentCount, setHistoryStudentCount] = useState(0);

  // Teacher orders state (active only)
  const [teacherOrders, setTeacherOrders] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [historyTeacherCount, setHistoryTeacherCount] = useState(0);

  // Total Orders breakdown modal state
  const [showTotalOrdersModal, setShowTotalOrdersModal] = useState(false);
  const [modalTab, setModalTab] = useState<'STUDENTS' | 'TEACHERS'>('STUDENTS');
  const [kitchenData, setKitchenData] = useState<any>(null);
  const [loadingKitchen, setLoadingKitchen] = useState(false);

  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch kitchen production summary for today
  const fetchKitchenSummary = async () => {
    setLoadingKitchen(true);
    try {
      const res = await fetch(`/api/admin/kitchen?date=${todayDateStr}`);
      if (res.ok) {
        const data = await res.json();
        setKitchenData(data);
      }
    } catch (err) {
      console.error('Failed to load kitchen summary:', err);
    } finally {
      setLoadingKitchen(false);
    }
  };

  useEffect(() => {
    fetchKitchenSummary();
  }, []);

  // Fetch student orders (active non-collected only)
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('date', todayDateStr);
      if (search) params.append('search', search);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const allOrders = data.orders || [];
        // Only active orders remain in this section until staff clicks 'Given'
        const activeOrders = allOrders.filter(
          (o: any) => o.orderStatus !== 'COLLECTED' && o.orderStatus !== 'CANCELLED'
        );
        const givenCount = allOrders.filter((o: any) => o.orderStatus === 'COLLECTED').length;
        setOrders(activeOrders);
        setHistoryStudentCount(givenCount);
      }
    } catch (err) {
      console.error('Failed to load student orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch teacher orders (active non-given only)
  const fetchTeacherOrders = async () => {
    setLoadingTeachers(true);
    try {
      const params = new URLSearchParams();
      params.append('date', todayDateStr);
      if (search) params.append('search', search);

      const res = await fetch(`/api/staff/teacher-orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const allTeacherOrders = data.orders || [];
        // Only active teacher orders remain in this section until staff clicks 'Given'
        const activeTeachers = allTeacherOrders.filter(
          (o: any) => o.orderStatus !== 'GIVEN' && o.orderStatus !== 'COLLECTED' && o.orderStatus !== 'CANCELLED'
        );
        const givenCount = allTeacherOrders.filter(
          (o: any) => o.orderStatus === 'GIVEN' || o.orderStatus === 'COLLECTED'
        ).length;
        setTeacherOrders(activeTeachers);
        setHistoryTeacherCount(givenCount);
      }
    } catch (err) {
      console.error('Failed to load teacher orders:', err);
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'STUDENTS') {
        fetchOrders();
      } else {
        fetchTeacherOrders();
      }
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, activeTab]);

  // Initial load of teacher orders count
  useEffect(() => {
    fetchTeacherOrders();
  }, []);

  const handleMarkCollected = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: 'COLLECTED' }),
      });

      if (res.ok) {
        showToast('Meal marked as given! Moved to History.', 'success');
        // Once marked given, remove from active orders and move to history
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setHistoryStudentCount((c) => c + 1);
      } else {
        showToast('Failed to update order status', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkTeacherGiven = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch('/api/staff/teacher-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: 'GIVEN' }),
      });

      if (res.ok) {
        showToast('Teacher meal marked as given! Moved to History.', 'success');
        // Once marked given, remove from active orders and move to history
        setTeacherOrders((prev) => prev.filter((o) => o.id !== orderId));
        setHistoryTeacherCount((c) => c + 1);
      } else {
        showToast('Failed to update teacher order', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Aggregate teacher meals
  const teacherMealCounts = useMemo(() => {
    const map = new Map<string, { mealName: string; isVegetarian: boolean; category: string; orderIds: Set<string> }>();
    for (const o of teacherOrders) {
      for (const it of o.items || []) {
        const name = it.mealName || 'Meal';
        const existing = map.get(name);
        if (existing) {
          if (o.id) existing.orderIds.add(o.id);
        } else {
          const orderIds = new Set<string>();
          if (o.id) orderIds.add(o.id);
          map.set(name, {
            mealName: name,
            isVegetarian: it.isVegetarian ?? true,
            category: it.category || 'LUNCH',
            orderIds,
          });
        }
      }
    }
    return Array.from(map.values())
      .map((item) => ({
        mealName: item.mealName,
        isVegetarian: item.isVegetarian,
        category: item.category,
        orderCount: item.orderIds.size,
      }))
      .sort((a, b) => b.orderCount - a.orderCount);
  }, [teacherOrders]);

  const currentTotalOrders =
    modalTab === 'STUDENTS'
      ? kitchenData?.totalOrders ?? orders.length
      : teacherOrders.length;

  const currentMealCounts =
    modalTab === 'STUDENTS'
      ? kitchenData?.mealCounts || []
      : teacherMealCounts;

  const pendingTeacherOrdersCount = teacherOrders.filter(
    (o) => o.orderStatus !== 'GIVEN' && o.orderStatus !== 'COLLECTED'
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4 pb-28 sm:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
            Canteen Roster
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            <span>Orders</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/staff/history"
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs"
            title="View Given Order History"
          >
            <History className="w-4 h-4 text-emerald-600" />
            <span>History ({historyStudentCount + historyTeacherCount})</span>
          </Link>

          <button
            onClick={activeTab === 'STUDENTS' ? fetchOrders : fetchTeacherOrders}
            disabled={activeTab === 'STUDENTS' ? loading : loadingTeachers}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                (activeTab === 'STUDENTS' ? loading : loadingTeachers)
                  ? 'animate-spin text-amber-500'
                  : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Segmented Tab Switch: Student Orders vs Teacher Orders */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setActiveTab('STUDENTS');
            setSearch('');
          }}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'STUDENTS'
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Student Orders ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('TEACHERS');
            setSearch('');
          }}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 relative ${
            activeTab === 'TEACHERS'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Teacher Orders ({teacherOrders.length})</span>
          {pendingTeacherOrdersCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-2 right-2 ring-2 ring-white animate-pulse" />
          )}
        </button>
      </div>

      {/* Action Button: Check Total Orders */}
      <div>
        <button
          type="button"
          onClick={() => {
            fetchKitchenSummary();
            setModalTab(activeTab);
            setShowTotalOrdersModal(true);
          }}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.99] text-white rounded-2xl font-black text-sm shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <ChefHat className="w-5 h-5" />
          <span>Check Total Orders</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            activeTab === 'STUDENTS'
              ? 'Search student name or roll number...'
              : 'Search teacher name or order ID...'
          }
          className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:outline-hidden focus:border-amber-500 shadow-2xs"
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: STUDENT ORDERS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'STUDENTS' && (
        <>
          {loading ? (
            <div className="min-h-[40vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">
                {historyStudentCount > 0 ? 'All Student Meals Given!' : 'No Active Student Orders'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {historyStudentCount > 0
                  ? `All ${historyStudentCount} student meals for today have been handed out and moved to History.`
                  : `No pending student orders for ${formatDatePretty(todayDateStr)}.`}
              </p>
              {historyStudentCount > 0 && (
                <div className="pt-1">
                  <Link
                    href="/staff/history"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Student History ({historyStudentCount}) →</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-semibold px-1">
                Total {orders.length} student {orders.length === 1 ? 'order' : 'orders'} for{' '}
                {formatDatePretty(todayDateStr)}
              </p>

              {orders.map((o) => {
                const firstItem = o.items?.[0];
                const isCollected = o.orderStatus === 'COLLECTED';

                // Group duplicate items by meal name
                const groupedMap = new Map<
                  string,
                  { mealName: string; isVegetarian: boolean; quantity: number }
                >();
                for (const it of o.items || []) {
                  const key = it.mealName || it.mealId;
                  const existing = groupedMap.get(key);
                  if (existing) {
                    existing.quantity += it.quantity;
                  } else {
                    groupedMap.set(key, {
                      mealName: it.mealName,
                      isVegetarian: it.isVegetarian,
                      quantity: it.quantity,
                    });
                  }
                }
                const groupedItems = Array.from(groupedMap.values());

                return (
                  <div
                    key={o.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-xs space-y-3.5 ${
                      isCollected
                        ? 'bg-slate-50/70 border-slate-200 opacity-75'
                        : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-md'
                    }`}
                  >
                    {/* Top Header: Class & Roll Number */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black bg-purple-100 text-purple-800 border border-purple-200/80 tracking-wide">
                          Class {firstItem?.studentGrade || '-'}-{firstItem?.studentDivision || '-'}
                        </span>
                        {firstItem?.studentRollNo && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-100 text-slate-700">
                            Roll #{firstItem.studentRollNo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ordered Items List */}
                    <div className="space-y-2">
                      {groupedItems.map((it, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 py-1 text-xs"
                        >
                          <div className="flex items-center gap-2 font-bold text-slate-800 text-[13px] leading-tight">
                            <VegBadge isVegetarian={it.isVegetarian} size="sm" />
                            <span>{it.mealName}</span>
                          </div>
                          <span className="font-black text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg text-xs shrink-0">
                            Qty: {it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Allergy Alert Warning if any */}
                    {o.hasAnyAllergyAlert && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Allergy alert noted on file for this student.</span>
                      </div>
                    )}

                    {/* Card Footer: Clean ID & Handout Action Button */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span
                        className="font-mono text-xs font-semibold text-slate-400 truncate max-w-[160px] sm:max-w-none"
                        title={o.id}
                      >
                        {o.id}
                      </span>

                      {isCollected ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Collected</span>
                        </span>
                      ) : (
                      <button
                        type="button"
                        onClick={() => handleMarkCollected(o.id)}
                        disabled={updatingId === o.id}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Mark Given</span>
                      </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: TEACHER ORDERS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'TEACHERS' && (
        <>
          {loadingTeachers ? (
            <div className="min-h-[40vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : teacherOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">
                {historyTeacherCount > 0 ? 'All Teacher Meals Given!' : 'No Active Teacher Orders'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {historyTeacherCount > 0
                  ? `All ${historyTeacherCount} teacher meals for today have been handed out and moved to History.`
                  : `No pending teacher direct orders for ${formatDatePretty(todayDateStr)}.`}
              </p>
              {historyTeacherCount > 0 && (
                <div className="pt-1">
                  <Link
                    href="/staff/history"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Teacher History ({historyTeacherCount}) →</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                  Teacher Collection Roster
                </span>
                <span className="text-slate-500 font-semibold text-[11px]">
                  {pendingTeacherOrdersCount} pending collection
                </span>
              </div>

              {teacherOrders.map((to) => {
                const isGiven = to.orderStatus === 'GIVEN' || to.orderStatus === 'COLLECTED';
                const isPaid = to.paymentStatus === 'PAID';

                return (
                  <div
                    key={to.id}
                    className={`p-4 sm:p-5 rounded-2xl border-2 transition-all shadow-xs space-y-3.5 ${
                      isGiven
                        ? 'bg-slate-50/70 border-slate-200 opacity-70'
                        : 'bg-white border-emerald-200 hover:border-emerald-400 hover:shadow-md'
                    }`}
                  >
                    {/* Top: Teacher Name & Payment Badge */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Teacher
                        </span>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                          {to.teacherName}
                        </h2>
                        {to.teacherPhone && to.teacherPhone !== '9999999999' && (
                          <span className="text-xs text-slate-500 font-medium">
                            Phone: {to.teacherPhone}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{isPaid ? 'PAID • Online' : to.paymentStatus}</span>
                        </span>
                        <span className="block text-xs font-black text-slate-900 mt-1">
                          {formatINR(to.totalAmount || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Ordered Items */}
                    <div className="space-y-1.5">
                      {(to.items || []).map((it: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-0.5 text-xs">
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            <VegBadge isVegetarian={it.isVegetarian !== false} size="sm" />
                            <span>{it.mealName}</span>
                          </div>
                          <span className="font-extrabold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-xs">
                            x {it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {to.notes && (
                      <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                        <strong>Note:</strong> {to.notes}
                      </div>
                    )}

                    {/* Footer: Order ID and "Mark Given" Button */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold text-slate-400">
                        {to.id}
                      </span>

                      {isGiven ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Given to Teacher</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkTeacherGiven(to.id)}
                          disabled={updatingId === to.id}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Mark Given</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Total Orders & Kitchen Production Breakdown                        */}
      {/* ========================================================================= */}
      {showTotalOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 leading-tight">Total Orders</h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kitchen Production</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fetchKitchenSummary()}
                  disabled={loadingKitchen}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Refresh counts"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingKitchen ? 'animate-spin text-amber-500' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Print summary"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTotalOrdersModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tab Switcher inside Modal: Student vs Teacher */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setModalTab('STUDENTS')}
                className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === 'STUDENTS'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Student ({kitchenData?.totalOrders ?? orders.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('TEACHERS')}
                className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === 'TEACHERS'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Teacher ({teacherOrders.length})</span>
              </button>
            </div>

            {/* Dark Summary Card (Screenshot 2) */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  TODAY&apos;S DATE
                </span>
                <p className="text-xl font-black text-amber-400 mt-0.5">
                  {formatDatePretty(todayDateStr)}
                </p>
                <span className="text-xs text-slate-400 font-bold mt-1 block">
                  {currentTotalOrders} total orders
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  TOTAL ORDERS
                </span>
                <p className="text-4xl font-black text-white mt-0.5">
                  {currentTotalOrders}
                </p>
              </div>
            </div>

            {/* Section Header: ORDERS BY FOOD PRODUCT */}
            <div className="flex items-center justify-between px-1 pt-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                ORDERS BY FOOD PRODUCT
              </h4>
              <span className="text-xs font-bold text-slate-400">
                {currentTotalOrders} total orders
              </span>
            </div>

            {/* Food Items Cards List (Screenshot 2) */}
            {loadingKitchen && modalTab === 'STUDENTS' ? (
              <div className="py-10 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : currentMealCounts.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                <UtensilsCrossed className="w-8 h-8 mx-auto text-slate-300" />
                <h4 className="font-extrabold text-slate-700 text-sm">No Orders Found</h4>
                <p className="text-xs text-slate-500">
                  No food product orders recorded for {modalTab === 'STUDENTS' ? 'students' : 'teachers'} today.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentMealCounts.map((mc: any, idx: number) => (
                  <div
                    key={mc.mealId || idx}
                    className="bg-white p-4 rounded-2xl border-2 border-slate-200/90 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <VegBadge isVegetarian={mc.isVegetarian} size="sm" />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          {mc.category || 'LUNCH'}
                        </span>
                      </div>
                      <h5 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase truncate">
                        {mc.mealName}
                      </h5>
                      <p className="text-xs font-bold text-slate-500">
                        Need to prepare: <span className="text-slate-800">{mc.orderCount} orders</span>
                      </p>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-200/90 px-4 py-2.5 rounded-2xl min-w-[90px] text-center shrink-0">
                      <span className="text-3xl font-black text-amber-600 block leading-tight">
                        {mc.orderCount}
                      </span>
                      <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                        ORDERS
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <StaffOrdersContent />
    </Suspense>
  );
}
