import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";

let url = rawUrl;
if (rawUrl.startsWith("file:") && !rawUrl.startsWith("file:/")) {
  const filePath = rawUrl.replace(/^file:/, "");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  url = `file:${abs}`;
}

const client = createClient({
  url,
  ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
});

async function tableExists(name) {
  const result = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
  );
  return result.rows.length > 0;
}

async function run(label, sql) {
  try {
    await client.execute(sql);
    console.log(`✓ ${label}`);
  } catch (e) {
    const msg = String(e.message ?? e);
    if (
      msg.includes("duplicate column") ||
      msg.includes("already exists") ||
      msg.includes("no such table") ||
      msg.includes("no such column")
    ) {
      console.log(`– already applied: ${label}`);
    } else {
      console.error(`✗ Failed: ${label}\n  ${msg}`);
      process.exit(1);
    }
  }
}

// ── Step 1: Rename old tables so new tables can use their names ────────────
const renames = [
  ["InventoryItem", "_OldInventoryItem"],
  ["Listing", "_OldListing"],
  ["Order", "_OldOrder"],
  ["StoreOrder", "_OldStoreOrder"],
];

for (const [from, to] of renames) {
  if (await tableExists(from) && !await tableExists(to)) {
    await run(`rename ${from} → ${to}`, `ALTER TABLE "${from}" RENAME TO "${to}"`);
  } else {
    console.log(`– rename ${from}: already done or not needed`);
  }
}

