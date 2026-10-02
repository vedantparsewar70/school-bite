import React from 'react';

interface VegBadgeProps {
  isVegetarian: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function VegBadge({ isVegetarian, size = 'sm', showLabel = false }: VegBadgeProps) {
  const dim = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6';
  const dotDim = size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span className="inline-flex items-center gap-1.5" title={isVegetarian ? 'Pure Vegetarian' : 'Non-Vegetarian'}>
      <span
        className={`${dim} rounded-xs border-2 flex items-center justify-center p-0.5 ${
          isVegetarian ? 'border-emerald-600 bg-emerald-50/50' : 'border-rose-600 bg-rose-50/50'
        }`}
      >
        <span
          className={`${dotDim} rounded-full ${isVegetarian ? 'bg-emerald-600' : 'bg-rose-600'}`}
        />
      </span>
      {showLabel && (
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            isVegetarian ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {isVegetarian ? 'Pure Veg' : 'Non-Veg'}
        </span>
      )}
    </span>
  );
}
