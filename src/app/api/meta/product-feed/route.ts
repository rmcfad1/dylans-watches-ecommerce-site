import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Meta Commerce product feed — Meta polls this URL to sync your catalog.
// Set this URL in your Meta Catalog data source settings.
export async function GET() {
  const items = await prisma.inventoryItem.findMany({
    where: { shopEnabled: true, status: "available" },
  });

  const baseUrl = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3002";

  const products = items.map((item) => {
    const images: string[] = JSON.parse(item.images || "[]");
    const price = item.shopPrice ?? 0;
    const condition = metaCondition(item.condition);
    return {
      id: item.id,
      title: item.shopTitle ?? item.title,
      description: item.description ?? item.title,
      availability: "in stock",
      condition,
      price: `${price.toFixed(2)} USD`,
      link: `${baseUrl}/shop/${item.id}`,
      image_link: images[0] ?? "",
      brand: item.brand ?? "Unknown",
      google_product_category: googleCategory(item.category),
    };
  });

  // Return as JSON feed (Meta also accepts CSV/XML — JSON is simplest)
  return NextResponse.json({ data: products });
}

function metaCondition(c: string): string {
  if (c === "Excellent") return "refurbished";
  return "used";
}

function googleCategory(category: string): string {
  if (category === "Smartwatch") return "Electronics > GPS & Navigation > GPS Accessories > GPS Trackers";
  if (category === "Watch") return "Apparel & Accessories > Jewelry > Watches";
  return "Electronics";
}
