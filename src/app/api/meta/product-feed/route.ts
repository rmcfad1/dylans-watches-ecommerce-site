import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const listings = await prisma.listing.findMany({
    where: { listedOnMeta: true },
    include: {
      item: {
        include: {
          condition: true,
          imageGroup: {
            include: { images: { include: { image: true }, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_STORE_URL ?? "https://dylans-watches-ecommerce-site.vercel.app";
  const headers = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "google_product_category"];

  const rows = listings.map((listing) => {
    const item = listing.item;
    const images = (item.imageGroup?.images ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((igi) => igi.image.url);

    return [
      item.id,
      listing.listingTitle,
      listing.listingDesc ?? item.description ?? listing.listingTitle,
      "in stock",
      metaCondition(item.condition.name),
      `${listing.listedPrice.toFixed(2)} USD`,
      `${baseUrl}/shop/${item.id}`,
      images[0] ?? "",
      item.brand ?? "Unknown",
      googleCategory(item.category),
    ].map(csvEscape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv", "Cache-Control": "no-store" },
  });
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function metaCondition(c: string): string {
  if (c === "new" || c === "new other") return "new";
  if (c === "used great") return "refurbished";
  return "used";
}

function googleCategory(category: string): string {
  if (category === "Smartwatch") return "Electronics > GPS & Navigation > GPS Accessories > GPS Trackers";
  if (category === "Watch") return "Apparel & Accessories > Jewelry > Watches";
  return "Electronics";
}
