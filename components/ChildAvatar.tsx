import React from 'react';
import { User } from 'lucide-react';

interface ChildAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
  '2xl': 'w-24 h-24',
};

const iconSizes = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
  '2xl': 'w-12 h-12',
};

/**
 * Standard generic empty child avatar (neutral circular silhouette)
 * No photographic imagery allowed.
 */
export default function ChildAvatar({ size = 'md', className = '' }: ChildAvatarProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-slate-200 border border-slate-300/80 text-slate-500 shadow-2xs select-none shrink-0 overflow-hidden ${sizeClasses[size]} ${className}`}
      aria-label="Student Avatar"
    >
      <User className={`${iconSizes[size]} text-slate-400 fill-slate-400/40`} />
    </div>
  );
}
