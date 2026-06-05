import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const orders = await prisma.order.findMany({
    include: {
      listing: { include: { inventoryItem: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const order = await prisma.order.create({
    data: {
      listingId: body.listingId,
      platform: body.platform,
      platformOrderId: body.platformOrderId ?? null,
      buyerName: body.buyerName ?? null,
      salePrice: Number(body.salePrice),
      shippingCost: body.shippingCost ? Number(body.shippingCost) : null,
      profit: body.profit ? Number(body.profit) : null,
      status: "pending",
    },
    include: { listing: { include: { inventoryItem: true } } },
  });

  // Mark listing and item as sold
  await prisma.listing.update({
    where: { id: body.listingId },
    data: { status: "sold" },
  });

  const listing = await prisma.listing.findUnique({
    where: { id: body.listingId },
  });

  if (listing) {
    await prisma.inventoryItem.update({
      where: { id: listing.inventoryItemId },
      data: { status: "sold" },
    });
    // End other active listings for this item
    await prisma.listing.updateMany({
      where: {
        inventoryItemId: listing.inventoryItemId,
        status: "active",
        id: { not: body.listingId },
      },
      data: { status: "ended" },
    });
  }

  return NextResponse.json(order, { status: 201 });
}
