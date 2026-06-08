import { put } from "@vercel/blob";
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

// Download a single photo from eBay and upload to Vercel Blob.
// Returns the blob URL or null if anything fails.
async function rehost(ebayUrl: string): Promise<string | null> {
  try {
    const res = await fetch(ebayUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : "jpg";
    const blob = await put(`inventory/${Date.now()}-ebay.${ext}`, buffer, {
      access: "public",
      contentType: ct,
    });
    return blob.url;
  } catch {
    return null;
  }
}

// Download all photos for one listing in parallel, cap at 8 photos.
async function rehostAll(urls: string[]): Promise<string[]> {
  const results = await Promise.all(urls.slice(0, 8).map(rehost));
  return results.filter((u): u is string => u !== null);
}

// Process items in batches to stay within the 300s Vercel limit.
// Each batch runs in parallel; batches run serially.
async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function POST() {
  let accessToken: string;
  try {
    accessToken = await getValidToken();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

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

  const toImport = listings.filter((l) => !existingEbayIds.has(l.itemId));
  const skipped = listings.length - toImport.length;

  let imported = 0;
  const failed: string[] = [];

  // Process 5 items at a time — each item downloads ≤8 photos in parallel.
  // At ~1s per photo and 8 photos per item, 5 concurrent = ~8s per batch.
  // 200 items / 5 per batch = 40 batches × ~8s = ~320s worst-case.
  await runInBatches(toImport, 5, async (listing) => {
    try {
      // Download and re-host all photos in parallel
      const hostedUrls = await rehostAll(listing.imageUrls);

      const imageGroupData = hostedUrls.length > 0
        ? {
            imageGroup: {
              create: {
                images: {
                  create: hostedUrls.map((url, i) => ({
                    sortOrder: i,
                    image: { create: { url } },
                  })),
                },
              },
            },
          }
        : {};

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
  });

  return NextResponse.json({
    imported,
    skipped,
    failed: failed.length,
    failedDetails: failed.slice(0, 10),
    total: listings.length,
    note: imported > 0
      ? `${imported} listings imported with photos downloaded to Vercel Blob.`
      : undefined,
  });
}
