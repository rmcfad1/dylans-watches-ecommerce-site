import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.inventoryItem.findMany({
    where: { shopEnabled: true, status: { in: ["available", "listed"] } },
  });

  const baseUrl = process.env.NEXT_PUBLIC_STORE_URL ?? "https://dylans-watches-ecommerce-site.vercel.app";

  const headers = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "google_product_category"];

  const rows = items.map((item) => {
    const images: string[] = (() => { try { const p = JSON.parse(item.images || "[]"); return Array.isArray(p) ? p : []; } catch { return []; } })();
    const price = item.shopPrice ?? 0;
    return [
      item.id,
      item.shopTitle ?? item.title,
      item.description ?? item.title,
      "in stock",
      metaCondition(item.condition),
      `${price.toFixed(2)} USD`,
      `${baseUrl}/shop/${item.id}`,
      images[0] ?? "",
      item.brand ?? "Unknown",
      googleCategory(item.category),
    ].map(csvEscape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Cache-Control": "no-store",
    },
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
  if (c === "Excellent") return "refurbished";
  return "used";
}

function googleCategory(category: string): string {
  if (category === "Smartwatch") return "Electronics > GPS & Navigation > GPS Accessories > GPS Trackers";
  if (category === "Watch") return "Apparel & Accessories > Jewelry > Watches";
  return "Electronics";
}
