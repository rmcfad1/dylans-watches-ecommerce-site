const EBAY_API_BASE = "https://api.ebay.com";
const EBAY_AUTH_BASE = "https://auth.ebay.com";
const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";

export const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
].join(" ");

function basicAuth(): string {
  const id = process.env.EBAY_CLIENT_ID ?? "";
  const secret = process.env.EBAY_CLIENT_SECRET ?? "";
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

export function getAuthorizationUrl(state?: string): string {
  const ruName = process.env.EBAY_RUNAME ?? "";
  const params = new URLSearchParams({
    client_id: process.env.EBAY_CLIENT_ID ?? "",
    redirect_uri: ruName,
    response_type: "code",
    scope: EBAY_SCOPES,
    ...(state ? { state } : {}),
  });
  return `${EBAY_AUTH_BASE}/oauth2/authorize?${params}`;
}

export interface EbayTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function exchangeCodeForTokens(code: string): Promise<EbayTokens> {
  const ruName = process.env.EBAY_RUNAME ?? "";
  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`eBay token exchange failed: ${err}`);
  }
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<EbayTokens> {
  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_SCOPES,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`eBay token refresh failed: ${err}`);
  }
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export interface EbayInventoryItem {
  sku: string;
  title: string;
  description: string;
  condition: string;
  imageUrls: string[];
  price: number | null;
  categoryId: string | null;
}

export async function fetchAllInventoryItems(accessToken: string): Promise<EbayInventoryItem[]> {
  const items: EbayInventoryItem[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const res = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}`, "Accept-Language": "en-US" } }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`eBay inventory fetch failed: ${err}`);
    }
    const data = await res.json() as {
      inventoryItems?: {
        sku: string;
        product?: { title?: string; description?: string; imageUrls?: string[]; aspects?: Record<string, string[]> };
        condition?: string;
      }[];
      total?: number;
    };

    const batch = data.inventoryItems ?? [];
    for (const item of batch) {
      items.push({
        sku: item.sku,
        title: item.product?.title ?? item.sku,
        description: item.product?.description ?? "",
        condition: mapEbayCondition(item.condition),
        imageUrls: item.product?.imageUrls ?? [],
        price: null,
        categoryId: null,
      });
    }

    if (batch.length < limit) break;
    offset += limit;
  }

  return items;
}

// Create or replace an eBay inventory item under a new SKU (used to assign DW- SKUs to eBay listings)
export async function putInventoryItem(
  accessToken: string,
  newSku: string,
  sourceItem: EbayInventoryItem
): Promise<void> {
  const body = {
    product: {
      title: sourceItem.title,
      description: sourceItem.description || sourceItem.title,
      imageUrls: sourceItem.imageUrls,
    },
    condition: toEbayCondition(sourceItem.condition),
    availability: { shipToLocationAvailability: { quantity: 1 } },
  };

  const res = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(newSku)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Language": "en-US",
        "Accept-Language": "en-US",
      },
      body: JSON.stringify(body),
    }
  );

  // 204 = created/updated, 200 = ok
  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`eBay putInventoryItem failed (${res.status}): ${err}`);
  }
}

function toEbayCondition(condition: string): string {
  if (condition === "new") return "NEW";
  if (condition === "used great") return "LIKE_NEW";
  if (condition === "used good") return "GOOD";
  if (condition === "used poor") return "ACCEPTABLE";
  if (condition === "for parts") return "FOR_PARTS_OR_NOT_WORKING";
  return "GOOD";
}

function mapEbayCondition(ebayCondition?: string): string {
  const c = (ebayCondition ?? "").toUpperCase();
  if (c === "NEW") return "new";
  if (c === "LIKE_NEW" || c === "MANUFACTURER_REFURBISHED") return "used great";
  if (c === "VERY_GOOD") return "used great";
  if (c === "GOOD") return "used good";
  if (c === "ACCEPTABLE") return "used poor";
  if (c === "FOR_PARTS_OR_NOT_WORKING") return "for parts";
  return "used good";
}
