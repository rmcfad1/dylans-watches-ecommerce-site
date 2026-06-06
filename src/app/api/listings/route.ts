import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const listings = await prisma.listing.findMany({
    include: {
      item: true,
      platform: true,
      orders: { include: { customer: true, orderStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(listings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Support both platformId (new) and platform name string (legacy)
  let platformId = body.platformId;
  if (!platformId && body.platform) {
    const p = await prisma.platform.findUnique({ where: { name: body.platform } });
    platformId = p?.id;
  }
  if (!platformId) {
    return NextResponse.json({ error: "Platform not found" }, { status: 400 });
  }

  const itemId = body.itemId ?? body.inventoryItemId;
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const listing = await prisma.listing.create({
    data: {
      itemId,
      platformId,
      listingTitle: body.listingTitle,
      listingDesc: body.listingDesc ?? null,
      listedPrice: Number(body.listedPrice),
      status: body.status ?? "draft",
      freeShipping: Boolean(body.freeShipping),
      shopEnabled: Boolean(body.shopEnabled),
    },
    include: { platform: true },
  });

  return NextResponse.json(listing, { status: 201 });
}
