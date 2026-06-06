"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Loader2, ShoppingBag } from "lucide-react";
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
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-6 text-sm">Add some items to get started.</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
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
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Your Cart</h1>

      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="w-16 h-16 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">⌚</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{item.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.condition} condition · 1 item</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-gray-900">${item.price.toFixed(2)}</p>
              <button
                onClick={() => remove(item.id)}
                className="text-gray-300 hover:text-red-500 transition-colors mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Shipping</span>
          <span className={allFreeShipping ? "text-green-600 font-medium" : "text-gray-400"}>
            {shippingDisplay}
          </span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900 text-base">
          <span>Estimated Total</span>
          <span>${estimatedTotal.toFixed(2)}{estimatedSuffix}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error === "Stripe not configured"
            ? "Checkout is not yet configured. Add your Stripe keys in Settings."
            : error}
        </div>
      )}

      <button
        onClick={checkout}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl font-semibold text-base transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        {loading ? "Redirecting to checkout…" : "Checkout with Stripe →"}
      </button>

      <p className="text-xs text-center text-gray-400 mt-3">
        Secure checkout powered by Stripe · All major cards accepted
      </p>
    </div>
  );
}
