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
      status: body.status,
      listingTitle: body.listingTitle,
      listingDesc: body.listingDesc,
      listedPrice: body.listedPrice !== undefined ? Number(body.listedPrice) : undefined,
      freeShipping: body.freeShipping !== undefined ? Boolean(body.freeShipping) : undefined,
      shopEnabled: body.shopEnabled !== undefined ? Boolean(body.shopEnabled) : undefined,
    },
    include: { platform: true },
  });
  return NextResponse.json(listing);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.listing.update({ where: { id }, data: { status: "ended", shopEnabled: false } });
  return NextResponse.json({ success: true });
}
