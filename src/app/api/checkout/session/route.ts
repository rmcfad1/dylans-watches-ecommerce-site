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

  // Verify all items are still available
  const ids = items.map((i) => i.id);
  const dbItems = await prisma.inventoryItem.findMany({
    where: { id: { in: ids }, shopEnabled: true, status: { in: ["available", "listed"] } },
  });

  if (dbItems.length !== ids.length) {
    return NextResponse.json(
      { error: "One or more items are no longer available" },
      { status: 409 }
    );
  }

  const session = await getStripe().checkout.sessions.create({
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
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 599, currency: "usd" },
          display_name: "Standard Shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 3 },
            maximum: { unit: "business_day", value: 7 },
          },
        },
      },
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 1499, currency: "usd" },
          display_name: "Priority Shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 1 },
            maximum: { unit: "business_day", value: 3 },
          },
        },
      },
    ],
    metadata: { itemIds: ids.join(",") },
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cart`,
  });

  return NextResponse.json({ url: session.url });
}
