'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Directly redirect from redundant checkout summary page to the cart page
    router.replace('/parent/cart');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      <p className="text-sm text-slate-500 font-medium">Redirecting to your cart...</p>
    </div>
  );
}
