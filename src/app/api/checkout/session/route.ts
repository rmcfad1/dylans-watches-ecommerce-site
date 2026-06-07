import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { items }: { items: { id: string; title: string; price: number; image: string }[] } = body;

  if (!items?.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3002";
  const ids = items.map((i) => i.id);

  // Verify items are still available
  const listings = await prisma.listing.findMany({
    where: { itemId: { in: ids } },
    include: { item: { include: { inventory: true } } },
  });
  const inventoryItems = await prisma.inventory.findMany({
    where: { itemId: { in: ids }, quantity: { gt: 0 } },
  });

  const availableIds = inventoryItems.map((i) => i.itemId);

  if (availableIds.length !== ids.length) {
    return NextResponse.json(
      { error: "One or more items are no longer available" },
      { status: 409 }
    );
  }

  const allFreeShipping = listings.every((l) => l.freeShipping);
  const anyFreeShipping = listings.some((l) => l.freeShipping);

  const paidShippingOptions = [
    {
      shipping_rate_data: {
        type: "fixed_amount" as const,
        fixed_amount: { amount: 599, currency: "usd" },
        display_name: "Standard Shipping",
        delivery_estimate: {
          minimum: { unit: "business_day" as const, value: 3 },
          maximum: { unit: "business_day" as const, value: 7 },
        },
      },
    },
    {
      shipping_rate_data: {
        type: "fixed_amount" as const,
        fixed_amount: { amount: 1499, currency: "usd" },
        display_name: "Priority Shipping",
        delivery_estimate: {
          minimum: { unit: "business_day" as const, value: 1 },
          maximum: { unit: "business_day" as const, value: 3 },
        },
      },
    },
  ];

  const freeShippingOption = {
    shipping_rate_data: {
      type: "fixed_amount" as const,
      fixed_amount: { amount: 0, currency: "usd" },
      display_name: "Free Shipping",
      delivery_estimate: {
        minimum: { unit: "business_day" as const, value: 3 },
        maximum: { unit: "business_day" as const, value: 7 },
      },
    },
  };

  const shipping_options = allFreeShipping
    ? [freeShippingOption]
    : anyFreeShipping
    ? [freeShippingOption, ...paidShippingOptions]
    : paidShippingOptions;

  let session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.title,
            images: item.image ? [item.image] : [],
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: 1,
      })),
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options,
      automatic_tax: { enabled: true },
      metadata: { itemIds: ids.join(",") },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cart`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
