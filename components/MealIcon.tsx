import React from 'react';

interface MealIconProps {
  name: string;
  category?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeConfig = {
  sm: { container: 'w-10 h-10 rounded-xl', svg: 24 },
  md: { container: 'w-14 h-14 rounded-2xl', svg: 32 },
  lg: { container: 'w-18 h-18 sm:w-20 sm:h-20 rounded-2xl', svg: 44 },
  xl: { container: 'w-24 h-24 rounded-3xl', svg: 56 },
};

export default function MealIcon({ name, category, size = 'md', className = '' }: MealIconProps) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();
  const cfg = sizeConfig[size];

  // Helper SVG renderer based on dish name keyword
  const renderIllustration = () => {
    if (n.includes('idli')) {
      // Idli + Sambar
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Sambar bowl */}
          <rect x="24" y="22" width="18" height="12" rx="6" fill="#F59E0B" />
          <ellipse cx="33" cy="22" rx="9" ry="3" fill="#D97706" />
          {/* Two Idlis */}
          <ellipse cx="18" cy="28" rx="12" ry="8" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5" />
          <ellipse cx="18" cy="20" rx="11" ry="7" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Steam wisps */}
          <path d="M15 11C15 8 18 8 18 5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M21 12C21 9 24 9 24 6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    }

    if (n.includes('dosa')) {
      // Crispy Dosa roll + Chutney bowls
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Chutney bowls */}
          <circle cx="12" cy="18" r="5" fill="#10B981" />
          <circle cx="12" cy="30" r="5" fill="#EF4444" />
          {/* Dosa cylinder */}
          <rect x="18" y="14" width="24" height="20" rx="6" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />
          <line x1="24" y1="16" x2="24" y2="32" stroke="#B45309" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="30" y1="16" x2="30" y2="32" stroke="#B45309" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="36" y1="16" x2="36" y2="32" stroke="#B45309" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      );
    }

    if (n.includes('poha')) {
      // Poha bowl with lemon
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bowl */}
          <path d="M8 24C8 34 16 38 24 38C32 38 40 34 40 24H8Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
          {/* Poha Mound */}
          <ellipse cx="24" cy="22" rx="15" ry="5" fill="#FDE047" />
          <circle cx="20" cy="21" r="1.5" fill="#B45309" />
          <circle cx="28" cy="22" r="1.5" fill="#B45309" />
          <circle cx="24" cy="20" r="1" fill="#15803D" />
          {/* Lemon Wedge */}
          <path d="M30 14L37 18C37 18 36 14 30 14Z" fill="#84CC16" />
        </svg>
      );
    }

    if (n.includes('paneer') || n.includes('curry')) {
      // Paneer bowl with cubes
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bowl */}
          <path d="M9 22C9 33 17 38 24 38C31 38 39 33 39 22H9Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Curry gravy */}
          <ellipse cx="24" cy="22" rx="14" ry="4.5" fill="#EA580C" />
          {/* Paneer cubes */}
          <rect x="16" y="18" width="6" height="5" rx="1" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="1" />
          <rect x="25" y="17" width="6" height="5" rx="1" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="1" />
          {/* Coriander leaf */}
          <circle cx="24" cy="21" r="1.5" fill="#22C55E" />
        </svg>
      );
    }

    if (n.includes('rice') || n.includes('biryani') || n.includes('khichdi') || n.includes('dal')) {
      // Rice / Biryani bowl
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bowl */}
          <path d="M9 23C9 34 16 38 24 38C32 38 39 34 39 23H9Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
          {/* Steaming Rice Mound */}
          <ellipse cx="24" cy="22" rx="14" ry="6" fill="#FEF08A" />
          <path d="M14 22C14 17 34 17 34 22" fill="#FEF9C3" />
          <circle cx="21" cy="19" r="1" fill="#15803D" />
          <circle cx="27" cy="18" r="1" fill="#EA580C" />
          {/* Steam */}
          <path d="M21 11C21 8 23 8 23 5" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M27 12C27 9 29 9 29 6" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    }

    if (n.includes('roti') || n.includes('chapati') || n.includes('paratha') || n.includes('thepla')) {
      // Chapati / Flatbreads stack
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bottom Roti */}
          <ellipse cx="24" cy="28" rx="14" ry="8" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5" />
          {/* Top Roti */}
          <ellipse cx="23" cy="22" rx="13" ry="7.5" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.5" />
          {/* Toasted spots */}
          <circle cx="18" cy="21" r="1" fill="#92400E" />
          <circle cx="26" cy="20" r="1.2" fill="#92400E" />
          <circle cx="22" cy="24" r="1" fill="#92400E" />
          {/* Butter cube on top */}
          <rect x="25" y="17" width="5" height="4" rx="1" fill="#FACC15" />
        </svg>
      );
    }

    if (n.includes('pasta') || n.includes('noodle') || n.includes('macaroni')) {
      // Pasta bowl with fork
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bowl */}
          <path d="M10 24C10 34 17 38 24 38C31 38 38 34 38 24H10Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Red Sauce & Pasta swirls */}
          <ellipse cx="24" cy="23" rx="13" ry="5" fill="#EF4444" />
          <path d="M16 23C18 20 22 20 24 23C26 20 30 20 32 23" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="19" r="1.5" fill="#16A34A" />
        </svg>
      );
    }

    if (n.includes('fruit') || n.includes('salad') || n.includes('apple')) {
      // Fruit bowl
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bowl */}
          <path d="M11 25C11 34 17 38 24 38C31 38 37 34 37 25H11Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Apple & orange slices */}
          <circle cx="20" cy="20" r="6" fill="#EF4444" />
          <path d="M21 14C21 12 23 11 23 11" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 18C28 17 32 20 32 24H25V18Z" fill="#F97316" />
          <circle cx="23" cy="25" r="3" fill="#84CC16" />
        </svg>
      );
    }

    if (n.includes('sandwich') || n.includes('toast') || n.includes('burger')) {
      // Sandwich
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bread slice bottom */}
          <path d="M12 30L24 16L36 30H12Z" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5" />
          {/* Green lettuce layer */}
          <line x1="14" y1="28" x2="34" y2="28" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
          {/* Tomato / cheese filling */}
          <line x1="16" y1="25" x2="32" y2="25" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }

    if (c === 'beverage' || n.includes('juice') || n.includes('milk') || n.includes('drink') || n.includes('smoothie')) {
      // Beverage glass with straw
      return (
        <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Straw */}
          <path d="M26 8L30 18H28" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
          {/* Glass */}
          <path d="M16 16L18 36C18 38 21 39 24 39C27 39 30 38 30 36L32 16H16Z" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.5" />
          {/* Liquid */}
          <path d="M17 22L19 35C19 36 21 37 24 37C27 37 29 36 29 35L31 22H17Z" fill="#38BDF8" fillOpacity="0.4" />
        </svg>
      );
    }

    // Default General Canteen Plate / Cloche
    return (
      <svg viewBox="0 0 48 48" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="16" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="11" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="5" fill="#F59E0B" />
        <circle cx="21" cy="21" r="1.5" fill="#FFFFFF" />
      </svg>
    );
  };

  return (
    <div
      className={`inline-flex items-center justify-center bg-white border border-slate-200/90 shadow-2xs shrink-0 select-none overflow-hidden ${cfg.container} ${className}`}
      aria-label={`Illustration of ${name}`}
    >
      {renderIllustration()}
    </div>
  );
}
