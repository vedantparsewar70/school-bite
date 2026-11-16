'use client';

import StudentMenuEditor from '@/components/StudentMenuEditor';

/** Admin → Menu: the same Student Menu editor as staff (same rules), plus Delete in the Dishes tab. */
export default function AdminMenuPage() {
  return <StudentMenuEditor isAdmin />;
}
