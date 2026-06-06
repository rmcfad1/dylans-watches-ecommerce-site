"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import Badge from "@/components/ui/Badge";
import { Suspense } from "react";

interface Product {
  id: string;
  listingId: string;
  title: string;
  shopPrice: number | null;
  condition: string;
  category: string;
  brand: string | null;
  model: string | null;
  images: string[];
  description: string | null;
  freeShipping: boolean;
}

function ShopContent() {
  const { add, items: cartItems } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/inventory?shop=1`).then((r) => r.json()).then(setProducts);
  }, []);

  function handleAdd(product: Product) {
    add({
      id: product.id,
      title: product.title,
      price: product.shopPrice ?? 0,
      image: product.images[0] ?? "",
      condition: product.condition,
      freeShipping: product.freeShipping ?? false,
    });
    setAdded(product.id);
    setTimeout(() => setAdded(null), 1500);
  }

  const inCart = (id: string) => cartItems.some((i) => i.id === id);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Shop</h1>
        <p className="text-gray-500">Certified used watches &amp; electronics — tested and ready to wear.</p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg">No items available right now.</p>
          <p className="text-sm mt-1">Check back soon — new inventory drops regularly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products.map((product) => {
            const isAdded = added === product.id || inCart(product.id);
            return (
              <div key={product.id} className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col group cursor-pointer">
                <Link href={`/shop/${product.id}`} className="absolute inset-0 z-10" aria-label={product.title} />
                <div className="aspect-square bg-gray-50 overflow-hidden">
                  {product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">⌚</div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-amber-600 line-clamp-2">
                      {product.title}
                    </p>
                    <Badge status={product.condition} className="relative z-20 shrink-0" />
                  </div>
                  {product.brand && (
                    <p className="text-xs text-gray-400 mb-3">{product.brand} {product.model}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between">
                    <p className="text-lg font-bold text-gray-900">${product.shopPrice?.toFixed(2) ?? "—"}</p>
                    <button
                      onClick={(e) => { e.preventDefault(); handleAdd(product); }}
                      disabled={inCart(product.id)}
                      className={`relative z-20 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        isAdded
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-500 hover:bg-amber-600 text-white"
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {isAdded ? "Added" : "Add to Cart"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense>
      <ShopContent />
    </Suspense>
  );
}
