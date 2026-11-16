'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem } from '@/types';
import { useAuth } from '@/components/AuthContext';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'cartItemId'>) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType>({
  cartItems: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  subtotal: 0,
});

const CART_STORAGE_KEY = 'schoolbite_cart';
const CART_OWNER_STORAGE_KEY = 'schoolbite_cart_owner';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY) || localStorage.getItem('nutribox_school_cart');
      if (saved) {
        setCartItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load cart from storage:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
      } catch (e) {
        console.error('Failed to persist cart to storage:', e);
      }
    }
  }, [cartItems, isLoaded]);

  // A cart belongs to the account that filled it: on a shared phone, the next parent who signs in
  // must not see (or try to pay for) the previous parent's children and meals. Checked once per
  // signed-in account, while rendering, so the old cart is never shown.
  const [checkedOwnerId, setCheckedOwnerId] = useState<string | null>(null);
  if (isLoaded && user?.id && user.id !== checkedOwnerId) {
    setCheckedOwnerId(user.id);
    let owner: string | null = null;
    try {
      owner = localStorage.getItem(CART_OWNER_STORAGE_KEY);
    } catch {
      // storage unavailable: nothing persisted to leak
    }
    if (owner && owner !== user.id) setCartItems([]);
  }

  useEffect(() => {
    if (!checkedOwnerId) return;
    try {
      if (localStorage.getItem(CART_OWNER_STORAGE_KEY) !== checkedOwnerId) {
        localStorage.removeItem('sb_checkout_key');
        localStorage.setItem(CART_OWNER_STORAGE_KEY, checkedOwnerId);
      }
    } catch {
      // ignore
    }
  }, [checkedOwnerId]);

  const addToCart = (item: Omit<CartItem, 'cartItemId'>) => {
    // An extra has its own line, even if the same dish were also a brunch.
    const key = `${item.studentId}-${item.mealId}-${item.date}${item.kind === 'EXTRA' ? '-extra' : ''}`;
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.cartItemId === key);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: updated[idx].quantity + (item.quantity || 1),
        };
        return updated;
      } else {
        return [...prev, { ...item, cartItemId: key, quantity: item.quantity || 1 }];
      }
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems((prev) => {
      const removed = prev.find((i) => i.cartItemId === cartItemId);
      // Extras go with the brunch: removing a child's brunch for a day removes that day's extras too.
      const dropExtras = removed && removed.kind !== 'EXTRA';
      return prev.filter(
        (i) =>
          i.cartItemId !== cartItemId &&
          !(dropExtras && i.kind === 'EXTRA' && i.studentId === removed!.studentId && i.date === removed!.date)
      );
    });
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalItems = cartItems.reduce((acc, it) => acc + it.quantity, 0);
  const subtotal = cartItems.reduce((acc, it) => acc + it.mealPrice * it.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
