"use client";

import Link from "next/link";
import { ShoppingBag, Watch } from "lucide-react";
import { useCart } from "@/lib/cart";

export default function StoreHeader() {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/60">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/shop" className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-base tracking-tight">
          <Watch className="w-4 h-4 text-amber-500" />
          Dylan&apos;s Watches
        </Link>

        <nav className="hidden sm:flex items-center gap-8 text-sm text-[#6e6e73]">
          <Link href="/shop" className="hover:text-[#1d1d1f] transition-colors">Shop</Link>
        </nav>

        <Link href="/cart" className="relative flex items-center gap-1.5 text-[#1d1d1f] hover:text-amber-500 transition-colors">
          <ShoppingBag className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
