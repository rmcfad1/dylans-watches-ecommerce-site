"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShoppingBag, ArrowLeft, Check, Truck, Shield, Zap } from "lucide-react";
import { useCart } from "@/lib/cart";
import Link from "next/link";
import { trackPixel } from "@/components/store/MetaPixel";

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
  freeShipping: boolean;
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
        if (!data.shopEnabled || !["available", "listed"].includes(data.status)) {
          router.push("/shop");
        } else {
          setProduct(data);
          trackPixel("ViewContent", {
            content_ids: [data.id],
            content_type: "product",
            content_name: data.shopTitle ?? data.title,
            value: data.shopPrice ?? 0,
            currency: "USD",
          });
        }
      });
    }
  }, [id, router]);

  if (!product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-[#6e6e73] text-sm">
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
      freeShipping: product!.freeShipping ?? false,
    });
    trackPixel("AddToCart", {
      content_ids: [product!.id],
      content_type: "product",
      content_name: displayTitle,
      value: product!.shopPrice ?? 0,
      currency: "USD",
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors mb-10">
        <ArrowLeft className="w-3.5 h-3.5" /> Shop
      </Link>

      <div className="grid lg:grid-cols-2 gap-16 items-start">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square rounded-3xl overflow-hidden bg-[#f5f5f7]">
            {images[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[activeImage]} alt={displayTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-8xl">⌚</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden transition-all ${
                    activeImage === i ? "ring-2 ring-[#1d1d1f] ring-offset-2" : "opacity-60 hover:opacity-100"
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
        <div className="lg:pt-4">
          {/* Category + condition */}
          <p className="text-sm text-[#6e6e73] mb-2 uppercase tracking-widest font-medium">
            {product.category} · {product.condition}
          </p>

          <h1 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] tracking-tight leading-tight mb-2">
            {displayTitle}
          </h1>

          {product.brand && (
            <p className="text-base text-[#6e6e73] mb-6">{product.brand}{product.model ? ` ${product.model}` : ""}</p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-8">
            <p className="text-4xl font-semibold text-[#1d1d1f]">
              ${product.shopPrice?.toFixed(2) ?? "—"}
            </p>
            {product.freeShipping && (
              <span className="text-sm font-medium text-amber-500">Free Shipping</span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-[#1d1d1f] text-base leading-relaxed mb-8 whitespace-pre-wrap">
              {product.description}
            </p>
          )}

          {/* CTA */}
          <div className="flex gap-3 mb-8">
            <button
              onClick={handleAdd}
              disabled={inCart}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-all ${
                inCart || justAdded
                  ? "bg-green-100 text-green-700"
                  : "bg-[#1d1d1f] text-white hover:bg-amber-500"
              }`}
            >
              {inCart || justAdded ? (
                <><Check className="w-5 h-5" /> Added to Cart</>
              ) : (
                <><ShoppingBag className="w-5 h-5" /> Add to Cart</>
              )}
            </button>
            {inCart && (
              <Link
                href="/cart"
                className="flex items-center justify-center px-6 py-4 rounded-2xl border border-gray-200 text-sm font-semibold hover:border-gray-400 transition-colors text-[#1d1d1f]"
              >
                View Cart →
              </Link>
            )}
          </div>

          {/* Trust signals */}
          <div className="border-t border-gray-200 pt-6 space-y-4">
            {[
              { icon: Shield, text: "Tested & verified working" },
              { icon: Zap, text: "Ships within 1–2 business days" },
              { icon: Truck, text: product.freeShipping ? "Free shipping included" : "Shipping calculated at checkout" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-[#6e6e73]">
                <Icon className="w-4 h-4 text-amber-500 shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
