import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Meta sends a GET request to verify the webhook endpoint
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Meta sends POST with order/commerce events
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Handle commerce order notifications
  if (body.object === "page" && body.entry) {
    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field === "commerce_orders") {
          await handleCommerceOrder(change.value);
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}

async function handleCommerceOrder(orderData: {
  id: string;
  buyer_details?: { name?: string };
  selected_items?: Array<{ retailer_id: string; quantity: number; price_per_unit?: { amount: string } }>;
  shipping_address?: unknown;
}) {
  const platformOrderId = orderData.id;
  const buyerName = orderData.buyer_details?.name;

  // Match the order to our listing by retailer_id (which is the inventoryItem.id)
  for (const lineItem of orderData.selected_items ?? []) {
    const retailerId = lineItem.retailer_id;
    const salePrice = parseFloat(lineItem.price_per_unit?.amount ?? "0");

    // Find the active Meta listing for this item
    const listing = await prisma.listing.findFirst({
      where: {
        inventoryItem: { id: retailerId },
        platform: "meta",
        status: "active",
      },
      include: { inventoryItem: true },
    });

    if (!listing) continue;

    // Create order record
    await prisma.order.create({
      data: {
        listingId: listing.id,
        platform: "meta",
        platformOrderId,
        buyerName: buyerName ?? null,
        salePrice,
        profit: salePrice - listing.inventoryItem.purchasePrice,
        status: "pending",
      },
    });

    // Mark listing as sold
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: "sold" },
    });

    // Mark inventory item as sold
    await prisma.inventoryItem.update({
      where: { id: listing.inventoryItemId },
      data: { status: "sold" },
    });

    // End any other active listings for this item on other platforms
    await prisma.listing.updateMany({
      where: {
        inventoryItemId: listing.inventoryItemId,
        status: "active",
        id: { not: listing.id },
      },
      data: { status: "ended" },
    });
  }
}
