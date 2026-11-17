/**
 * A child's menu category (the school serves one brunch per category per day).
 * Safe for client components: no server imports.
 */

export const STUDENT_CATEGORIES = ['Pre-primary', 'Primary', 'Secondary'] as const;
export type StudentCategory = (typeof STUDENT_CATEGORIES)[number];

/** Normalizes an explicit category, or else a grade ("UKG", "3", "Std 7"), to a StudentCategory. */
export function getStudentCategory(grade?: string | null, explicitCategory?: string | null): StudentCategory {
  if (explicitCategory) {
    const clean = explicitCategory.trim().toLowerCase();
    if (clean.includes('pre')) return 'Pre-primary';
    if (clean.includes('secondary')) return 'Secondary';
    if (clean.includes('primary')) return 'Primary';
  }

  if (!grade) return 'Primary';
  const g = grade.trim().toLowerCase();

  // Kindergarten / Nursery / Pre-primary
  if (
    g.includes('nursery') ||
    g.includes('kg') ||
    g.includes('lkg') ||
    g.includes('ukg') ||
    g.includes('pre') ||
    g.includes('kindergarten') ||
    g === '0'
  ) {
    return 'Pre-primary';
  }

  const num = parseInt(g.replace(/\D/g, ''), 10);
  if (!isNaN(num)) {
    return num <= 5 ? 'Primary' : 'Secondary';
  }

  return 'Primary';
}
