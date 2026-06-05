"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface CartItem {
  id: string;          // inventoryItem id
  title: string;
  price: number;
  image: string;
  condition: string;
}

interface CartContext {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
  total: number;
}

const CartCtx = createContext<CartContext>({
  items: [], add: () => {}, remove: () => {}, clear: () => {}, count: 0, total: 0,
});

const STORAGE_KEY = "dylans-watches-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const persist = (next: CartItem[]) => {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      if (prev.find((i) => i.id === item.id)) return prev;
      const next = [...prev, item];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    persist(items.filter((i) => i.id !== id));
  }, [items]);

  const clear = useCallback(() => {
    persist([]);
  }, []);

  return (
    <CartCtx.Provider value={{
      items,
      add,
      remove,
      clear,
      count: items.length,
      total: items.reduce((s, i) => s + i.price, 0),
    }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);
