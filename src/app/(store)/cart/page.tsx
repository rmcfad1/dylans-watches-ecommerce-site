"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Loader2, ShoppingBag, ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart";

export default function CartPage() {
  const { items, remove, total } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
        <ShoppingBag className="w-10 h-10 text-gray-300 mb-5" />
        <h1 className="text-2xl font-semibold text-[#1d1d1f] mb-2">Your bag is empty.</h1>
        <p className="text-[#6e6e73] text-sm mb-8">Add something special to get started.</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white px-6 py-3 rounded-full font-medium text-sm hover:bg-amber-500 transition-colors"
        >
          Browse Shop
        </Link>
      </div>
    );
  }

  const allFreeShipping = items.every((i) => i.freeShipping);
  const shippingDisplay = allFreeShipping ? "Free" : "Calculated at checkout";
  const estimatedTotal = allFreeShipping ? total : total + 5.99;
  const estimatedSuffix = allFreeShipping ? "" : "+";

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors mb-10">
        <ArrowLeft className="w-3.5 h-3.5" /> Continue Shopping
      </Link>

      <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mb-10">Your Bag</h1>

      {/* Line items */}
      <div className="divide-y divide-gray-100 mb-10">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-5 py-6">
            <div className="w-20 h-20 rounded-2xl bg-[#f5f5f7] overflow-hidden flex-shrink-0">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">⌚</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#1d1d1f] text-sm leading-snug">{item.title}</p>
              <p className="text-xs text-[#6e6e73] mt-1">{item.condition} · 1 item</p>
              {item.freeShipping && (
                <p className="text-xs text-amber-500 mt-0.5">Free Shipping</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <p className="font-semibold text-[#1d1d1f]">${item.price.toFixed(2)}</p>
              <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Order summary */}
      <div className="bg-[#f5f5f7] rounded-3xl p-6 mb-6 space-y-3 text-sm">
        <div className="flex justify-between text-[#6e6e73]">
          <span>Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[#6e6e73]">
          <span>Shipping</span>
          <span className={allFreeShipping ? "text-amber-500 font-medium" : ""}>{shippingDisplay}</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-[#1d1d1f] text-base">
          <span>Estimated Total</span>
          <span>${estimatedTotal.toFixed(2)}{estimatedSuffix}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl px-4 py-3 mb-4">
          {error === "Stripe not configured"
            ? "Checkout is not yet configured. Add your Stripe keys in Settings."
            : error}
        </div>
      )}

      <button
        onClick={checkout}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#1d1d1f] text-white py-4 rounded-full font-semibold text-base hover:bg-amber-500 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        {loading ? "Redirecting…" : "Check Out"}
      </button>

      <p className="text-xs text-center text-[#6e6e73] mt-4">
        Secure checkout powered by Stripe · All major cards accepted
      </p>
    </div>
  );
}
