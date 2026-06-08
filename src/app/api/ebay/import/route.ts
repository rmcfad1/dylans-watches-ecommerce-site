import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateListing } from "@/lib/ai";
import { getMyEbaySellingListings, reviseListingSku, refreshAccessToken } from "@/lib/ebay";

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

async function rehost(ebayUrl: string): Promise<{ url: string | null; error?: string }> {
  try {
    const res = await fetch(ebayUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { url: null, error: `HTTP ${res.status} for ${ebayUrl}` };
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) return { url: null, error: `Empty response for ${ebayUrl}` };
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : "jpg";
    const blob = await put(`inventory/${Date.now()}-ebay.${ext}`, buffer, {
      access: "public",
      contentType: ct,
    });
    return { url: blob.url };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// Pre-allocate N sequential DW-SKUs in one DB read to avoid race conditions
async function allocateSkus(count: number): Promise<string[]> {
  const last = await prisma.item.findFirst({
    where: { sku: { startsWith: "DW-" } },
    orderBy: { sku: "desc" },
    select: { sku: true },
  });
  const base = last?.sku ? parseInt(last.sku.replace("DW-", ""), 10) : 0;
  return Array.from({ length: count }, (_, i) =>
    "DW-" + String(base + i + 1).padStart(6, "0")
  );
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

  // Dedup against non-archived items only
  const existingTitles = new Set(
    (await prisma.item.findMany({ where: { archived: false }, select: { title: true } }))
      .map((i) => i.title.trim().toLowerCase())
  );
  const existingEbayIds = new Set(
    (await prisma.item.findMany({
      where: { archived: false, notes: { contains: "eBay ItemID:" } },
      select: { notes: true },
    })).map((i) => i.notes?.match(/eBay ItemID: (\d+)/)?.[1]).filter(Boolean) as string[]
  );

  const toImport = listings.filter((l) =>
    !existingEbayIds.has(l.itemId) && !existingTitles.has(l.title.trim().toLowerCase())
  );
  const skipped = listings.length - toImport.length;

  if (toImport.length === 0) {
    return NextResponse.json({ imported: 0, skipped, failed: 0, total: listings.length });
  }

  // Pre-allocate all SKUs before parallel processing to avoid race conditions
  const skus = await allocateSkus(toImport.length);

  let imported = 0;
  let skusPushed = 0;
  let photosUploaded = 0;
  const photoErrors: string[] = [];
  const failed: string[] = [];

  // Process 3 items concurrently
  for (let i = 0; i < toImport.length; i += 3) {
    const batch = toImport.slice(i, i + 3);
    await Promise.all(batch.map(async (listing, batchIdx) => {
      const sku = skus[i + batchIdx];
      try {
        // 1. Download and re-host each photo — log failures instead of silently dropping
        const rehostResults = await Promise.all(
          listing.imageUrls.slice(0, 8).map(rehost)
        );
        const hostedUrls = rehostResults
          .filter((r) => r.url !== null)
          .map((r) => r.url as string);

        rehostResults
          .filter((r) => r.url === null && r.error)
          .forEach((r) => photoErrors.push(`${listing.itemId}: ${r.error}`));

        photosUploaded += hostedUrls.length;

        // 2. Generate AI description
        let description: string | null = null;
        let brand: string | null = null;
        let model: string | null = null;
        let category = "Other";
        try {
          const ai = await generateListing({
            item: listing.title,
            condition: listing.condition,
            category: "Other",
            imageUrls: hostedUrls,
            platform: "ebay",
          });
          description = ai.description;
          brand = ai.brand ?? null;
          model = ai.model ?? null;
          category = ai.category ?? "Other";
        } catch { /* create without description if AI fails */ }

        // 3. Push DW-SKU to eBay listing
        try {
          await reviseListingSku(accessToken, listing.itemId, sku);
          skusPushed++;
        } catch { /* non-fatal */ }

        // 4. Create item
        const imageGroupData = hostedUrls.length > 0
          ? {
              imageGroup: {
                create: {
                  images: {
                    create: hostedUrls.map((url, idx) => ({
                      sortOrder: idx,
                      image: { create: { url } },
                    })),
                  },
                },
              },
            }
          : {};

        const item = await prisma.item.create({
          data: {
            sku,
            title: listing.title,
            description,
            condition: { connect: { name: listing.condition } },
            category,
            brand,
            model,
            notes: `Imported from eBay. eBay ItemID: ${listing.itemId}`,
            ...imageGroupData,
          },
        });

        await prisma.inventory.create({ data: { itemId: item.id, quantity: 1 } });
        existingTitles.add(listing.title.trim().toLowerCase());
        existingEbayIds.add(listing.itemId);
        imported++;
      } catch (err) {
        failed.push(`ItemID ${listing.itemId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }));
  }

  return NextResponse.json({
    imported,
    skipped,
    photosUploaded,
    photoErrors: photoErrors.slice(0, 10),
    skusPushedToEbay: skusPushed,
    failed: failed.length,
    failedDetails: failed.slice(0, 10),
    total: listings.length,
  });
}
