import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAllInventoryItems, refreshAccessToken } from "@/lib/ebay";

async function getValidToken(): Promise<string> {
  const conn = await prisma.platformConnection.findUnique({ where: { platform: "ebay" } });
  if (!conn?.accessToken) throw new Error("eBay not connected. Connect via Settings → Platforms.");

  // Refresh if expiring within 5 minutes
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

async function downloadAndUpload(imageUrl: string): Promise<string | null> {
  try {
    const { put } = await import("@vercel/blob");
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const buffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";
    const blob = await put(`inventory/${Date.now()}-ebay-import.${ext}`, buffer, {
      access: "public",
      contentType,
    });
    return blob.url;
  } catch {
    return null;
  }
}

export async function POST() {
  let accessToken: string;
  try {
    accessToken = await getValidToken();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  // Fetch all eBay inventory items
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

  let imported = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const ebayItem of ebayItems) {
    if (existingSkus.has(ebayItem.sku)) {
      skipped++;
      continue;
    }

    try {
      // Download and re-host photos
      const uploadedUrls: string[] = [];
      for (const imgUrl of ebayItem.imageUrls.slice(0, 12)) {
        const hosted = await downloadAndUpload(imgUrl);
        if (hosted) uploadedUrls.push(hosted);
      }

      // Create item via inventory POST logic (inline to avoid HTTP round-trip)
      const { generateListing } = await import("@/lib/ai");

      let title = ebayItem.title;
      let description = ebayItem.description || null;
      let brand: string | null = null;
      let model: string | null = null;
      let category = "Other";

      try {
        const ai = await generateListing({
          item: ebayItem.title,
          condition: ebayItem.condition,
          category: "Other",
          notes: ebayItem.description || undefined,
          imageUrls: uploadedUrls,
          platform: "ebay",
        });
        title = ai.titles.ebay;
        description = ebayItem.description || ai.description;
        brand = ai.brand ?? null;
        model = ai.model ?? null;
        category = ai.category ?? "Other";
      } catch {
        // AI failed — use eBay title/description as-is
      }

      const imageGroupData = uploadedUrls.length > 0
        ? {
            imageGroup: {
              create: {
                images: {
                  create: uploadedUrls.map((url, i) => ({
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
          sku: ebayItem.sku,
          title,
          description,
          condition: { connect: { name: ebayItem.condition } },
          category,
          brand,
          model,
          notes: ebayItem.description ? `Imported from eBay. Original description: ${ebayItem.description.slice(0, 300)}` : "Imported from eBay.",
          ...imageGroupData,
        },
      });

      await prisma.inventory.create({ data: { itemId: item.id, quantity: 1 } });
      existingSkus.add(ebayItem.sku);
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
  });
}
