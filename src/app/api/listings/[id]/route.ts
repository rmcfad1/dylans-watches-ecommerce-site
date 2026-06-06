import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const listing = await prisma.listing.update({
    where: { id },
    data: {
      listingTitle: body.listingTitle,
      listingDesc: body.listingDesc,
      listedPrice: body.listedPrice !== undefined ? Number(body.listedPrice) : undefined,
      freeShipping: body.freeShipping !== undefined ? Boolean(body.freeShipping) : undefined,
      listedOnEbay: body.listedOnEbay !== undefined ? Boolean(body.listedOnEbay) : undefined,
      listedOnMeta: body.listedOnMeta !== undefined ? Boolean(body.listedOnMeta) : undefined,
      listedOnMercari: body.listedOnMercari !== undefined ? Boolean(body.listedOnMercari) : undefined,
    },
    include: { orders: true },
  });
  return NextResponse.json(listing);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.listing.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
