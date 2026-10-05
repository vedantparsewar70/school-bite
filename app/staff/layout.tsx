'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import StaffMobileBottomNav from '@/components/StaffMobileBottomNav';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login?role=staff');
      } else if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
        router.replace('/parent/dashboard');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased pb-20 md:pb-8">
      {children}
      <StaffMobileBottomNav />
    </div>
  );
}
