import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createMetaProduct,
  updateMetaProduct,
  mapConditionToMeta,
} from "@/lib/meta";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { listingId } = body;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { inventoryItem: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const connection = await prisma.platformConnection.findUnique({
    where: { platform: "meta" },
  });

  if (!connection?.isActive || !connection.accessToken || !connection.catalogId) {
    return NextResponse.json(
      { error: "Meta Commerce not connected. Configure it in Settings." },
      { status: 400 }
    );
  }

  const item = listing.inventoryItem;
  const images: string[] = JSON.parse(item.images || "[]");

  try {
    const product = await createMetaProduct(
      connection.catalogId,
      connection.accessToken,
      {
        name: listing.listingTitle,
        description: listing.listingDesc ?? listing.listingTitle,
        price: `${listing.listedPrice.toFixed(2)} USD`,
        currency: "USD",
        availability: "in stock",
        condition: mapConditionToMeta(item.condition),
        image_url: images[0] ?? "https://placehold.co/800x800?text=No+Image",
        retailer_id: item.id,
      }
    );

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        platformListingId: product.id,
        platformUrl: `https://www.facebook.com/commerce/products/${product.id}`,
        status: "active",
      },
    });

    return NextResponse.json({ success: true, productId: product.id });
  } catch (err) {
    console.error("Meta publish error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { listingId } = await req.json();

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing?.platformListingId) {
    return NextResponse.json({ error: "No platform listing ID" }, { status: 400 });
  }

  const connection = await prisma.platformConnection.findUnique({
    where: { platform: "meta" },
  });
  if (!connection?.accessToken) {
    return NextResponse.json({ error: "Meta not connected" }, { status: 400 });
  }

  await updateMetaProduct(listing.platformListingId, connection.accessToken, {
    availability: "out of stock",
  });

  await prisma.listing.update({
    where: { id: listingId },
    data: { status: "ended" },
  });

  return NextResponse.json({ success: true });
}
