"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Minus, X } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface InventoryItem {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  condition: string;
  archived: boolean;
  inventory: {
    quantity: number;
    dateOfLastSale: string | null;
    dateOfLastRestock: string | null;
  } | null;
  listings: { listedOnEbay: boolean; listedOnMeta: boolean; listedOnMercari: boolean }[];
  createdAt: string;
}

interface BareItem {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  condition: string;
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString();
}

function QtyControl({
  itemId,
  saved,
  onSaved,
}: {
  itemId: string;
  saved: number;
  onSaved: (q: number) => void;
}) {
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const dirty = draft !== saved;

  async function save() {
    if (!dirty) return;
    setSaving(true);
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, quantity: draft }),
    });
    onSaved(draft);
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setDraft((d) => Math.max(0, d - 1))}
        className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:border-gray-400 text-gray-500 hover:text-gray-800 transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-8 text-center font-medium tabular-nums text-sm">{draft}</span>
      <button
        onClick={() => setDraft((d) => d + 1)}
        className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:border-gray-400 text-gray-500 hover:text-gray-800 transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="ml-1 text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showSelector, setShowSelector] = useState(false);
  const [selectorItems, setSelectorItems] = useState<BareItem[]>([]);
  const [selectorSearch, setSelectorSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then(setItems);
  }, []);

  async function openSelector() {
    setShowSelector(true);
    setSelectorSearch("");
    const res = await fetch("/api/inventory?noInventory=1");
    const data = await res.json() as BareItem[];
    setSelectorItems(data);
  }

  async function addToInventory(item: BareItem) {
    setAdding(item.id);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (res.ok) {
        // Refresh the inventory list
        const refreshed = await fetch("/api/inventory").then((r) => r.json()) as InventoryItem[];
        setItems(refreshed);
        setSelectorItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } finally {
      setAdding(null);
    }
  }

  const filtered = items.filter((item) => {
    if (filter !== "all") {
      const qty = item.inventory?.quantity ?? 0;
      const hasActive = item.listings.some((l) => l.listedOnEbay || l.listedOnMeta || l.listedOnMercari);
      const status = item.archived ? "archived" : qty === 0 ? "sold" : hasActive ? "listed" : "available";
      if (status !== filter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredSelectorItems = selectorItems.filter((i) => {
    if (!selectorSearch) return true;
    const q = selectorSearch.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.brand?.toLowerCase().includes(q) ||
      i.model?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <button
          onClick={openSelector}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add to Inventory
        </button>
      </div>

      {/* Item Selector Panel */}
      {showSelector && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 text-sm">Select an item to add to inventory</h2>
            <button onClick={() => setShowSelector(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items…"
              value={selectorSearch}
              onChange={(e) => setSelectorSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
          </div>
          {filteredSelectorItems.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {selectorItems.length === 0
                ? "All items already have inventory records."
                : "No items match your search."}
            </p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {filteredSelectorItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-400">
                      {[item.brand, item.model].filter(Boolean).join(" ") || "—"} · {item.condition}
                    </p>
                  </div>
                  <button
                    onClick={() => addToInventory(item)}
                    disabled={adding === item.id}
                    className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    {adding === item.id ? "Adding…" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Items are added to the catalog from the{" "}
            <Link href="/items" className="text-amber-600 hover:underline">Items tab</Link>.
          </p>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="all">All</option>
          <option value="available">Available</option>
          <option value="listed">Listed</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Condition</th>
              <th className="text-left px-5 py-3 font-medium">Quantity</th>
              <th className="text-left px-5 py-3 font-medium">Last Sale</th>
              <th className="text-left px-5 py-3 font-medium">Last Restock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  No items found.{" "}
                  <button onClick={openSelector} className="text-amber-600 hover:underline">
                    Add to inventory
                  </button>
                  {" "}or{" "}
                  <Link href="/items" className="text-amber-600 hover:underline">
                    create a new item
                  </Link>.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/inventory/${item.id}`} className="font-medium text-gray-800 hover:text-amber-600">
                      {item.title}
                    </Link>
                    {item.brand && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.brand} {item.model}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={item.condition} />
                  </td>
                  <td className="px-5 py-3">
                    <QtyControl
                      itemId={item.id}
                      saved={item.inventory?.quantity ?? 0}
                      onSaved={(q) =>
                        setItems((prev) =>
                          prev.map((i) =>
                            i.id === item.id
                              ? { ...i, inventory: i.inventory ? { ...i.inventory, quantity: q, dateOfLastRestock: new Date().toISOString() } : { quantity: q, dateOfLastSale: null, dateOfLastRestock: new Date().toISOString() } }
                              : i
                          )
                        )
                      }
                    />
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {fmt(item.inventory?.dateOfLastSale ?? null)}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {fmt(item.inventory?.dateOfLastRestock ?? null)}
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
