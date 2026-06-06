import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function syncImages(itemId: string, urls: string[]) {
  // Get or create the item's ImageGroup
  let item = await prisma.item.findUnique({ where: { id: itemId }, include: { imageGroup: { include: { images: { include: { image: true } } } } } });
  if (!item) return;

  let imageGroupId = item.imageGroupId;
  if (!imageGroupId) {
    const group = await prisma.imageGroup.create({ data: {} });
    await prisma.item.update({ where: { id: itemId }, data: { imageGroupId: group.id } });
    imageGroupId = group.id;
  }

  // Remove all existing junction records
  await prisma.imageGroupImage.deleteMany({ where: { imageGroupId } });

  // Create Image records and junctions for each URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let img = await prisma.image.findFirst({ where: { url } });
    if (!img) img = await prisma.image.create({ data: { url } });
    await prisma.imageGroupImage.upsert({
      where: { imageGroupId_imageId: { imageGroupId, imageId: img.id } },
      create: { imageGroupId, imageId: img.id, sortOrder: i },
      update: { sortOrder: i },
    });
  }
}

async function getItemWithImages(id: string) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      condition: true,
      inventory: true,
      imageGroup: {
        include: {
          images: { include: { image: true }, orderBy: { sortOrder: "asc" } },
        },
      },
      listings: {
        include: { platform: true, orders: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!item) return null;
  const images = (item.imageGroup?.images ?? []).map((igi) => igi.image.url);
  const directListing = item.listings.find((l) => l.platform.name === "direct");
  const qty = item.inventory?.quantity ?? 0;
  const hasActiveListing = item.listings.some((l) => l.status === "active");
  const status = item.archived ? "archived" : qty === 0 ? "sold" : hasActiveListing ? "listed" : "available";
  const { condition, conditionId: _cid, ...rest } = item;
  return {
    ...rest,
    condition: condition.name,
    status,
    images: JSON.stringify(images),
    shopEnabled: directListing?.shopEnabled ?? false,
    shopPrice: directListing?.listedPrice ?? null,
    shopTitle: directListing?.listingTitle ?? null,
    freeShipping: directListing?.freeShipping ?? false,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getItemWithImages(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Update item core fields
  await prisma.item.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description ?? null,
      ...(body.condition ? { condition: { connect: { name: body.condition } } } : {}),
      category: body.category,
      brand: body.brand ?? null,
      model: body.model ?? null,
      notes: body.notes ?? null,
    },
  });

  // Sync images if provided
  if (body.images !== undefined) {
    const urls: string[] = Array.isArray(body.images)
      ? body.images
      : (() => { try { return JSON.parse(body.images); } catch { return []; } })();
    await syncImages(id, urls);
  }

  // Handle store (direct listing) settings
  if (body.shopEnabled !== undefined) {
    const directPlatform = await prisma.platform.findUnique({ where: { name: "direct" } });
    if (directPlatform) {
      const existing = await prisma.listing.findFirst({
        where: { itemId: id, platformId: directPlatform.id },
      });
      const shopTitle = body.shopTitle || body.title;
      const shopPrice = body.shopPrice ? Number(body.shopPrice) : 0;

      if (existing) {
        await prisma.listing.update({
          where: { id: existing.id },
          data: {
            shopEnabled: Boolean(body.shopEnabled),
            listedPrice: shopPrice || existing.listedPrice,
            listingTitle: shopTitle || existing.listingTitle,
            freeShipping: Boolean(body.freeShipping),
            status: body.shopEnabled ? "active" : existing.status,
          },
        });
      } else if (body.shopEnabled && shopPrice > 0) {
        await prisma.listing.create({
          data: {
            itemId: id,
            platformId: directPlatform.id,
            status: "active",
            listingTitle: shopTitle,
            listedPrice: shopPrice,
            freeShipping: Boolean(body.freeShipping),
            shopEnabled: true,
          },
        });
      }
    }
  }

  const updated = await getItemWithImages(id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.item.update({ where: { id }, data: { archived: true } });
  return NextResponse.json({ success: true });
}
