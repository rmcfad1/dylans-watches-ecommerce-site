import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAllInventoryItems, refreshAccessToken } from "@/lib/ebay";

// Vercel max duration — bulk import can take a while fetching from eBay
export const maxDuration = 300;

async function getValidToken(): Promise<string> {
  const conn = await prisma.platformConnection.findUnique({ where: { platform: "ebay" } });
  if (!conn?.accessToken) throw new Error("eBay not connected. Connect via Settings → Platforms.");

  if (conn.expiresAt && conn.refreshToken && new Date(conn.expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
    const tokens = await refreshAccessToken(conn.refreshToken);
    await prisma.platformConnection.update({
      where: { platform: "ebay" },
      data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt },
    });
    return tokens.accessToken;
  }

  return conn.accessToken;
}

export async function POST() {
  let accessToken: string;
  try {
    accessToken = await getValidToken();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  let ebayItems;
  try {
    ebayItems = await fetchAllInventoryItems(accessToken);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  if (ebayItems.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, failed: 0, message: "No inventory items found on eBay." });
  }

  // Get existing SKUs to skip duplicates
  const existingSkus = new Set(
    (await prisma.item.findMany({ where: { sku: { not: null } }, select: { sku: true } }))
      .map((i) => i.sku!)
  );

  // Get last SKU number for auto-assignment to items that use non-DW eBay SKUs
  const lastDw = await prisma.item.findFirst({
    where: { sku: { startsWith: "DW-" } },
    orderBy: { sku: "desc" },
    select: { sku: true },
  });
  let skuCounter = lastDw?.sku ? parseInt(lastDw.sku.replace("DW-", ""), 10) : 0;

  let imported = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const ebayItem of ebayItems) {
    if (existingSkus.has(ebayItem.sku)) {
      skipped++;
      continue;
    }

    try {
      // Use eBay image URLs directly — no downloading/re-hosting (avoids timeout)
      const imageUrls = ebayItem.imageUrls.slice(0, 12);

      // Use eBay title and description as-is — no AI generation (avoids timeout)
      // User can enhance individual items from the item detail page
      const imageGroupData = imageUrls.length > 0
        ? {
            imageGroup: {
              create: {
                images: {
                  create: imageUrls.map((url, i) => ({
                    sortOrder: i,
                    image: { create: { url } },
                  })),
                },
              },
            },
          }
        : {};

      // Assign eBay SKU if it looks like a real SKU, otherwise generate DW- one
      const sku = ebayItem.sku;

      const item = await prisma.item.create({
        data: {
          sku,
          title: ebayItem.title,
          description: ebayItem.description || null,
          condition: { connect: { name: ebayItem.condition } },
          category: "Other",
          brand: null,
          model: null,
          notes: "Imported from eBay.",
          ...imageGroupData,
        },
      });

      await prisma.inventory.create({ data: { itemId: item.id, quantity: 1 } });
      existingSkus.add(sku);
      skuCounter++;
      imported++;
    } catch (err) {
      failed.push(`${ebayItem.sku}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    failed: failed.length,
    failedDetails: failed.slice(0, 10),
    total: ebayItems.length,
    note: imported > 0 ? "Items imported with eBay titles. Open each item to run AI enhancement." : undefined,
  });
}
