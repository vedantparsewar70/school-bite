import React from 'react';

interface MealCategoryBadgeProps {
  category: string;
  className?: string;
  size?: 'sm' | 'md';
}

const CATEGORY_STYLES: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  BREAKFAST: {
    dot: 'bg-amber-500',
    text: 'text-amber-800',
    bg: 'bg-amber-50/80',
    border: 'border-amber-200/80',
  },
  LUNCH: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-800',
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-200/80',
  },
  SNACK: {
    dot: 'bg-purple-500',
    text: 'text-purple-800',
    bg: 'bg-purple-50/80',
    border: 'border-purple-200/80',
  },
  BEVERAGE: {
    dot: 'bg-sky-500',
    text: 'text-sky-800',
    bg: 'bg-sky-50/80',
    border: 'border-sky-200/80',
  },
};

export default function MealCategoryBadge({
  category,
  className = '',
  size = 'sm',
}: MealCategoryBadgeProps) {
  const norm = (category || 'LUNCH').toUpperCase().trim();
  // normalize snacks -> SNACK
  const catKey = norm.startsWith('SNACK') ? 'SNACK' : norm;
  const style = CATEGORY_STYLES[catKey] || CATEGORY_STYLES.LUNCH;

  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-extrabold uppercase tracking-wider rounded-md border ${style.bg} ${style.border} ${style.text} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
      <span>{norm}</span>
    </span>
  );
}
