import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function syncImages(itemId: string, urls: string[]) {
  let item = await prisma.item.findUnique({ where: { id: itemId }, include: { imageGroup: { include: { images: { include: { image: true } } } } } });
  if (!item) return;

  let imageGroupId = item.imageGroupId;
  if (!imageGroupId) {
    const group = await prisma.imageGroup.create({ data: {} });
    await prisma.item.update({ where: { id: itemId }, data: { imageGroupId: group.id } });
    imageGroupId = group.id;
  }

  await prisma.imageGroupImage.deleteMany({ where: { imageGroupId } });

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
        include: { orders: true },
      },
    },
  });
  if (!item) return null;
  const images = (item.imageGroup?.images ?? []).map((igi) => igi.image.url);
  const listing = item.listings[0] ?? null;
  const qty = item.inventory?.quantity ?? 0;
  const listedExternally = listing && (listing.listedOnEbay || listing.listedOnMeta || listing.listedOnMercari);
  const status = item.archived ? "archived" : qty === 0 ? "sold" : listedExternally ? "listed" : "available";
  const { condition, conditionId: _cid, ...rest } = item;
  return {
    ...rest,
    condition: condition.name,
    status,
    images: JSON.stringify(images),
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

  if (body.images !== undefined) {
    const urls: string[] = Array.isArray(body.images)
      ? body.images
      : (() => { try { return JSON.parse(body.images); } catch { return []; } })();
    await syncImages(id, urls);
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
