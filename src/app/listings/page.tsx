"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface Listing {
  id: string;
  platform: string;
  listingTitle: string;
  listedPrice: number;
  status: string;
  platformUrl: string | null;
  inventoryItem: { id: string; title: string; condition: string };
  order: { salePrice: number; status: string } | null;
  createdAt: string;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState("active");

  useEffect(() => {
    fetch("/api/listings").then((r) => r.json()).then(setListings);
  }, []);

  const filtered = listings.filter(
    (l) => filter === "all" || l.status === filter
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="ended">Ended</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Platform</th>
              <th className="text-left px-5 py-3 font-medium">Price</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Listed</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No {filter} listings.{" "}
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
                      href={`/inventory/${listing.inventoryItem.id}`}
                      className="font-medium text-gray-800 hover:text-amber-600"
                    >
                      {listing.listingTitle}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{listing.inventoryItem.condition}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={listing.platform} />
                  </td>
                  <td className="px-5 py-3 text-gray-700">${listing.listedPrice.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <Badge status={listing.status} />
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(listing.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    {listing.platformUrl && (
                      <Link
                        href={listing.platformUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
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
