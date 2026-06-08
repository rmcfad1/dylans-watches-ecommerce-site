import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAllInventoryItems, putInventoryItem, refreshAccessToken } from "@/lib/ebay";

// Vercel max duration — bulk import fetches from eBay + pushes SKUs back
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

  // Get existing eBay SKUs stored in notes to skip duplicates
  const existingEbaySkus = new Set(
    (await prisma.item.findMany({
      where: { notes: { contains: "eBay SKU:" } },
      select: { notes: true },
    })).map((i) => {
      const m = i.notes?.match(/eBay SKU: ([^\s]+)/);
      return m ? m[1] : null;
    }).filter(Boolean) as string[]
  );

  // Also skip items whose DW SKU is already in the DB
  const existingDwSkus = new Set(
    (await prisma.item.findMany({ where: { sku: { startsWith: "DW-" } }, select: { sku: true } }))
      .map((i) => i.sku!)
  );

  // Get next DW SKU counter
  const lastDw = await prisma.item.findFirst({
    where: { sku: { startsWith: "DW-" } },
    orderBy: { sku: "desc" },
    select: { sku: true },
  });
  let skuCounter = lastDw?.sku ? parseInt(lastDw.sku.replace("DW-", ""), 10) : 0;

  let imported = 0;
  let skipped = 0;
  let skusPushed = 0;
  const failed: string[] = [];

  for (const ebayItem of ebayItems) {
    // Skip if we've already imported this eBay SKU
    if (existingEbaySkus.has(ebayItem.sku)) {
      skipped++;
      continue;
    }

    try {
      // Generate the next DW- SKU
      skuCounter++;
      const dwSku = "DW-" + String(skuCounter).padStart(6, "0");

      // Ensure DW SKU is unique (in case of gaps)
      while (existingDwSkus.has(dwSku)) {
        skuCounter++;
      }
      const finalDwSku = "DW-" + String(skuCounter).padStart(6, "0");

      // Push the DW SKU back to eBay as a new inventory item
      try {
        await putInventoryItem(accessToken, finalDwSku, ebayItem);
        skusPushed++;
      } catch (ebayErr) {
        // Log but don't fail the whole import — local record still gets created
        console.error(`Failed to push SKU ${finalDwSku} to eBay for ${ebayItem.sku}:`, ebayErr);
      }

      // Create local item record with DW SKU, storing original eBay SKU in notes
      const imageUrls = ebayItem.imageUrls.slice(0, 12);
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

      const item = await prisma.item.create({
        data: {
          sku: finalDwSku,
          title: ebayItem.title,
          description: ebayItem.description || null,
          condition: { connect: { name: ebayItem.condition } },
          category: "Other",
          brand: null,
          model: null,
          notes: `Imported from eBay. eBay SKU: ${ebayItem.sku}`,
          ...imageGroupData,
        },
      });

      await prisma.inventory.create({ data: { itemId: item.id, quantity: 1 } });
      existingEbaySkus.add(ebayItem.sku);
      existingDwSkus.add(finalDwSku);
      imported++;
    } catch (err) {
      failed.push(`${ebayItem.sku}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    failed: failed.length,
    skusPushedToEbay: skusPushed,
    failedDetails: failed.slice(0, 10),
    total: ebayItems.length,
    note: imported > 0
      ? `${imported} items imported with DW- SKUs. ${skusPushed} SKUs pushed to eBay listings.`
      : undefined,
  });
}
