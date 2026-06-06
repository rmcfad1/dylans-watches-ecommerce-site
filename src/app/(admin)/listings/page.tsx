"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, X } from "lucide-react";
import Badge from "@/components/ui/Badge";

const PLATFORMS = ["direct", "eBay", "meta", "mercari"];

interface InventoryRow {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  condition: string;
  inventory: { quantity: number } | null;
  listings: { platform: { name: string } }[];
}

interface Listing {
  id: string;
  platform: { name: string };
  listingTitle: string;
  listedPrice: number;
  status: string;
  freeShipping: boolean;
  shopEnabled: boolean;
  item: {
    id: string;
    title: string;
    condition: { name: string };
    inventory: { quantity: number } | null;
  };
  orders: { id: string }[];
  createdAt: string;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Create Listing panel state
  const [showCreate, setShowCreate] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryRow[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null);
  const [platform, setPlatform] = useState("direct");
  const [listingTitle, setListingTitle] = useState("");
  const [price, setPrice] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then(setListings)
      .catch(() => {});
  }, []);

  function resetForm() {
    setSelectedItem(null);
    setItemSearch("");
    setPlatform("direct");
    setListingTitle("");
    setPrice("");
    setFreeShipping(false);
  }

  async function openCreatePanel() {
    if (showCreate) return;
    setShowCreate(true);
    resetForm();
    try {
      const r = await fetch("/api/inventory");
      if (!r.ok) throw new Error();
      const data = await r.json() as InventoryRow[];
      setInventoryItems(data);
    } catch {
      setInventoryItems([]);
    }
  }

  function selectItem(item: InventoryRow) {
    setSelectedItem(item);
    setListingTitle(item.title);
    setPlatform("direct");
    setFreeShipping(false);
    setPrice("");
  }

  async function createListing() {
    if (!selectedItem || !listingTitle || !price || usedPlatforms.has(platform)) return;
    setCreating(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          platform,
          listingTitle,
          listedPrice: Number(price),
          freeShipping,
          status: "draft",
          shopEnabled: platform === "direct",
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        fetch("/api/listings")
          .then((r) => r.json())
          .then(setListings)
          .catch(() => {});
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleShop(listing: Listing) {
    setTogglingId(listing.id);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopEnabled: !listing.shopEnabled }),
      });
      if (res.ok) {
        const updated = await res.json() as Listing;
        setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, shopEnabled: updated.shopEnabled } : l));
      }
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = listings.filter((l) => {
    if (filter !== "all" && l.status !== filter) return false;
    if (platformFilter !== "all" && l.platform.name !== platformFilter) return false;
    return true;
  });

  const filteredItems = inventoryItems.filter((i) => {
    if (!itemSearch) return true;
    const q = itemSearch.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.brand?.toLowerCase().includes(q) ||
      i.model?.toLowerCase().includes(q)
    );
  });

  // Derived from live listings state so it stays current after a successful create
  const usedPlatforms = new Set(
    selectedItem
      ? listings.filter((l) => l.item.id === selectedItem.id).map((l) => l.platform.name)
      : []
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
        <div className="flex gap-2">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">All Platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="ended">Ended</option>
          </select>
          <button
            onClick={openCreatePanel}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Listing
          </button>
        </div>
      </div>

      {/* Create Listing Panel */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">Create Listing</h2>
            <button onClick={() => setShowCreate(false)} disabled={creating} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step 1: Select inventory item */}
          {!selectedItem ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Select an inventory item
              </label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items…"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  autoFocus
                />
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">No inventory items found.</p>
                ) : filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectItem(item)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50 text-left transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-400">
                        {[item.brand, item.model].filter(Boolean).join(" ") || "—"}
                        {" · "}<Badge status={item.condition} />
                        {item.inventory && <span className="ml-1">· Qty: {item.inventory.quantity}</span>}
                      </p>
                    </div>
                    <span className="text-xs text-amber-600 font-medium">Select →</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Step 2: Fill listing details */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{selectedItem.title}</p>
                  <p className="text-xs text-gray-500">
                    {selectedItem.condition} · Qty available: {selectedItem.inventory?.quantity ?? 0}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p} disabled={usedPlatforms.has(p)}>
                        {p}{usedPlatforms.has(p) ? " (already listed)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Title</label>
                <input
                  type="text"
                  value={listingTitle}
                  onChange={(e) => setListingTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={(e) => setFreeShipping(e.target.checked)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                />
                <span className="text-sm text-gray-700">Free shipping</span>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={createListing}
                  disabled={!listingTitle || !price || creating || usedPlatforms.has(platform)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating ? "Creating…" : "Create Listing"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Listings Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Platform</th>
              <th className="text-left px-5 py-3 font-medium">Price</th>
              <th className="text-left px-5 py-3 font-medium">Qty</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Shop</th>
              <th className="text-left px-5 py-3 font-medium">Orders</th>
              <th className="text-left px-5 py-3 font-medium">Listed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No {filter !== "all" ? filter : ""} listings.{" "}
                  <button onClick={openCreatePanel} className="text-amber-600 hover:underline">
                    Create a listing
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((listing) => (
                <tr key={listing.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/inventory/${listing.item.id}`}
                      className="font-medium text-gray-800 hover:text-amber-600"
                    >
                      {listing.listingTitle}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{listing.item.condition.name}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={listing.platform.name} />
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    ${listing.listedPrice.toFixed(2)}
                    {listing.freeShipping && (
                      <span className="ml-1 text-xs text-green-600">Free ship</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs tabular-nums">
                    {listing.item.inventory?.quantity ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={listing.status} />
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleShop(listing)}
                      disabled={togglingId === listing.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${listing.shopEnabled ? "bg-green-500" : "bg-gray-200"}`}
                      title={listing.shopEnabled ? "Disable shop" : "Enable shop"}
                    >
                      {togglingId === listing.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mx-auto text-white" />
                      ) : (
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${listing.shopEnabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {listing.orders.length === 0 ? "—" : `${listing.orders.length} order${listing.orders.length > 1 ? "s" : ""}`}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(listing.createdAt).toLocaleDateString()}
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
