'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  Mail,
  Phone,
  Wallet,
  Calendar,
  AlertCircle,
  Search,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import { formatINR, formatDateTimePretty } from '@/lib/utils';

export default function AdminUsersPage() {
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          setParents(data.parents || []);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const filteredParents = parents.filter((p) => {
    const s = search.toLowerCase();
    const matchParent = p.name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s);
    const matchChild = p.students?.some((st: any) => st.name.toLowerCase().includes(s));
    return matchParent || matchChild;
  });

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-purple-600" />
            <span>Registered Families & Students</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Directory of school parents, active enrolled students, dietary profiles, and prepaid balances.
          </p>
        </div>

        {/* Search */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parent or student..."
            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Parents Cards List */}
      <div className="space-y-6">
        {filteredParents.map((parent) => (
          <div
            key={parent.id}
            className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5"
          >
            {/* Parent Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-lg">
                  {parent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">{parent.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {parent.email}
                    </span>
                    {parent.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {parent.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Meal Wallet</p>
                  <p className="font-black text-emerald-700 text-sm">{formatINR(parent.walletBalance)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Spent</p>
                  <p className="font-black text-slate-800 text-sm">{formatINR(parent.totalSpent)}</p>
                </div>
              </div>
            </div>

            {/* Children Cards under this Parent */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Enrolled Children ({parent.students?.length || 0})
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {parent.students?.map((child: any) => (
                  <div
                    key={child.id}
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <VegBadge isVegetarian={child.isVegetarian} size="sm" />
                        <h4 className="font-bold text-slate-900 text-xs">{child.name}</h4>
                      </div>
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        Class {child.grade}-{child.division}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Roll: <strong>{child.rollNo}</strong></span>
                      <span className="font-mono text-slate-400">{child.studentId}</span>
                    </div>

                    {child.allergies ? (
                      <p className="text-[10px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-md">
                        Allergy: {child.allergies}
                      </p>
                    ) : (
                      <p className="text-[10px] text-emerald-700 font-medium">No allergies reported</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
