import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const listings = await prisma.listing.findMany({
    include: {
      item: {
        include: {
          condition: true,
          inventory: true,
        },
      },
      orders: { include: { customer: true, orderStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(listings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const itemId = body.itemId;
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  if (!body.listingTitle) return NextResponse.json({ error: "listingTitle required" }, { status: 400 });

  const listedPrice = Number(body.listedPrice);
  if (!isFinite(listedPrice) || listedPrice < 0) {
    return NextResponse.json({ error: "listedPrice must be a non-negative number" }, { status: 400 });
  }

  const listing = await prisma.listing.upsert({
    where: { itemId },
    create: {
      itemId,
      listingTitle: body.listingTitle,
      listingDesc: body.listingDesc ?? null,
      listedPrice,
      freeShipping: Boolean(body.freeShipping),
      listedOnEbay: Boolean(body.listedOnEbay),
      listedOnMeta: Boolean(body.listedOnMeta),
      listedOnMercari: Boolean(body.listedOnMercari),
    },
    update: {
      listingTitle: body.listingTitle,
      listingDesc: body.listingDesc ?? null,
      listedPrice,
      freeShipping: Boolean(body.freeShipping),
      listedOnEbay: Boolean(body.listedOnEbay),
      listedOnMeta: Boolean(body.listedOnMeta),
      listedOnMercari: Boolean(body.listedOnMercari),
    },
    include: { orders: true },
  });

  return NextResponse.json(listing, { status: 201 });
}
