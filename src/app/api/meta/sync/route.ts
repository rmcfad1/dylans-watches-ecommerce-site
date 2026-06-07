import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncMetaCatalog, type MetaCatalogItem } from "@/lib/meta";

// Push every Meta-flagged listing to the Meta catalog immediately, instead of
// waiting for Meta to pull the scheduled product feed. Mirrors the field
// mapping in /api/meta/product-feed so both produce identical catalog data.
export async function POST() {
  const connection = await prisma.platformConnection.findUnique({ where: { platform: "meta" } });
  if (!connection?.isActive || !connection.accessToken || !connection.catalogId) {
    return NextResponse.json(
      { error: "Meta Commerce isn't connected. Add your Access Token and Catalog ID in Settings." },
      { status: 400 }
    );
  }

  const listings = await prisma.listing.findMany({
    where: { listedOnMeta: true },
    include: {
      item: {
        include: {
          condition: true,
          inventory: true,
          imageGroup: {
            include: { images: { include: { image: true }, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });

  if (listings.length === 0) {
    return NextResponse.json({ synced: 0, message: "No items are marked for Meta yet." });
  }

  const baseUrl = process.env.NEXT_PUBLIC_STORE_URL ?? "https://dylans-watches-ecommerce-site.vercel.app";

  const skipped: string[] = [];
  const items: MetaCatalogItem[] = [];

  for (const listing of listings) {
    const item = listing.item;
    const images = (item.imageGroup?.images ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((igi) => igi.image.url)
      .filter(Boolean);

    if (!images[0]) {
      skipped.push(listing.listingTitle);
      continue;
    }

    const inStock = (item.inventory?.quantity ?? 0) > 0;
    const qty = item.inventory?.quantity ?? 0;

    const catalogItem: MetaCatalogItem = {
      id: item.id,
      title: listing.listingTitle,
      description: listing.listingDesc ?? item.description ?? listing.listingTitle,
      availability: inStock ? "in stock" : "out of stock",
      condition: metaCondition(item.condition.name),
      price: `${listing.listedPrice.toFixed(2)} USD`,
      link: `${baseUrl}/shop/${item.id}`,
      image_link: images[0],
      brand: item.brand ?? item.category,
      google_product_category: googleCategory(item.category),
      quantity_to_sell_on_facebook: qty,
    };

    if (images.length > 1) {
      catalogItem.additional_image_link = images.slice(1, 11).join(",");
    }

    items.push(catalogItem);
  }

  if (items.length === 0) {
    return NextResponse.json({
      synced: 0,
      skipped: skipped.length,
      message: skipped.length > 0
        ? `No items synced — ${skipped.length} listing(s) have no images: ${skipped.join(", ")}`
        : "No items are marked for Meta yet.",
    });
  }

  try {
    const result = await syncMetaCatalog(connection.catalogId, connection.accessToken, items);
    return NextResponse.json({ synced: items.length, skipped: skipped.length, handles: result.handles });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

function metaCondition(c: string): "new" | "refurbished" | "used" {
  if (c === "new" || c === "new other") return "new";
  if (c === "used great") return "refurbished";
  return "used";
}

function googleCategory(category: string): string {
  if (category === "Smartwatch") return "Electronics > GPS & Navigation > GPS Accessories > GPS Trackers";
  if (category === "Watch") return "Apparel & Accessories > Jewelry > Watches";
  return "Electronics";
}
