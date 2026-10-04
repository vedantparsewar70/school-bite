'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Filter,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Eye,
  Mail,
  Phone,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import VegBadge from '@/components/VegBadge';
import ChildAvatar from '@/components/ChildAvatar';
import { formatINR } from '@/lib/utils';

const ALLERGY_FILTERS = [
  'Milk',
  'Peanuts',
  'Egg',
  'Soy',
  'Wheat',
  'Tree Nuts',
  'Fish',
  'Shellfish',
  'Other',
];

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<'students' | 'parents'>('students');
  const [students, setStudents] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [allergyFilter, setAllergyFilter] = useState<'ALL' | 'HAS_ALLERGIES' | 'NO_ALLERGIES'>('ALL');
  const [specificAllergy, setSpecificAllergy] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');

  // Selected Student Modal
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          setStudents(data.students || []);
          setParents(data.parents || []);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter students
  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      s.name.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      s.parentName.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (gradeFilter && s.grade !== gradeFilter) return false;

    const hasAllergies = s.allergiesList && s.allergiesList.length > 0 && !s.allergiesList.includes('None');

    if (allergyFilter === 'HAS_ALLERGIES' && !hasAllergies) return false;
    if (allergyFilter === 'NO_ALLERGIES' && hasAllergies) return false;

    if (specificAllergy) {
      const matchSpecific = s.allergiesList?.some(
        (a: string) => a.toLowerCase() === specificAllergy.toLowerCase()
      ) || (s.allergies && s.allergies.toLowerCase().includes(specificAllergy.toLowerCase()));
      if (!matchSpecific) return false;
    }

    return true;
  });

  // Filter parents
  const filteredParents = parents.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  // Summary counts
  const totalStudentsCount = students.length;
  const allergyRecordedCount = students.filter(
    (s) => s.allergyAlertState === 'ALLERGY_RECORDED' || s.allergyAlertState === 'CONFLICT_DETECTED'
  ).length;
  const conflictDetectedCount = students.filter(
    (s) => s.allergyAlertState === 'CONFLICT_DETECTED'
  ).length;

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
              Student Directory & Health Registry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-purple-600" />
            <span>Students & Dietary Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor registered student allergies, conflict warnings, parent meal accounts, and classroom rosters.
          </p>
        </div>

        {/* View Switcher: Students Table vs Parents */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'students'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Students & Allergies ({totalStudentsCount})
          </button>
          <button
            onClick={() => setActiveTab('parents')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'parents'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Parent Wallets ({parents.length})
          </button>
        </div>
      </div>

      {/* Metric Badges Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Enrolled</span>
            <p className="text-2xl font-black text-slate-900">{totalStudentsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allergies Recorded</span>
            <p className="text-2xl font-black text-amber-700">{allergyRecordedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Conflicts</span>
            <p className="text-2xl font-black text-rose-700">{conflictDetectedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {activeTab === 'students' ? (
        <div className="space-y-6">
          {/* Allergy Filters & Search Bar (Requirement 16) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-purple-600" />
                <span>Filter by Allergy Status</span>
              </span>
              <button
                onClick={() => {
                  setSearch('');
                  setAllergyFilter('ALL');
                  setSpecificAllergy('');
                  setGradeFilter('');
                }}
                className="text-purple-600 hover:underline font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Student name, ID, parent..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Allergy State Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Allergy Status</label>
                <select
                  value={allergyFilter}
                  onChange={(e: any) => setAllergyFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                >
                  <option value="ALL">All Students ({students.length})</option>
                  <option value="HAS_ALLERGIES">Has Allergies ({allergyRecordedCount})</option>
                  <option value="NO_ALLERGIES">No Known Allergies ({students.length - allergyRecordedCount})</option>
                </select>
              </div>

              {/* Specific Allergy Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Specific Allergen</label>
                <select
                  value={specificAllergy}
                  onChange={(e) => setSpecificAllergy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                >
                  <option value="">Any Allergen</option>
                  {ALLERGY_FILTERS.map((alg) => (
                    <option key={alg} value={alg}>
                      {alg}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class / Grade</label>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                >
                  <option value="">All Classes</option>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => (
                    <option key={g} value={g}>
                      Class {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ADMIN STUDENT TABLE (Requirement 6 & 7) */}
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3 max-w-md mx-auto">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Students Found</h3>
              <p className="text-xs text-slate-500">No students match the selected allergy or class filters.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
              {/* Responsive Table Container with Horizontal Scroll */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-12 text-center">Profile</th>
                      <th className="py-3.5 px-4">Student Name</th>
                      <th className="py-3.5 px-3">Class</th>
                      <th className="py-3.5 px-3">Division</th>
                      <th className="py-3.5 px-3">Roll No</th>
                      <th className="py-3.5 px-4">Dietary Type</th>
                      <th className="py-3.5 px-4">Allergies</th>
                      <th className="py-3.5 px-4">Allergy Alert</th>
                      <th className="py-3.5 px-3 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((st) => {
                      const allergies = st.allergiesList || (st.allergies ? st.allergies.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean) : []);
                      const hasAllergies = allergies.length > 0 && !allergies.includes('None');

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Profile (Generic Neutral Avatar - Requirement 1) */}
                          <td className="py-3.5 px-4 text-center">
                            <ChildAvatar size="sm" />
                          </td>

                          {/* Student Name */}
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{st.name}</span>
                              <VegBadge isVegetarian={st.isVegetarian} size="sm" />
                            </div>
                            <span className="text-[10px] font-mono font-medium text-slate-400 block">
                              {st.studentId}
                            </span>
                          </td>

                          {/* Class */}
                          <td className="py-3.5 px-3 font-extrabold text-slate-800">{st.grade}</td>

                          {/* Division */}
                          <td className="py-3.5 px-3 font-extrabold text-slate-800">{st.division}</td>

                          {/* Roll Number */}
                          <td className="py-3.5 px-3 font-mono text-slate-700 font-bold">{st.rollNo}</td>

                          {/* Dietary Type */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {st.dietaryType}
                            </span>
                          </td>

                          {/* Allergies (Requirement 6) */}
                          <td className="py-3.5 px-4">
                            {hasAllergies ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {allergies.map((alg: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-rose-50 text-rose-700 font-extrabold text-[10px] rounded-md border border-rose-200"
                                  >
                                    {alg}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-medium">
                                No known allergies
                              </span>
                            )}
                          </td>

                          {/* Allergy Alert Column (Requirement 7: 3 states) */}
                          <td className="py-3.5 px-4">
                            {st.allergyAlertState === 'CONFLICT_DETECTED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 text-rose-800 font-black text-[11px] rounded-full border border-rose-300 animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-rose-600" />
                                <span>🔴 Meal conflict detected</span>
                              </span>
                            ) : st.allergyAlertState === 'ALLERGY_RECORDED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 font-extrabold text-[11px] rounded-full border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>⚠ Allergy recorded</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold text-[11px] rounded-full border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>✓ No allergy recorded</span>
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                st.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {st.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedStudent(st)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-purple-50 text-purple-700 rounded-xl font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PARENTS LIST VIEW */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredParents.map((parent) => (
              <div
                key={parent.id}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-2xs space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">{parent.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
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
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Meal Wallet</span>
                    <span className="font-black text-emerald-700 text-base">{formatINR(parent.walletBalance)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Children Registered ({parent.students?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {parent.students?.map((ch: any) => (
                      <div
                        key={ch.id}
                        className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-2 text-xs"
                      >
                        <ChildAvatar size="xs" />
                        <span className="font-bold text-slate-800">{ch.name}</span>
                        <span className="text-slate-400">({ch.grade}-{ch.division})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STUDENT PROFILE VIEW MODAL (Requirement 11) */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 space-y-5 text-center">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                School Student Details
              </span>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Circular generic neutral avatar */}
            <div className="flex justify-center">
              <ChildAvatar size="xl" className="ring-4 ring-purple-200 shadow-md" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <h3 className="text-xl font-extrabold text-slate-900">{selectedStudent.name}</h3>
                <VegBadge isVegetarian={selectedStudent.isVegetarian} size="md" />
              </div>
              <p className="font-mono text-xs font-bold text-purple-700">{selectedStudent.studentId}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl text-xs">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Class</p>
                <p className="font-extrabold text-slate-800">{selectedStudent.grade}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Division</p>
                <p className="font-extrabold text-slate-800">{selectedStudent.division}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Roll No</p>
                <p className="font-extrabold text-slate-800">{selectedStudent.rollNo}</p>
              </div>
            </div>

            {/* Structured Profile Info */}
            <div className="space-y-2.5 text-left text-xs bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Diet</span>
                <span className="font-bold text-slate-800">{selectedStudent.dietaryType}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Allergies</span>
                {selectedStudent.allergies && selectedStudent.allergies !== 'None' ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedStudent.allergies.split(/[,;]/).map((alg: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[11px] rounded-md border border-rose-200"
                      >
                        ⚠ {alg.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> No known allergies
                  </span>
                )}
              </div>

              {selectedStudent.dietaryRestrictions && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Dietary Restrictions</span>
                  <span className="text-slate-800 font-medium">{selectedStudent.dietaryRestrictions}</span>
                </div>
              )}

              {selectedStudent.notes && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Notes</span>
                  <span className="text-slate-700 italic">{selectedStudent.notes}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Parent Contact</span>
                <p className="font-bold text-slate-800">{selectedStudent.parentName}</p>
                <p className="text-slate-500 text-[11px]">{selectedStudent.parentPhone || selectedStudent.parentEmail}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedStudent(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
            >
              Close Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
