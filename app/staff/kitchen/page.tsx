'use client';

import StudentMenuEditor from '@/components/StudentMenuEditor';
import { useAuth } from '@/components/AuthContext';

/** Staff → Student Menu: what parents can order each day, changed in one or two taps. */
export default function StaffStudentMenuPage() {
  const { user } = useAuth();
  return <StudentMenuEditor isAdmin={user?.role === 'ADMIN'} />;
}
