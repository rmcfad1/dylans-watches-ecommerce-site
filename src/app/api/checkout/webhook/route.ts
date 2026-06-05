import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
    return new NextResponse("Webhook secret not configured", { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new NextResponse("Webhook signature verification failed", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const itemIds = (session.metadata?.itemIds ?? "").split(",").filter(Boolean);
    const customerDetails = session.customer_details;
    const shippingDetails = (session as unknown as { shipping_details?: { address?: unknown } }).shipping_details;
    const shippingCost = (session.shipping_cost?.amount_total ?? 0) / 100;
    const amountTotal = (session.amount_total ?? 0) / 100;
    const itemTotal = amountTotal - shippingCost;
    const perItemPrice = itemIds.length > 0 ? itemTotal / itemIds.length : 0;

    for (const itemId of itemIds) {
      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item) continue;

      await prisma.storeOrder.create({
        data: {
          inventoryItemId: itemId,
          channel: "website",
          stripeSessionId: session.id,
          customerName: customerDetails?.name ?? null,
          customerEmail: customerDetails?.email ?? null,
          shippingAddress: shippingDetails?.address
            ? JSON.stringify(shippingDetails.address)
            : null,
          salePrice: perItemPrice,
          shippingCost: shippingCost / itemIds.length,
          profit: perItemPrice - item.purchasePrice,
          status: "paid",
        },
      });

      // Mark item sold
      await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { status: "sold", shopEnabled: false },
      });

      // End any active listings for this item on other platforms
      await prisma.listing.updateMany({
        where: { inventoryItemId: itemId, status: "active" },
        data: { status: "ended" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
