const EBAY_API_BASE = "https://api.ebay.com";
const EBAY_TRADING_API = "https://api.ebay.com/ws/api.dll";
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

// ---------------------------------------------------------------------------
// Trading API — GetMyeBaySelling
// Uses the XML-based Trading API which works with the same OAuth IAF token.
// Returns all active listings with title, condition, and photo URLs.
// ---------------------------------------------------------------------------

export interface EbayActiveListing {
  itemId: string;
  title: string;
  condition: string;
  imageUrls: string[];
  price: number | null;
}

function extractXmlValues(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function extractXmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "g");
  return xml.match(re) ?? [];
}

function mapTradingCondition(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("new")) return "new";
  if (c.includes("like new") || c.includes("very good")) return "used great";
  if (c.includes("good")) return "used good";
  if (c.includes("acceptable") || c.includes("poor")) return "used poor";
  if (c.includes("parts") || c.includes("not working")) return "for parts";
  return "used good";
}

export async function getMyEbaySellingListings(accessToken: string): Promise<EbayActiveListing[]> {
  const allItems: EbayActiveListing[] = [];
  let pageNumber = 1;
  const entriesPerPage = 100;

  while (true) {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination>
      <EntriesPerPage>${entriesPerPage}</EntriesPerPage>
      <PageNumber>${pageNumber}</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;

    const res = await fetch(EBAY_TRADING_API, {
      method: "POST",
      headers: {
        "X-EBAY-API-SITEID": "0",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "1421",
        "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
        "X-EBAY-API-IAF-TOKEN": accessToken,
        "Content-Type": "text/xml",
      },
      body: xmlBody,
    });

    const xml = await res.text();

    if (!res.ok || xml.includes("<Ack>Failure</Ack>")) {
      const errMsg = extractXmlValues(xml, "LongMessage")[0] ?? extractXmlValues(xml, "ShortMessage")[0] ?? xml.slice(0, 300);
      throw new Error(`GetMyeBaySelling failed: ${errMsg}`);
    }

    // Scope extraction to <ActiveList> only — prevents SoldList/UnsoldList items
    // from leaking in when the response contains multiple list containers.
    const activeListBlock = extractXmlBlocks(xml, "ActiveList")[0] ?? "";
    const itemArrayBlock = extractXmlBlocks(activeListBlock, "ItemArray")[0] ?? "";
    const itemBlocks = extractXmlBlocks(itemArrayBlock, "Item");
    for (const block of itemBlocks) {
      const itemId = extractXmlValues(block, "ItemID")[0] ?? "";
      const title = extractXmlValues(block, "Title")[0] ?? "";
      const conditionRaw = extractXmlValues(block, "ConditionDisplayName")[0] ?? "used good";
      // PictureURL (full size) preferred; GalleryURL (thumbnail) as fallback
      const pictureUrls = extractXmlValues(block, "PictureURL").filter(Boolean);
      const galleryUrls = extractXmlValues(block, "GalleryURL").filter(Boolean);
      const imageUrls = pictureUrls.length > 0 ? pictureUrls : galleryUrls;
      const priceStr = extractXmlValues(block, "CurrentPrice")[0] ?? extractXmlValues(block, "StartPrice")[0];
      const price = priceStr ? parseFloat(priceStr) : null;

      if (itemId && title) {
        allItems.push({
          itemId,
          title,
          condition: mapTradingCondition(conditionRaw),
          imageUrls,
          price,
        });
      }
    }

    // Check if there are more pages
    const totalPages = parseInt(extractXmlValues(xml, "TotalNumberOfPages")[0] ?? "1", 10);
    if (pageNumber >= totalPages) break;
    pageNumber++;
  }

  return allItems;
}

// Fetch all photo URLs for a single listing via GetItem.
// GetMyeBaySelling only returns the primary photo; GetItem returns all of them.
export async function getItemPhotos(accessToken: string, itemId: string): Promise<string[]> {
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ItemReturnDescription</DetailLevel>
  <IncludeItemSpecifics>false</IncludeItemSpecifics>
</GetItemRequest>`;

  const res = await fetch(EBAY_TRADING_API, {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1421",
      "X-EBAY-API-CALL-NAME": "GetItem",
      "X-EBAY-API-IAF-TOKEN": accessToken,
      "Content-Type": "text/xml",
    },
    body: xmlBody,
  });

  const xml = await res.text();
  if (!res.ok || xml.includes("<Ack>Failure</Ack>")) return [];

  const pictureUrls = extractXmlValues(xml, "PictureURL").filter(Boolean);
  const galleryUrls = extractXmlValues(xml, "GalleryURL").filter(Boolean);
  // Return full-size pictures; fall back to gallery thumbnail if none
  return pictureUrls.length > 0 ? pictureUrls : galleryUrls;
}

// Push a SKU to an active eBay fixed-price listing via ReviseFixedPriceItem (Trading API).
// This is what enables the Inventory API to return descriptions for items by SKU.
export async function reviseListingSku(accessToken: string, itemId: string, sku: string): Promise<void> {
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${itemId}</ItemID>
    <SKU>${sku}</SKU>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const res = await fetch(EBAY_TRADING_API, {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1421",
      "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
      "X-EBAY-API-IAF-TOKEN": accessToken,
      "Content-Type": "text/xml",
    },
    body: xmlBody,
  });

  const xml = await res.text();
  if (xml.includes("<Ack>Failure</Ack>")) {
    const err = extractXmlValues(xml, "LongMessage")[0] ?? extractXmlValues(xml, "ShortMessage")[0] ?? "";
    throw new Error(`ReviseFixedPriceItem failed: ${err}`);
  }
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
