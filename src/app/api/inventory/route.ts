import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateListing } from "@/lib/ai";

function computeStatus(item: {
  archived: boolean;
  inventory: { quantity: number } | null;
  listings: { listedOnEbay: boolean; listedOnMeta: boolean; listedOnMercari: boolean }[];
}): string {
  if (item.archived) return "archived";
  if (!item.inventory || item.inventory.quantity === 0) return "sold";
  const listing = item.listings[0];
  const listedExternally = listing && (listing.listedOnEbay || listing.listedOnMeta || listing.listedOnMercari);
  return listedExternally ? "listed" : "available";
}

function extractImageUrls(imageGroup: {
  images: { image: { url: string }; sortOrder: number }[];
} | null): string[] {
  if (!imageGroup) return [];
  return [...imageGroup.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((igi) => igi.image.url);
}

// Flatten condition relation to a plain string so API shape stays consistent
function flatCondition<
  T extends { condition: { name: string }; conditionId: string }
>(item: T): Omit<T, "condition" | "conditionId"> & { condition: string } {
  const { condition, conditionId: _cid, ...rest } = item;
  return { ...rest, condition: condition.name };
}

// Resolve a condition name to a Prisma connect expression (falls back to "used good")
function conditionConnect(name?: string) {
  return { connect: { name: name ?? "used good" } };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("stats") === "1") {
    const [totalItems, activeListings, orders] = await Promise.all([
      prisma.item.count({ where: { archived: false } }),
      prisma.listing.count({ where: { OR: [{ listedOnEbay: true }, { listedOnMeta: true }, { listedOnMercari: true }] } }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { item: { include: { condition: true } }, customer: true, orderStatus: true },
      }),
    ]);
    const available = await prisma.inventory.count({ where: { quantity: { gt: 0 } } });
    const totalRevenue = orders.reduce((s, o) => s + o.salePrice, 0);
    return NextResponse.json({
      totalItems,
      availableItems: available,
      activeListings,
      totalOrders: orders.length,
      totalRevenue,
      recentOrders: orders.map((o) => ({
        ...o,
        item: flatCondition(o.item),
      })),
    });
  }

  // Items that have no Inventory record yet — used by the "Add to Inventory" selector
  if (searchParams.get("noInventory") === "1") {
    const itemsWithInventory = await prisma.inventory.findMany({ select: { itemId: true } });
    const withInvIds = new Set(itemsWithInventory.map((i) => i.itemId));
    const items = await prisma.item.findMany({
      where: { archived: false },
      include: { condition: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      items.filter((i) => !withInvIds.has(i.id)).map(flatCondition)
    );
  }

  if (searchParams.get("shop") === "1") {
    const inventoryItems = await prisma.inventory.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        item: {
          include: {
            condition: true,
            listings: true,
            imageGroup: {
              include: {
                images: { include: { image: true }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const result = inventoryItems
      .filter((inv) => !inv.item.archived && inv.item.listings.length > 0 && inv.item.listings[0].listedPrice > 0)
      .map((inv) => {
        const listing = inv.item.listings[0] ?? null;
        return {
          id: inv.item.id,
          listingId: listing?.id ?? null,
          title: listing?.listingTitle ?? inv.item.title,
          description: listing?.listingDesc ?? inv.item.description,
          category: inv.item.category,
          condition: inv.item.condition.name,
          brand: inv.item.brand,
          model: inv.item.model,
          shopPrice: listing?.listedPrice ?? null,
          freeShipping: listing?.freeShipping ?? false,
          images: extractImageUrls(inv.item.imageGroup),
        };
      });
    return NextResponse.json(result);
  }

  const items = await prisma.item.findMany({
    where: { archived: false },
    include: {
      condition: true,
      inventory: true,
      listings: { include: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    items.map((item) => ({ ...flatCondition(item), status: computeStatus(item) }))
  );
}

export async function PATCH(req: NextRequest) {
  const { id, relist, quantity } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (quantity !== undefined) {
    await prisma.inventory.updateMany({
      where: { itemId: id },
      data: { quantity: Math.max(0, Number(quantity)), dateOfLastRestock: new Date() },
    });
  }

  if (relist) {
    await prisma.inventory.updateMany({
      where: { itemId: id },
      data: { quantity: 1 },
    });
  }

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      condition: true,
      inventory: true,
      listings: { include: { orders: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...flatCondition(item), status: computeStatus(item) });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("clear") !== "all") {
    return NextResponse.json({ error: "Pass ?clear=all to confirm" }, { status: 400 });
  }
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.imageGroupImage.deleteMany();
  await prisma.image.deleteMany();
  await prisma.imageGroup.deleteMany();
  await prisma.item.deleteMany();
  // Also clear old migration backup tables so they don't get re-migrated on next deploy
  const oldTables = ["_OldInventoryItem", "_OldListing", "_OldOrder", "_OldStoreOrder"];
  for (const table of oldTables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`).catch(() => {});
  }
  return NextResponse.json({ ok: true, message: "All data cleared" });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Inventory-only: itemId provided for an existing item with no inventory record
  if (body.itemId && !body.productBlurb && !body.title) {
    const existing = await prisma.inventory.findUnique({ where: { itemId: body.itemId } });
    if (existing) {
      return NextResponse.json({ error: "Inventory record already exists" }, { status: 409 });
    }
    const inv = await prisma.inventory.create({
      data: { itemId: body.itemId, quantity: 1, dateOfLastRestock: new Date() },
    });
    return NextResponse.json(inv, { status: 201 });
  }

  // New flow: productBlurb + optional fields → AI generates title/description/brand/model
  // Legacy flow: explicit title/brand/model fields (kept for backwards compat)
  let title: string = body.title ?? "";
  let description: string | null = body.description ?? null;
  let brand: string | null = body.brand ?? null;
  let model: string | null = body.model ?? null;
  let category: string = body.category ?? "Other";

  if (body.productBlurb) {
    try {
      const ai = await generateListing({
        item: body.productBlurb,
        condition: body.condition ?? "used good",
        category: body.category ?? "Other",
        notes: body.notes,
        platform: "ebay",
        imageUrls: body.imageUrls ?? [],
      });
      title = ai.titles.ebay;
      description = body.description || ai.description;
      brand = ai.brand ?? null;
      model = ai.model ?? null;
      category = ai.category ?? body.category ?? "Other";
    } catch {
      title = body.productBlurb;
    }
  }

  if (!title) return NextResponse.json({ error: "title or productBlurb required" }, { status: 400 });

  // Create ImageGroup + Images from uploaded URLs
  const imageUrls: string[] = body.imageUrls ?? [];
  const imageGroupData = imageUrls.length > 0
    ? {
        imageGroup: {
          create: {
            images: {
              create: imageUrls.map((url: string, i: number) => ({
                sortOrder: i,
                image: { create: { url } },
              })),
            },
          },
        },
      }
    : {};


  const item = await prisma.item.create({
    data: {
      title,
      description,
      condition: conditionConnect(body.condition),
      category,
      brand,
      model,
      notes: body.notes ?? null,
      ...imageGroupData,
    },
    include: { condition: true },
  });
  await prisma.inventory.create({ data: { itemId: item.id, quantity: 1 } });
  return NextResponse.json(flatCondition(item), { status: 201 });
}
