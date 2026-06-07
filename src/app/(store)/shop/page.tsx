"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

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

function ConditionDot({ condition }: { condition: string }) {
  const c = condition.toLowerCase();
  const color = c.includes("new") ? "bg-green-500" : c.includes("good") ? "bg-amber-400" : "bg-gray-400";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} mr-1.5`} />;
}

function ShopContent() {
  const { add, items: cartItems } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/inventory?shop=1`).then((r) => r.json()).then(setProducts);
  }, []);

  function handleAdd(e: React.MouseEvent, product: Product) {
    e.preventDefault();
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
    <div>
      {/* Hero */}
      <section className="bg-[#f5f5f7] py-24 px-6 text-center">
        <p className="text-sm font-medium text-amber-500 uppercase tracking-widest mb-3">Dylan&apos;s Watches</p>
        <h1 className="text-5xl sm:text-6xl font-semibold text-[#1d1d1f] tracking-tight mb-4">
          Certified pre-owned.
        </h1>
        <p className="text-xl text-[#6e6e73] max-w-xl mx-auto font-light">
          Every watch and device tested, verified, and ready to wear.
        </p>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        {products.length === 0 ? (
          <div className="text-center py-32 text-[#6e6e73]">
            <p className="text-xl font-light">No items available right now.</p>
            <p className="text-sm mt-2">Check back soon — new inventory drops regularly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200">
            {products.map((product) => {
              const isAdded = added === product.id || inCart(product.id);
              return (
                <Link
                  key={product.id}
                  href={`/shop/${product.id}`}
                  className="group bg-white flex flex-col hover:bg-[#f5f5f7] transition-colors duration-200"
                >
                  {/* Image */}
                  <div className="aspect-square overflow-hidden bg-[#f5f5f7]">
                    {product.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">⌚</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-6 flex flex-col flex-1">
                    <p className="text-xs text-[#6e6e73] mb-1 flex items-center">
                      <ConditionDot condition={product.condition} />
                      {product.condition}
                      {product.freeShipping && <span className="ml-2 text-amber-500">· Free shipping</span>}
                    </p>
                    <h2 className="text-base font-semibold text-[#1d1d1f] leading-snug mb-1 line-clamp-2 group-hover:text-amber-500 transition-colors">
                      {product.title}
                    </h2>
                    {product.brand && (
                      <p className="text-sm text-[#6e6e73] mb-4">{product.brand}{product.model ? ` ${product.model}` : ""}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <p className="text-lg font-semibold text-[#1d1d1f]">
                        ${product.shopPrice?.toFixed(2) ?? "—"}
                      </p>
                      <button
                        onClick={(e) => handleAdd(e, product)}
                        disabled={inCart(product.id)}
                        className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-full font-medium transition-all ${
                          isAdded
                            ? "bg-green-100 text-green-700"
                            : "bg-[#1d1d1f] text-white hover:bg-amber-500"
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {isAdded ? "Added" : "Add"}
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Trust bar */}
      <section className="border-t border-gray-200 bg-[#f5f5f7]">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            { title: "Tested & verified", body: "Every item inspected before listing." },
            { title: "Secure checkout", body: "Powered by Stripe. All major cards accepted." },
            { title: "Ships in 1–2 days", body: "Fast dispatch from West Jordan, UT." },
          ].map((item) => (
            <div key={item.title}>
              <p className="text-sm font-semibold text-[#1d1d1f] mb-1">{item.title}</p>
              <p className="text-sm text-[#6e6e73]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
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
