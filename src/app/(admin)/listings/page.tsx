"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface Listing {
  id: string;
  platform: { name: string };
  listingTitle: string;
  listedPrice: number;
  status: string;
  freeShipping: boolean;
  shopEnabled: boolean;
  item: { id: string; title: string; condition: { name: string } };
  orders: { id: string }[];
  createdAt: string;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/listings").then((r) => r.json()).then(setListings);
  }, []);

  async function toggleShop(listing: Listing) {
    setTogglingId(listing.id);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopEnabled: !listing.shopEnabled }),
      });
      if (res.ok) {
        const updated = await res.json();
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
            <option value="direct">Direct</option>
            <option value="eBay">eBay</option>
            <option value="meta">Meta</option>
            <option value="mercari">Mercari</option>
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
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Platform</th>
              <th className="text-left px-5 py-3 font-medium">Price</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Shop</th>
              <th className="text-left px-5 py-3 font-medium">Orders</th>
              <th className="text-left px-5 py-3 font-medium">Listed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No {filter !== "all" ? filter : ""} listings.{" "}
                  <Link href="/inventory" className="text-amber-600 hover:underline">
                    Go to inventory to create one.
                  </Link>
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
