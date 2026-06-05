"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface InventoryItem {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  condition: string;
  purchasePrice: number;
  status: string;
  listings: { id: string; platform: string; listedPrice: number; status: string }[];
  createdAt: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then(setItems);
  }, []);

  const filtered = items.filter((item) => {
    if (item.status === "archived") return false;
    if (filter !== "all" && item.status !== filter) return false;
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <Link
          href="/inventory/new"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Item
        </Link>
      </div>

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
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="listed">Listed</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Condition</th>
              <th className="text-left px-5 py-3 font-medium">Paid</th>
              <th className="text-left px-5 py-3 font-medium">Listed At</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Platforms</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No items found.{" "}
                  <Link href="/inventory/new" className="text-amber-600 hover:underline">
                    Add your first item
                  </Link>
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const activeListings = item.listings.filter((l) => l.status === "active");
                const highestPrice = Math.max(...item.listings.map((l) => l.listedPrice), 0);
                return (
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
                    <td className="px-5 py-3 text-gray-700">${item.purchasePrice.toFixed(2)}</td>
                    <td className="px-5 py-3 text-gray-700">
                      {highestPrice > 0 ? `$${highestPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge status={item.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {activeListings.length === 0 ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          activeListings.map((l) => (
                            <Badge key={l.id} status={l.platform} />
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