// ── Step 2: Create new tables ──────────────────────────────────────────────
await run("create Item", `
  CREATE TABLE IF NOT EXISTS "Item" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "brand"        TEXT,
    "model"        TEXT,
    "category"     TEXT NOT NULL,
    "conditionId"  TEXT NOT NULL DEFAULT 'cond_used_good',
    "notes"        TEXT,
    "archived"     INTEGER NOT NULL DEFAULT 0,
    "imageGroupId" TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

await run("create ImageGroup", `
  CREATE TABLE IF NOT EXISTS "ImageGroup" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

await run("create Image", `
  CREATE TABLE IF NOT EXISTS "Image" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "url"       TEXT NOT NULL,
    "altText"   TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

await run("create ImageGroupImage", `
  CREATE TABLE IF NOT EXISTS "ImageGroupImage" (
    "imageGroupId" TEXT NOT NULL,
    "imageId"      TEXT NOT NULL,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("imageGroupId", "imageId")
  )
`);

await run("create Inventory", `
  CREATE TABLE IF NOT EXISTS "Inventory" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "itemId"             TEXT NOT NULL UNIQUE,
    "quantity"           INTEGER NOT NULL DEFAULT 0,
    "dateOfLastPurchase" DATETIME,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

await run("create Platform", `
  CREATE TABLE IF NOT EXISTS "Platform" (
    "id"   TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE
  )
`);

await run("create Listing", `
  CREATE TABLE IF NOT EXISTS "Listing" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "itemId"          TEXT NOT NULL UNIQUE,
    "listingTitle"    TEXT NOT NULL,
    "listingDesc"     TEXT,
    "listedPrice"     REAL NOT NULL DEFAULT 0,
    "freeShipping"    INTEGER NOT NULL DEFAULT 0,
    "listedOnEbay"    INTEGER NOT NULL DEFAULT 0,
    "listedOnMeta"    INTEGER NOT NULL DEFAULT 0,
    "listedOnMercari" INTEGER NOT NULL DEFAULT 0,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

await run("create OrderStatus", `
  CREATE TABLE IF NOT EXISTS "OrderStatus" (
    "id"   TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE
  )
`);

await run("create Customer", `
  CREATE TABLE IF NOT EXISTS "Customer" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "firstName"          TEXT NOT NULL,
    "lastName"           TEXT NOT NULL,
    "email"              TEXT NOT NULL UNIQUE,
    "street"             TEXT,
    "street2"            TEXT,
    "city"               TEXT,
    "state"              TEXT,
    "zip"                TEXT,
    "country"            TEXT DEFAULT 'US',
    "dateOfLastPurchase" DATETIME,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

await run("create Order", `
  CREATE TABLE IF NOT EXISTS "Order" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "itemId"          TEXT NOT NULL,
    "customerId"      TEXT,
    "statusId"        TEXT NOT NULL,
    "listingId"       TEXT,
    "salePrice"       REAL NOT NULL,
    "shippingCost"    REAL NOT NULL DEFAULT 0,
    "trackingCode"    TEXT,
    "labelUrl"        TEXT,
    "stripeSessionId" TEXT UNIQUE,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Ensure columns added after initial table creation exist
await run("add Item.notes", `ALTER TABLE "Item" ADD COLUMN "notes" TEXT`);
await run("add Item.archived", `ALTER TABLE "Item" ADD COLUMN "archived" INTEGER NOT NULL DEFAULT 0`);

// ── Step 3: Seed Platform lookup ───────────────────────────────────────────
const platforms = [
  { id: "platform_direct",   name: "direct" },
  { id: "platform_ebay",     name: "eBay" },
  { id: "platform_meta",     name: "meta" },
  { id: "platform_mercari",  name: "mercari" },
];
for (const p of platforms) {
  await run(`seed Platform(${p.name})`,
    `INSERT OR IGNORE INTO "Platform" ("id","name") VALUES ('${p.id}','${p.name}')`);
}

// ── Step 4: Seed OrderStatus lookup ───────────────────────────────────────
const statuses = [
  { id: "status_paid",      name: "paid" },
  { id: "status_shipped",   name: "shipped" },
  { id: "status_delivered", name: "delivered" },
  { id: "status_returned",  name: "returned" },
];
for (const s of statuses) {
  await run(`seed OrderStatus(${s.name})`,
    `INSERT OR IGNORE INTO "OrderStatus" ("id","name") VALUES ('${s.id}','${s.name}')`);
}

// ── Step 5: Migrate InventoryItem → Item + Inventory ──────────────────────
if (await tableExists("_OldInventoryItem")) {
  const oldItems = await client.execute(`SELECT * FROM "_OldInventoryItem"`);
  let migrated = 0;
  for (const row of oldItems.rows) {
    const id = row.id;
    const existing = await client.execute(
      `SELECT id FROM "Item" WHERE id = '${id}'`
    );
    if (existing.rows.length > 0) continue;

    // Migrate images: old format is a JSON array of URLs stored in `images`
    // We'll create an ImageGroup + Image records for each URL
    let imageGroupId = null;
    try {
      const imgs = JSON.parse(row.images || "[]");
      if (Array.isArray(imgs) && imgs.length > 0) {
        imageGroupId = `ig_${id}`;
        await client.execute(
          `INSERT OR IGNORE INTO "ImageGroup" ("id","name","createdAt","updatedAt") VALUES ('${imageGroupId}', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        );
        for (let i = 0; i < imgs.length; i++) {
          const imgId = `img_${id}_${i}`;
          const url = String(imgs[i]).replace(/'/g, "''");
          await client.execute(
            `INSERT OR IGNORE INTO "Image" ("id","url","createdAt") VALUES ('${imgId}', '${url}', CURRENT_TIMESTAMP)`
          );
          await client.execute(
            `INSERT OR IGNORE INTO "ImageGroupImage" ("imageGroupId","imageId","sortOrder") VALUES ('${imageGroupId}', '${imgId}', ${i})`
          );
        }
      }
    } catch {}

    const title = String(row.title || "").replace(/'/g, "''");
    const desc = row.description ? `'${String(row.description).replace(/'/g, "''")}'` : "NULL";
    const brand = row.brand ? `'${String(row.brand).replace(/'/g, "''")}'` : "NULL";
    const model = row.model ? `'${String(row.model).replace(/'/g, "''")}'` : "NULL";
    const category = String(row.category || "Other").replace(/'/g, "''");
    const oldCondMap = { Excellent: "cond_used_great", Good: "cond_used_good", Fair: "cond_used_poor", Poor: "cond_for_parts" };
    const conditionId = oldCondMap[String(row.condition || "")] ?? "cond_used_good";
    const notes = row.notes ? `'${String(row.notes).replace(/'/g, "''")}'` : "NULL";
    const igRef = imageGroupId ? `'${imageGroupId}'` : "NULL";

    await client.execute(
      `INSERT OR IGNORE INTO "Item" ("id","title","description","brand","model","category","conditionId","notes","archived","imageGroupId","createdAt","updatedAt")
       VALUES ('${id}', '${title}', ${desc}, ${brand}, ${model}, '${category}', '${conditionId}', ${notes}, 0, ${igRef}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    );

    const invId = `inv_${id}`;
    const qty = row.status === "sold" ? 0 : 1;
    await client.execute(
      `INSERT OR IGNORE INTO "Inventory" ("id","itemId","quantity","createdAt","updatedAt")
       VALUES ('${invId}', '${id}', ${qty}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    );

    // If item was listed in store, create a direct Listing
    if (row.shopEnabled) {
      const listingId = `lst_direct_${id}`;
      const shopTitle = row.shopTitle
        ? String(row.shopTitle).replace(/'/g, "''")
        : title;
      const shopPrice = row.shopPrice ?? row.purchasePrice ?? 0;
      const freeShip = row.freeShipping ? 1 : 0;
      const lstStatus = row.status === "sold" ? "sold" : "active";
      await client.execute(
        `INSERT OR IGNORE INTO "Listing" ("id","itemId","platformId","status","listingTitle","listedPrice","freeShipping","shopEnabled","createdAt","updatedAt")
         VALUES ('${listingId}', '${id}', 'platform_direct', '${lstStatus}', '${shopTitle}', ${shopPrice}, ${freeShip}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      );
    }

    migrated++;
  }
  console.log(`✓ Migrated ${migrated} InventoryItem(s) → Item + Inventory`);
}

// ── Step 6: Migrate old Listing (platform) records ────────────────────────
if (await tableExists("_OldListing")) {
  const oldListings = await client.execute(`SELECT * FROM "_OldListing"`);
  let migrated = 0;
  for (const row of oldListings.rows) {
    const existing = await client.execute(
      `SELECT id FROM "Listing" WHERE id = '${String(row.id)}'`
    );
    if (existing.rows.length > 0) continue;

    const platformMap = { meta: "platform_meta", ebay: "platform_ebay", mercari: "platform_mercari" };
    const platformId = platformMap[String(row.platform)] ?? "platform_direct";

    const id = String(row.id);
    const itemId = String(row.inventoryItemId);
    const itemExists = await client.execute(`SELECT id FROM "Item" WHERE id = '${itemId}'`);
    if (!itemExists.rows.length) continue;

    const title = String(row.listingTitle || "").replace(/'/g, "''");
    const desc = row.listingDesc ? `'${String(row.listingDesc).replace(/'/g, "''")}'` : "NULL";
    const price = row.listedPrice ?? 0;
    const status = String(row.status || "draft");

    await client.execute(
      `INSERT OR IGNORE INTO "Listing" ("id","itemId","platformId","status","listingTitle","listingDesc","listedPrice","freeShipping","shopEnabled","createdAt","updatedAt")
       VALUES ('${id}', '${itemId}', '${platformId}', '${status}', '${title}', ${desc}, ${price}, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    );
    migrated++;
  }
  console.log(`✓ Migrated ${migrated} platform Listing(s)`);
}

// ── Step 7: Migrate StoreOrder → Customer + Order ─────────────────────────
if (await tableExists("_OldStoreOrder")) {
  const oldOrders = await client.execute(`SELECT * FROM "_OldStoreOrder"`);
  let migrated = 0;
  for (const row of oldOrders.rows) {
    const orderId = String(row.id);
    const existing = await client.execute(
      `SELECT id FROM "Order" WHERE id = '${orderId}'`
    );
    if (existing.rows.length > 0) continue;

    const itemId = String(row.inventoryItemId);
    const itemExists = await client.execute(`SELECT id FROM "Item" WHERE id = '${itemId}'`);
    if (!itemExists.rows.length) continue;

    // Create or find Customer
    let customerId = null;
    if (row.customerEmail) {
      const email = String(row.customerEmail).replace(/'/g, "''");
      const existingCustomer = await client.execute(
        `SELECT id FROM "Customer" WHERE email = '${email}'`
      );
      if (existingCustomer.rows.length > 0) {
        customerId = String(existingCustomer.rows[0].id);
      } else {
        customerId = `cust_${orderId}`;
        const fullName = String(row.customerName || "").trim();
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] ? nameParts[0].replace(/'/g, "''") : "Guest";
        const lastName = nameParts.slice(1).join(" ").replace(/'/g, "''") || "Customer";

        let street = null, street2 = null, city = null, state = null, zip = null;
        try {
          const addr = JSON.parse(row.shippingAddress || "null");
          if (addr) {
            street = addr.line1 ? String(addr.line1).replace(/'/g, "''") : null;
            street2 = addr.line2 ? String(addr.line2).replace(/'/g, "''") : null;
            city = addr.city ? String(addr.city).replace(/'/g, "''") : null;
            state = addr.state ? String(addr.state).replace(/'/g, "''") : null;
            zip = addr.postal_code ? String(addr.postal_code).replace(/'/g, "''") : null;
          }
        } catch {}

        const streetVal = street ? `'${street}'` : "NULL";
        const street2Val = street2 ? `'${street2}'` : "NULL";
        const cityVal = city ? `'${city}'` : "NULL";
        const stateVal = state ? `'${state}'` : "NULL";
        const zipVal = zip ? `'${zip}'` : "NULL";

        await client.execute(
          `INSERT OR IGNORE INTO "Customer" ("id","firstName","lastName","email","street","street2","city","state","zip","country","createdAt","updatedAt")
           VALUES ('${customerId}', '${firstName}', '${lastName}', '${email}', ${streetVal}, ${street2Val}, ${cityVal}, ${stateVal}, ${zipVal}, 'US', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        );
      }
    }

    // Map old status to new OrderStatus id
    const statusMap = {
      paid: "status_paid",
      shipped: "status_shipped",
      delivered: "status_delivered",
      returned: "status_returned",
      pending: "status_paid",
      cancelled: "status_returned",
    };
    const statusId = statusMap[String(row.status)] ?? "status_paid";
    const custRef = customerId ? `'${customerId}'` : "NULL";
    const trackRef = row.trackingCode ? `'${String(row.trackingCode).replace(/'/g, "''")}'` : "NULL";
    const labelRef = row.labelUrl ? `'${String(row.labelUrl).replace(/'/g, "''")}'` : "NULL";
    const stripeRef = row.stripeSessionId ? `'${String(row.stripeSessionId).replace(/'/g, "''")}'` : "NULL";
    const salePrice = row.salePrice ?? 0;
    const shippingCost = row.shippingCost ?? 0;

    await client.execute(
      `INSERT OR IGNORE INTO "Order" ("id","itemId","customerId","statusId","salePrice","shippingCost","trackingCode","labelUrl","stripeSessionId","createdAt","updatedAt")
       VALUES ('${orderId}', '${itemId}', ${custRef}, '${statusId}', ${salePrice}, ${shippingCost}, ${trackRef}, ${labelRef}, ${stripeRef}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    );
    migrated++;
  }
  console.log(`✓ Migrated ${migrated} StoreOrder(s) → Customer + Order`);
}

// ── Step 8: Condition lookup table ────────────────────────────────────────
await run("create Condition", `
  CREATE TABLE IF NOT EXISTS "Condition" (
    "id"   TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE
  )
`);

const conditions = [
  ["cond_new",        "new"],
  ["cond_new_other",  "new other"],
  ["cond_used",       "used"],
  ["cond_for_parts",  "for parts"],
  ["cond_used_great", "used great"],
  ["cond_used_good",  "used good"],
  ["cond_used_poor",  "used poor"],
];
for (const [id, name] of conditions) {
  await run(`seed Condition(${name})`,
    `INSERT OR IGNORE INTO "Condition" ("id","name") VALUES ('${id}','${name}')`);
}

await run("add Item.conditionId",
  `ALTER TABLE "Item" ADD COLUMN "conditionId" TEXT NOT NULL DEFAULT 'cond_used_good'`);

// Backfill conditionId from old string condition column
const oldMap = {
  Excellent: "cond_used_great",
  Good:      "cond_used_good",
  Fair:      "cond_used_poor",
  Poor:      "cond_for_parts",
};
for (const [old, newId] of Object.entries(oldMap)) {
  await run(`backfill condition '${old}'`,
    `UPDATE "Item" SET "conditionId" = '${newId}' WHERE "condition" = '${old}'`);
}

// ── Step 9: Add new Inventory columns ─────────────────────────────────────
await run("add Inventory.dateOfLastSale",
  `ALTER TABLE "Inventory" ADD COLUMN "dateOfLastSale" DATETIME`);
await run("add Inventory.dateOfLastRestock",
  `ALTER TABLE "Inventory" ADD COLUMN "dateOfLastRestock" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
await run("backfill Inventory.dateOfLastRestock from createdAt",
  `UPDATE "Inventory" SET "dateOfLastRestock" = "createdAt" WHERE "dateOfLastRestock" = "createdAt" OR "dateOfLastRestock" IS NULL`);

// ── Step 10: Listings schema — replace platform-per-row with boolean flags ──
// Add new columns if they don't exist yet
await run("add Listing.listedOnEbay",    `ALTER TABLE "Listing" ADD COLUMN "listedOnEbay"    INTEGER NOT NULL DEFAULT 0`);
await run("add Listing.listedOnMeta",    `ALTER TABLE "Listing" ADD COLUMN "listedOnMeta"    INTEGER NOT NULL DEFAULT 0`);
await run("add Listing.listedOnMercari", `ALTER TABLE "Listing" ADD COLUMN "listedOnMercari" INTEGER NOT NULL DEFAULT 0`);

// Backfill flags from old platformId rows before collapsing (eBay → listedOnEbay, etc.)
// These UPDATE statements are no-ops if the old platformId column doesn't exist
await run("backfill listedOnEbay from old rows",    `UPDATE "Listing" SET "listedOnEbay"    = 1 WHERE "platformId" IN (SELECT "id" FROM "Platform" WHERE "name" = 'eBay')    AND "listedOnEbay"    = 0`);
await run("backfill listedOnMeta from old rows",    `UPDATE "Listing" SET "listedOnMeta"    = 1 WHERE "platformId" IN (SELECT "id" FROM "Platform" WHERE "name" = 'meta')    AND "listedOnMeta"    = 0`);
await run("backfill listedOnMercari from old rows", `UPDATE "Listing" SET "listedOnMercari" = 1 WHERE "platformId" IN (SELECT "id" FROM "Platform" WHERE "name" = 'mercari') AND "listedOnMercari" = 0`);

// Deduplicate: keep only one listing per item (the most recently updated non-direct one, or any)
// Delete direct-platform listings since shop is now implicit
await run("delete direct listings", `DELETE FROM "Listing" WHERE "platformId" IN (SELECT "id" FROM "Platform" WHERE "name" = 'direct')`);

// For items with multiple remaining listings, keep the newest and merge flags into it, then delete dupes
// Simplest safe approach: delete older duplicates (same itemId)
await run("deduplicate listings keep newest", `
  DELETE FROM "Listing" WHERE "id" NOT IN (
    SELECT "id" FROM "Listing" GROUP BY "itemId" HAVING "id" = MAX("id")
  ) AND "itemId" IN (
    SELECT "itemId" FROM "Listing" GROUP BY "itemId" HAVING COUNT(*) > 1
  )
`);

// Make itemId unique if it isn't already (SQLite can't ADD UNIQUE to existing column,
// so this is enforced at the app level via Prisma @unique — no DDL change needed here)

console.log("✓ Migration complete");
