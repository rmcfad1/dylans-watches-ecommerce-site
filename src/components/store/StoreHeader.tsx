"use client";

import Link from "next/link";
import { ShoppingCart, Watch } from "lucide-react";
import { useCart } from "@/lib/cart";

export default function StoreHeader() {
  const { count } = useCart();

  return (
    <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/shop" className="flex items-center gap-2 font-bold text-gray-900 text-lg">
          <Watch className="w-5 h-5 text-amber-500" />
          Dylan&apos;s Watches
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
          <Link href="/shop" className="hover:text-gray-900 transition-colors">Shop</Link>
        </nav>

        <Link href="/cart" className="relative flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors">
          <ShoppingCart className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {count}
            </span>
          )}
          <span className="text-sm hidden sm:inline">Cart</span>
        </Link>
      </div>
    </header>
  );
}
