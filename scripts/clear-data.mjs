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

const tables = [
  "Order",
  "Customer",
  "Inventory",
  "Listing",
  "ImageGroupImage",
  "Image",
  "ImageGroup",
  "Item",
  "_OldInventoryItem",
  "_OldListing",
  "_OldOrder",
  "_OldStoreOrder",
];

for (const table of tables) {
  try {
    const result = await client.execute(`DELETE FROM "${table}"`);
    console.log(`✓ Cleared ${table} (${result.rowsAffected} rows)`);
  } catch (e) {
    const msg = String(e.message ?? e);
    if (msg.includes("no such table")) {
      console.log(`– ${table}: table not found, skipping`);
    } else {
      console.error(`✗ ${table}: ${msg}`);
    }
  }
}

console.log("✓ Done");
