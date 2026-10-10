'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { StudentData } from '@/types';

interface ChildrenContextType {
  children: StudentData[];
  isLoading: boolean;
  selectedChildId: string;
  setSelectedChildId: (id: string) => void;
  selectedChild: StudentData | undefined;
  refreshChildren: () => Promise<StudentData[]>;
  addChild: (child: StudentData) => void;
  updateChild: (child: StudentData) => void;
  removeChild: (childId: string) => void;
}

const ChildrenContext = createContext<ChildrenContextType | null>(null);

function mapAuthStudentToStudentData(s: any, parentId: string): StudentData {
  const allergiesList = s.allergies
    ? String(s.allergies)
        .split(/[,;]/)
        .map((a: string) => a.trim())
        .filter(Boolean)
    : [];

  return {
    id: s.id,
    parentId,
    name: s.name,
    dob: s.dob || null,
    grade: s.grade,
    division: s.division,
    rollNo: s.rollNo,
    studentId: s.studentId,
    allergies: s.allergies || null,
    allergiesList,
    dietaryRestrictions: s.dietaryRestrictions || null,
    foodPreference: s.foodPreference || null,
    notes: s.notes || null,
    isVegetarian: Boolean(s.isVegetarian),
    profilePhoto: null,
    isActive: s.isActive ?? true,
    allergyAlertStatus: allergiesList.length > 0 ? 'ALLERGY_RECORDED' : 'NO_ALLERGY',
  };
}

export function ChildrenProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const parentId = user?.parentId || '';

  // 1. Instant initialization from user.students already present in AuthContext
  const initialFromAuth = useMemo(() => {
    if (!user?.students || user.students.length === 0) return [];
    return user.students.map((s) => mapAuthStudentToStudentData(s, parentId));
  }, [user?.students, parentId]);

  const [childrenList, setChildrenList] = useState<StudentData[]>(initialFromAuth);
  // If we already have children from auth, we are NOT in an empty loading state
  const [isLoading, setIsLoading] = useState<boolean>(!user || (user.role === 'PARENT' && !user.students));
  const [selectedChildId, setSelectedChildId] = useState<string>(initialFromAuth[0]?.id || '');
  const isFetchingRef = useRef(false);
  const childrenRef = useRef<StudentData[]>(childrenList);
  childrenRef.current = childrenList;
  const fetchedForUserIdRef = useRef<string | null>(null);

  // Sync state if auth user loads later
  useEffect(() => {
    if (initialFromAuth.length > 0) {
      setChildrenList((prev) => {
        // Keep existing if already loaded or newly added in this session
        if (prev.length > 0) return prev;
        return initialFromAuth;
      });
      setSelectedChildId((prev) => prev || initialFromAuth[0]?.id || '');
      setIsLoading(false);
    }
  }, [initialFromAuth]);

  // Fast background fetch from API to ensure relational allergies and latest data
  const refreshChildren = useCallback(async (): Promise<StudentData[]> => {
    if (isFetchingRef.current) return childrenRef.current;
    isFetchingRef.current = true;

    try {
      const res = await fetch('/api/parent/children');
      if (res.ok) {
        const data = await res.json();
        const list: StudentData[] = data.students || [];
        setChildrenList(list);

        if (list.length > 0) {
          setSelectedChildId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev;
            return list[0].id;
          });
        } else {
          setSelectedChildId('');
        }
        setIsLoading(false);
        return list;
      }
    } catch (err) {
      console.error('Failed to refresh children:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
    return childrenRef.current;
  }, []);

  // Fetch once on mount or when user changes
  useEffect(() => {
    if (user?.role === 'PARENT' && user.id && fetchedForUserIdRef.current !== user.id) {
      fetchedForUserIdRef.current = user.id;
      refreshChildren();
    }
  }, [user?.role, user?.id, refreshChildren]);

  // 2. Immediate local state mutations for sub-millisecond perceived speed
  const addChild = useCallback((child: StudentData) => {
    setChildrenList((prev) => {
      const exists = prev.some((c) => c.id === child.id);
      if (exists) return prev;
      return [child, ...prev];
    });
    setSelectedChildId(child.id);
    setIsLoading(false);
  }, []);

  const updateChild = useCallback((child: StudentData) => {
    setChildrenList((prev) => prev.map((c) => (c.id === child.id ? child : c)));
  }, []);

  const removeChild = useCallback((childId: string) => {
    setChildrenList((prev) => {
      const updated = prev.filter((c) => c.id !== childId);
      setSelectedChildId((current) => (current === childId ? updated[0]?.id || '' : current));
      return updated;
    });
  }, []);

  const selectedChild = useMemo(
    () => childrenList.find((c) => c.id === selectedChildId),
    [childrenList, selectedChildId]
  );

  const value = useMemo(
    () => ({
      children: childrenList,
      isLoading,
      selectedChildId,
      setSelectedChildId,
      selectedChild,
      refreshChildren,
      addChild,
      updateChild,
      removeChild,
    }),
    [
      childrenList,
      isLoading,
      selectedChildId,
      selectedChild,
      refreshChildren,
      addChild,
      updateChild,
      removeChild,
    ]
  );

  return <ChildrenContext.Provider value={value}>{children}</ChildrenContext.Provider>;
}

export function useChildren() {
  const context = useContext(ChildrenContext);
  if (!context) {
    throw new Error('useChildren must be used within a ChildrenProvider');
  }
  return context;
}
