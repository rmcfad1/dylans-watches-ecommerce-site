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

async function nextDwSku(): Promise<string> {
  const last = await prisma.item.findFirst({
    where: { sku: { startsWith: "DW-" } },
    orderBy: { sku: "desc" },
    select: { sku: true },
  });
  const n = last?.sku ? parseInt(last.sku.replace("DW-", ""), 10) : 0;
  return "DW-" + String(n + 1).padStart(6, "0");
}

export async function POST() {
  let accessToken: string;
  try {
    accessToken = await getValidToken();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  // Fetch active listings via Trading API GetMyeBaySelling (100 per page)
  let listings;
  try {
    listings = await getMyEbaySellingListings(accessToken);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  if (listings.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, failed: 0, message: "No active listings found on eBay." });
  }

  // Load existing titles from non-archived items only so archived imports don't block re-import
  const existingTitles = new Set(
    (await prisma.item.findMany({
      where: { archived: false },
      select: { title: true },
    })).map((i) => i.title.trim().toLowerCase())
  );

  // Also track by eBay ItemID stored in notes
  const existingEbayIds = new Set(
    (await prisma.item.findMany({
      where: { archived: false, notes: { contains: "eBay ItemID:" } },
      select: { notes: true },
    })).map((i) => {
      const m = i.notes?.match(/eBay ItemID: (\d+)/);
      return m ? m[1] : null;
    }).filter(Boolean) as string[]
  );

  const toImport = listings.filter((l) => {
    if (existingEbayIds.has(l.itemId)) return false;
    if (existingTitles.has(l.title.trim().toLowerCase())) return false;
    return true;
  });

  const skipped = listings.length - toImport.length;
  let imported = 0;
  let skusPushed = 0;
  const failed: string[] = [];

  // Process 3 items concurrently — each downloads photos + calls AI
  for (let i = 0; i < toImport.length; i += 3) {
    const batch = toImport.slice(i, i + 3);
    await Promise.all(batch.map(async (listing) => {
      try {
        // 1. Download and re-host photos in parallel
        const hostedUrls = (
          await Promise.all(listing.imageUrls.slice(0, 8).map(rehost))
        ).filter((u): u is string => u !== null);

        // 2. Generate AI description using the listing title as the product blurb
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
        } catch {
          // AI failed — create item without description
        }

        // 3. Auto-generate DW- SKU
        const sku = await nextDwSku();

        // 4. Push the DW-SKU to the eBay listing via ReviseFixedPriceItem
        //    so the Inventory API can later be used to correlate data by SKU
        try {
          await reviseListingSku(accessToken, listing.itemId, sku);
          skusPushed++;
        } catch {
          // Non-fatal — item still gets created locally
        }

        // 5. Create item in the e-commerce app
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
    skusPushedToEbay: skusPushed,
    failed: failed.length,
    failedDetails: failed.slice(0, 10),
    total: listings.length,
    note: imported > 0
      ? `${imported} listings imported with AI descriptions and photos. ${skusPushed} DW-SKUs pushed to eBay.`
      : undefined,
  });
}
