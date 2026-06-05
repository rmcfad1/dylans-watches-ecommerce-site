"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart, ArrowLeft, Check } from "lucide-react";
import { useCart } from "@/lib/cart";
import Badge from "@/components/ui/Badge";
import Link from "next/link";

interface Product {
  id: string;
  title: string;
  shopTitle: string | null;
  shopPrice: number | null;
  description: string | null;
  condition: string;
  category: string;
  brand: string | null;
  model: string | null;
  images: string;
  status: string;
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { add, items: cartItems } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (id) {
      fetch(`/api/inventory/${id}`).then((r) => r.json()).then((data) => {
        if (!data.shopEnabled || data.status !== "available") {
          router.push("/shop");
        } else {
          setProduct(data);
        }
      });
    }
  }, [id, router]);

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center text-gray-400">
        Loading…
      </div>
    );
  }

  const images: string[] = JSON.parse(product.images || "[]");
  const inCart = cartItems.some((i) => i.id === product.id);
  const displayTitle = product.shopTitle ?? product.title;

  function handleAdd() {
    add({
      id: product!.id,
      title: displayTitle,
      price: product!.shopPrice ?? 0,
      image: images[0] ?? "",
      condition: product!.condition,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Shop
      </Link>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Images */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-3">
            {images[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[activeImage]} alt={displayTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-7xl">⌚</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    activeImage === i ? "border-amber-500" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start gap-3 mb-2">
            <Badge status={product.condition} />
            <Badge status={product.category} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayTitle}</h1>
          {product.brand && (
            <p className="text-gray-500 text-sm mb-4">{product.brand} {product.model}</p>
          )}

          <p className="text-3xl font-bold text-gray-900 mb-6">
            ${product.shopPrice?.toFixed(2) ?? "—"}
          </p>

          {product.description && (
            <p className="text-gray-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
              {product.description}
            </p>
          )}

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 mb-6 space-y-1.5">
            <p>✓ Tested &amp; verified working</p>
            <p>✓ Ships within 1–2 business days</p>
            <p>✓ Secure checkout via Stripe</p>
            <p>✓ Questions? Message us before buying</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={inCart}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors ${
                inCart || justAdded
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
            >
              {inCart || justAdded ? (
                <><Check className="w-5 h-5" /> Added to Cart</>
              ) : (
                <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
              )}
            </button>
            {inCart && (
              <Link
                href="/cart"
                className="flex items-center justify-center px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50"
              >
                View Cart
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
