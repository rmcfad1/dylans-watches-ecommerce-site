"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, X, RefreshCw, CheckSquare } from "lucide-react";
import Badge from "@/components/ui/Badge";

const PLATFORMS = [
  { key: "listedOnEbay",    label: "eBay" },
  { key: "listedOnMeta",    label: "Meta" },
  { key: "listedOnMercari", label: "Mercari" },
] as const;

type PlatformKey = typeof PLATFORMS[number]["key"];

interface InventoryRow {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  condition: string;
  inventory: { quantity: number } | null;
}

interface Listing {
  id: string;
  itemId: string;
  listingTitle: string;
  listedPrice: number;
  freeShipping: boolean;
  listedOnEbay: boolean;
  listedOnMeta: boolean;
  listedOnMercari: boolean;
  item: {
    id: string;
    title: string;
    condition: { name: string };
    inventory: { quantity: number } | null;
  };
  orders: { id: string }[];
  createdAt: string;
}

// Per-item draft state when bulk-creating
interface ItemDraft {
  item: InventoryRow;
  title: string;
  price: string;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [platformFilter, setPlatformFilter] = useState<"all" | PlatformKey>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Create panel
  const [showCreate, setShowCreate] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryRow[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [platforms, setPlatforms] = useState<Record<PlatformKey, boolean>>({
    listedOnEbay: false, listedOnMeta: false, listedOnMercari: false,
  });
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ created: number; failed: number } | null>(null);

  useEffect(() => {
    fetch("/api/listings").then((r) => r.json()).then(setListings).catch(() => {});
  }, []);

  async function openCreatePanel() {
    if (showCreate) return;
    setShowCreate(true);
    setDrafts([]);
    setItemSearch("");
    setFreeShipping(false);
    setPlatforms({ listedOnEbay: false, listedOnMeta: false, listedOnMercari: false });
    setCreateResult(null);
    try {
      const r = await fetch("/api/inventory?listable=1");
      const data = await r.json() as InventoryRow[];
      setInventoryItems(data);
    } catch {
      setInventoryItems([]);
    }
  }

  function toggleDraft(item: InventoryRow) {
    setDrafts((prev) => {
      const exists = prev.find((d) => d.item.id === item.id);
      if (exists) return prev.filter((d) => d.item.id !== item.id);
      return [...prev, { item, title: item.title, price: "" }];
    });
  }

  function updateDraft(id: string, field: "title" | "price", value: string) {
    setDrafts((prev) => prev.map((d) => d.item.id === id ? { ...d, [field]: value } : d));
  }

