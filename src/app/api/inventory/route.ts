import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function computeStatus(item: {
  archived: boolean;
  inventory: { quantity: number } | null;
  listings: { status: string }[];
}): string {
  if (item.archived) return "archived";
  if (!item.inventory || item.inventory.quantity === 0) return "sold";
  return item.listings.some((l) => l.status === "active") ? "listed" : "available";
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
      prisma.listing.count({ where: { status: "active" } }),
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

  if (searchParams.get("shop") === "1") {
    const listings = await prisma.listing.findMany({
      where: {
        shopEnabled: true,
        status: { in: ["draft", "active"] },
        platform: { name: "direct" },
      },
      include: {
        item: {
          include: {
            condition: true,
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
    const result = listings.map((l) => ({
      id: l.item.id,
      listingId: l.id,
      title: l.listingTitle,
      description: l.listingDesc ?? l.item.description,
      category: l.item.category,
      condition: l.item.condition.name,
      brand: l.item.brand,
      model: l.item.model,
      shopPrice: l.listedPrice,
      shopEnabled: l.shopEnabled,
      freeShipping: l.freeShipping,
      images: extractImageUrls(l.item.imageGroup),
    }));
    return NextResponse.json(result);
  }

  const items = await prisma.item.findMany({
    where: { archived: false },
    include: {
      condition: true,
      inventory: true,
      listings: { include: { platform: true, orders: true } },
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
    await prisma.listing.updateMany({
      where: { itemId: id, platform: { name: "direct" } },
      data: { shopEnabled: true, status: "active" },
    });
  }

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      condition: true,
      inventory: true,
      listings: { include: { platform: true, orders: true } },
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
  return NextResponse.json({ ok: true, message: "All data cleared" });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await prisma.item.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      condition: conditionConnect(body.condition),
      category: body.category,
      brand: body.brand ?? null,
      model: body.model ?? null,
      notes: body.notes ?? null,
    },
    include: { condition: true },
  });
  await prisma.inventory.create({ data: { itemId: item.id, quantity: 1 } });
  return NextResponse.json(flatCondition(item), { status: 201 });
}
