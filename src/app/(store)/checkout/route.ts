import { NextRequest, NextResponse } from "next/server";

// Meta Commerce Manager sends customers here with ?products=ITEM_ID:1&coupon=CODE
// Parse the first product ID and redirect to its shop page.
export async function GET(req: NextRequest) {
  const productsParam = req.nextUrl.searchParams.get("products") ?? "";

  // Format: "itemId:quantity" or just "itemId", comma-separated for multiple
  const firstEntry = productsParam.split(",")[0] ?? "";
  const itemId = firstEntry.split(":")[0].trim();

  const base = process.env.NEXT_PUBLIC_STORE_URL ?? req.nextUrl.origin;

  if (!itemId) {
    return NextResponse.redirect(new URL("/shop", base));
  }

  return NextResponse.redirect(new URL(`/shop/${itemId}`, base));
}