  async function createListings() {
    const valid = drafts.filter((d) => d.title && d.price && Number(d.price) > 0);
    if (valid.length === 0) return;
    setCreating(true);
    setCreateResult(null);
    let created = 0;
    let failed = 0;
    // Run serially — parallel requests overload Turso's connection limit
    for (const draft of valid) {
      try {
        const res = await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: draft.item.id,
            listingTitle: draft.title,
            listedPrice: Number(draft.price),
            freeShipping,
            ...platforms,
          }),
        });
        if (res.ok) created++; else failed++;
      } catch { failed++; }
    }
    setCreating(false);
    setCreateResult({ created, failed });
    if (created > 0) {
      fetch("/api/listings").then((r) => r.json()).then(setListings).catch(() => {});
      // Remove created items from drafts and inventory list
      const createdIds = new Set(valid.map((d) => d.item.id));
      setDrafts((prev) => prev.filter((d) => !createdIds.has(d.item.id)));
      setInventoryItems((prev) => prev.filter((i) => !createdIds.has(i.id)));
    }
  }

  const metaCount = listings.filter((l) => l.listedOnMeta).length;

  async function syncToMeta() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/meta/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg({ ok: true, text: data.synced > 0 ? `Synced ${data.synced} item${data.synced === 1 ? "" : "s"} to Meta.` : (data.message ?? "Nothing to sync.") });
      } else {
        setSyncMsg({ ok: false, text: data.error ?? "Sync failed." });
      }
    } catch {
      setSyncMsg({ ok: false, text: "Network error during sync." });
    } finally {
      setSyncing(false);
    }
  }

  async function togglePlatform(listing: Listing, key: PlatformKey) {
    setSavingId(listing.id);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !listing[key] }),
      });
      if (res.ok) {
        const updated = await res.json() as Listing;
        setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, ...updated } : l));
      }
    } finally {
      setSavingId(null);
    }
  }

  const filtered = listings.filter((l) => platformFilter === "all" || l[platformFilter as PlatformKey]);

  const filteredItems = inventoryItems.filter((i) => {
    if (!itemSearch) return true;
    const q = itemSearch.toLowerCase();
    return i.title.toLowerCase().includes(q) || i.brand?.toLowerCase().includes(q) || i.model?.toLowerCase().includes(q);
  });

  const selectedIds = new Set(drafts.map((d) => d.item.id));
  const readyCount = drafts.filter((d) => d.title && Number(d.price) > 0).length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
        <div className="flex gap-2">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as typeof platformFilter)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">All Platforms</option>
            {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button
            onClick={syncToMeta}
            disabled={syncing || metaCount === 0}
            className="flex items-center gap-2 border border-gray-200 hover:border-amber-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing…" : "Sync to Meta"}
          </button>
          <button
            onClick={openCreatePanel}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Listing
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`mb-4 text-sm rounded-lg px-4 py-2.5 flex items-center justify-between ${syncMsg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          <span>{syncMsg.text}</span>
          <button onClick={() => setSyncMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Create Listings Panel */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700 text-sm">Create Listings</h2>
            <button onClick={() => setShowCreate(false)} disabled={creating} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
              <X className="w-4 h-4" />
            </button>
          </div>

          {createResult && (
            <div className={`mb-4 text-sm rounded-lg px-4 py-2.5 ${createResult.failed === 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {createResult.created > 0 && `${createResult.created} listing${createResult.created !== 1 ? "s" : ""} created.`}
              {createResult.failed > 0 && ` ${createResult.failed} failed.`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Left: item picker */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Select items ({drafts.length} selected)
              </label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items…"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto border border-gray-100 rounded-lg">
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">
                    {inventoryItems.length === 0 ? "Every in-stock item is already listed." : "No items match your search."}
                  </p>
                ) : filteredItems.map((item) => {
                  const checked = selectedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleDraft(item)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${checked ? "bg-amber-50" : "hover:bg-gray-50"}`}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={checked}
                        className="rounded border-gray-300 text-amber-500 pointer-events-none"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                        <p className="text-xs text-gray-400">
                          {[item.brand, item.model].filter(Boolean).join(" ") || "—"} · <Badge status={item.condition} />
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: per-item price + shared settings */}
            <div className="space-y-4">
              {/* Shared settings */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Platforms</label>
                <div className="flex gap-4">
                  {PLATFORMS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platforms[p.key]}
                        onChange={(e) => setPlatforms((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                        className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                      />
                      <span className="text-sm text-gray-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freeShipping}
                    onChange={(e) => setFreeShipping(e.target.checked)}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm text-gray-700">Free shipping on all selected</span>
                </label>
              </div>

              {/* Per-item drafts */}
              {drafts.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg py-8 text-center text-sm text-gray-400">
                  <CheckSquare className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  Select items on the left to set prices
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {drafts.map((draft) => (
                    <div key={draft.item.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-gray-700 leading-snug line-clamp-1">{draft.item.title}</p>
                        <button onClick={() => toggleDraft(draft.item)} className="text-gray-300 hover:text-gray-500 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) => updateDraft(draft.item.id, "title", e.target.value)}
                          placeholder="Listing title"
                          className="col-span-3 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <div className="col-span-2 relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.price}
                            onChange={(e) => updateDraft(draft.item.id, "price", e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-5 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={createListings}
                disabled={readyCount === 0 || creating}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating
                  ? "Creating…"
                  : readyCount === 0
                  ? "Select items and set prices"
                  : `Create ${readyCount} Listing${readyCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listings Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Price</th>
              <th className="text-left px-5 py-3 font-medium">Qty</th>
              <th className="text-left px-5 py-3 font-medium">eBay</th>
              <th className="text-left px-5 py-3 font-medium">Meta</th>
              <th className="text-left px-5 py-3 font-medium">Mercari</th>
              <th className="text-left px-5 py-3 font-medium">Orders</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No listings.{" "}
                  <button onClick={openCreatePanel} className="text-amber-600 hover:underline">Create a listing</button>
                </td>
              </tr>
            ) : (
              filtered.map((listing) => (
                <tr key={listing.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/inventory/${listing.item.id}`} className="font-medium text-gray-800 hover:text-amber-600">
                      {listing.listingTitle}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{listing.item.condition.name}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    ${listing.listedPrice.toFixed(2)}
                    {listing.freeShipping && <span className="ml-1 text-xs text-green-600">Free ship</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs tabular-nums">
                    {listing.item.inventory?.quantity ?? "—"}
                  </td>
                  {PLATFORMS.map((p) => (
                    <td key={p.key} className="px-5 py-3">
                      <button
                        onClick={() => togglePlatform(listing, p.key)}
                        disabled={savingId === listing.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${listing[p.key] ? "bg-green-500" : "bg-gray-200"}`}
                      >
                        {savingId === listing.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-auto text-white" />
                        ) : (
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${listing[p.key] ? "translate-x-4.5" : "translate-x-0.5"}`} />
                        )}
                      </button>
                    </td>
                  ))}
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {listing.orders.length === 0 ? "—" : `${listing.orders.length} order${listing.orders.length > 1 ? "s" : ""}`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
