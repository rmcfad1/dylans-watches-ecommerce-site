"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useCart } from "@/lib/cart";

export default function CheckoutSuccess() {
  const { clear } = useCart();

  useEffect(() => {
    clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Order Confirmed!</h1>
      <p className="text-gray-500 mb-2">
        Thank you for your purchase. You&apos;ll receive a confirmation email shortly.
      </p>
      <p className="text-gray-400 text-sm mb-8">
        Orders typically ship within 1–2 business days. We&apos;ll send tracking info once your item is on the way.
      </p>
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
