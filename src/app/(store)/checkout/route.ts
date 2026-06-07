import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

// Meta Commerce Manager sends customers here with ?products=ITEM_ID:1&coupon=CODE
// We create a Stripe Checkout session directly so Meta's validator sees a real checkout page.
// Falls back to the shop detail page if Stripe isn't configured or the item can't be found.
export async function GET(req: NextRequest) {
  const productsParam = req.nextUrl.searchParams.get("products") ?? "";
  const firstEntry = productsParam.split(",")[0] ?? "";
  const itemId = firstEntry.split(":")[0].trim();
  const base = process.env.NEXT_PUBLIC_STORE_URL ?? req.nextUrl.origin;

  if (!itemId) {
    return NextResponse.redirect(new URL("/shop", base));
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(new URL(`/shop/${itemId}`, base));
  }

  try {
    const listing = await prisma.listing.findUnique({
      where: { itemId },
      include: {
        item: {
          include: {
            inventory: true,
            imageGroup: {
              include: { images: { include: { image: true }, orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    });

    if (!listing || (listing.item.inventory?.quantity ?? 0) === 0) {
      return NextResponse.redirect(new URL("/shop", base));
    }

    const images = (listing.item.imageGroup?.images ?? []).map((igi) => igi.image.url);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: listing.listingTitle,
              images: images.slice(0, 8),
            },
            unit_amount: Math.round(listing.listedPrice * 100),
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: listing.freeShipping
        ? [{ shipping_rate_data: { type: "fixed_amount", fixed_amount: { amount: 0, currency: "usd" }, display_name: "Free Shipping", delivery_estimate: { minimum: { unit: "business_day", value: 3 }, maximum: { unit: "business_day", value: 7 } } } }]
        : [{ shipping_rate_data: { type: "fixed_amount", fixed_amount: { amount: 599, currency: "usd" }, display_name: "Standard Shipping", delivery_estimate: { minimum: { unit: "business_day", value: 3 }, maximum: { unit: "business_day", value: 7 } } } }],
      metadata: { itemIds: itemId },
      success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/shop/${itemId}`,
    });

    if (session.url) {
      return NextResponse.redirect(session.url);
    }
  } catch {
    // Stripe error — fall through to shop page
  }

  return NextResponse.redirect(new URL(`/shop/${itemId}`, base));
}
