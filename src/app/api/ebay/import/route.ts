import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMyEbaySellingListings, refreshAccessToken } from "@/lib/ebay";

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

  // Fetch active listings via Trading API GetMyeBaySelling
  let listings;
  try {
    listings = await getMyEbaySellingListings(accessToken);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  if (listings.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, failed: 0, message: "No active listings found on eBay." });
  }

  // Track already-imported eBay item IDs via notes field
  const existingEbayIds = new Set(
    (await prisma.item.findMany({
      where: { notes: { contains: "eBay ItemID:" } },
      select: { notes: true },
    })).map((i) => {
      const m = i.notes?.match(/eBay ItemID: (\d+)/);
      return m ? m[1] : null;
    }).filter(Boolean) as string[]
  );

  let imported = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const listing of listings) {
    if (existingEbayIds.has(listing.itemId)) {
      skipped++;
      continue;
    }

    try {
      const imageUrls = listing.imageUrls.slice(0, 12);
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

      // Auto-generate next DW- SKU
      const lastDw = await prisma.item.findFirst({
        where: { sku: { startsWith: "DW-" } },
        orderBy: { sku: "desc" },
        select: { sku: true },
      });
      const n = lastDw?.sku ? parseInt(lastDw.sku.replace("DW-", ""), 10) : 0;
      const sku = "DW-" + String(n + 1).padStart(6, "0");

      const item = await prisma.item.create({
        data: {
          sku,
          title: listing.title,
          description: null,
          condition: { connect: { name: listing.condition } },
          category: "Other",
          brand: null,
          model: null,
          notes: `Imported from eBay. eBay ItemID: ${listing.itemId}`,
          ...imageGroupData,
        },
      });

      await prisma.inventory.create({ data: { itemId: item.id, quantity: 1 } });
      existingEbayIds.add(listing.itemId);
      imported++;
    } catch (err) {
      failed.push(`ItemID ${listing.itemId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    failed: failed.length,
    failedDetails: failed.slice(0, 10),
    total: listings.length,
    note: imported > 0 ? `${imported} eBay listings imported. Titles and photos carried over from eBay.` : undefined,
  });
}
