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
      platformListingId: body.platformListingId,
      platformUrl: body.platformUrl,
    },
  });
  return NextResponse.json(listing);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.listing.update({ where: { id }, data: { status: "ended" } });
  return NextResponse.json({ success: true });
}
