import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const listings = await prisma.listing.findMany({
    include: { inventoryItem: true, order: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(listings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const listing = await prisma.listing.create({
    data: {
      inventoryItemId: body.inventoryItemId,
      platform: body.platform,
      listingTitle: body.listingTitle,
      listingDesc: body.listingDesc ?? null,
      listedPrice: Number(body.listedPrice),
      status: body.status ?? "draft",
      platformListingId: body.platformListingId ?? null,
      platformUrl: body.platformUrl ?? null,
    },
  });

  // Update parent item status to "listed" if it's still "available"
  await prisma.inventoryItem.updateMany({
    where: { id: body.inventoryItemId, status: "available" },
    data: { status: "listed" },
  });

  return NextResponse.json(listing, { status: 201 });
}
