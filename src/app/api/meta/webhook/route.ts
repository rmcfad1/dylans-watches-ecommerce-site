import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMetaProduct, updateMetaProduct, mapConditionToMeta } from "@/lib/meta";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const body = await req.json();

  if (action === "publish") {
    const { listingId } = body;
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
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
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

    const connection = await prisma.platformConnection.findUnique({ where: { platform: "meta" } });
    if (!connection?.isActive || !connection.accessToken || !connection.catalogId) {
      return NextResponse.json({ error: "Meta Commerce not connected. Configure it in Settings." }, { status: 400 });
    }

    const item = listing.item;
    const images = (item.imageGroup?.images ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((igi) => igi.image.url);

    try {
      const product = await createMetaProduct(connection.catalogId, connection.accessToken, {
        name: listing.listingTitle,
        description: listing.listingDesc ?? listing.listingTitle,
        price: `${listing.listedPrice.toFixed(2)} USD`,
        currency: "USD",
        availability: "in stock",
        condition: mapConditionToMeta(item.condition.name),
        image_url: images[0] ?? "https://placehold.co/800x800?text=No+Image",
        retailer_id: item.id,
      });
      await prisma.listing.update({
        where: { id: listingId },
        data: { status: "active" },
      });
      return NextResponse.json({ success: true, productId: product.id });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  if (action === "unpublish") {
    const { listingId } = body;
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 400 });
    const connection = await prisma.platformConnection.findUnique({ where: { platform: "meta" } });
    if (!connection?.accessToken) return NextResponse.json({ error: "Meta not connected" }, { status: 400 });
    await prisma.listing.update({ where: { id: listingId }, data: { status: "ended" } });
    return NextResponse.json({ success: true });
  }

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
  buyer_details?: { name?: string; email?: string };
  selected_items?: Array<{ retailer_id: string; quantity: number; price_per_unit?: { amount: string } }>;
}) {
  const buyerName = orderData.buyer_details?.name;
  const buyerEmail = orderData.buyer_details?.email;
  const paidStatus = await prisma.orderStatus.findUnique({ where: { name: "paid" } });
  if (!paidStatus) return;

  for (const lineItem of orderData.selected_items ?? []) {
    const retailerId = lineItem.retailer_id;
    const salePrice = parseFloat(lineItem.price_per_unit?.amount ?? "0");

    const metaPlatform = await prisma.platform.findUnique({ where: { name: "meta" } });
    if (!metaPlatform) continue;

    const listing = await prisma.listing.findFirst({
      where: { item: { id: retailerId }, platformId: metaPlatform.id, status: "active" },
      include: { item: true },
    });
    if (!listing) continue;

    // Create/find customer
    let customerId: string | null = null;
    if (buyerEmail) {
      const nameParts = (buyerName ?? "").trim().split(" ");
      const customer = await prisma.customer.upsert({
        where: { email: buyerEmail },
        create: {
          firstName: nameParts[0] || "Guest",
          lastName: nameParts.slice(1).join(" ") || "Customer",
          email: buyerEmail,
          dateOfLastPurchase: new Date(),
        },
        update: { dateOfLastPurchase: new Date() },
      });
      customerId = customer.id;
    }

    await prisma.order.create({
      data: {
        itemId: listing.itemId,
        customerId,
        statusId: paidStatus.id,
        listingId: listing.id,
        salePrice,
      },
    });

    await prisma.listing.update({ where: { id: listing.id }, data: { status: "sold" } });
    await prisma.inventory.updateMany({
      where: { itemId: listing.itemId },
      data: { quantity: 0, dateOfLastSale: new Date() },
    });
    await prisma.listing.updateMany({
      where: { itemId: listing.itemId, status: "active", id: { not: listing.id } },
      data: { status: "ended" },
    });
  }
}
