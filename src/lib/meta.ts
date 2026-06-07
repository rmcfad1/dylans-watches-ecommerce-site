const META_GRAPH_URL = "https://graph.facebook.com/v19.0";

export interface MetaProduct {
  name: string;
  description: string;
  price: string; // e.g. "29.99 USD"
  currency: string;
  availability: "in stock" | "out of stock";
  condition: "new" | "refurbished" | "used";
  image_url: string;
  retailer_id: string; // your internal SKU / inventory item ID
}

export interface MetaProductResponse {
  id: string;
}

export async function createMetaProduct(
  catalogId: string,
  accessToken: string,
  product: MetaProduct
): Promise<MetaProductResponse> {
  const res = await fetch(
    `${META_GRAPH_URL}/${catalogId}/products`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...product,
        access_token: accessToken,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Meta API error: ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function updateMetaProduct(
  productId: string,
  accessToken: string,
  updates: Partial<MetaProduct>
): Promise<void> {
  const params = new URLSearchParams({
    ...updates,
    access_token: accessToken,
  } as Record<string, string>);

  const res = await fetch(
    `${META_GRAPH_URL}/${productId}?${params}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Meta API error: ${JSON.stringify(err)}`);
  }
}

export async function deleteMetaProduct(
  productId: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(
    `${META_GRAPH_URL}/${productId}?access_token=${accessToken}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Meta API error: ${JSON.stringify(err)}`);
  }
}

export function mapConditionToMeta(
  condition: string
): "new" | "refurbished" | "used" {
  if (condition === "new" || condition === "new other") return "new";
  if (condition === "used great") return "refurbished";
  return "used";
}

// A single product in the format Meta's catalog batch API expects.
// `id` is the retailer_id (our item id) — Meta upserts on it, so syncing
// the same item repeatedly updates the existing product instead of duplicating.
export interface MetaCatalogItem {
  id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new" | "refurbished" | "used";
  price: string; // e.g. "29.99 USD"
  link: string;
  image_link: string;
  additional_image_link?: string; // up to 10 extra images, comma-separated
  brand: string;
  google_product_category: string;
  quantity_to_sell_on_facebook?: number;
}

export interface MetaSyncResult {
  handles: string[];
  validationStatus?: unknown;
}

// Upsert a batch of products into a Meta catalog via the items_batch edge.
// method "UPDATE" creates the item if it doesn't exist and updates it if it does.
export async function syncMetaCatalog(
  catalogId: string,
  accessToken: string,
  items: MetaCatalogItem[]
): Promise<MetaSyncResult> {
  const res = await fetch(`${META_GRAPH_URL}/${catalogId}/items_batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_type: "PRODUCT_ITEM",
      requests: items.map((data) => ({ method: "UPDATE", data })),
      access_token: accessToken,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Meta API error: ${JSON.stringify(json)}`);
  }
  return { handles: json.handles ?? [], validationStatus: json.validation_status };
}
