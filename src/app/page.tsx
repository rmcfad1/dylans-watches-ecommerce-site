"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Tag, ShoppingBag, TrendingUp, Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface RecentOrder {
  id: string;
  platform: string;
  salePrice: number;
  profit: number | null;
  status: string;
  createdAt: string;
  listing: {
    listingTitle: string;
    inventoryItem: { title: string };
  };
}

interface Stats {
  totalItems: number;
  availableItems: number;
  activeListings: number;
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  recentOrders: RecentOrder[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  const cards = [
    {
      label: "Total Items",
      value: stats?.totalItems ?? "—",
      sub: `${stats?.availableItems ?? "—"} available`,
      icon: Package,
      href: "/inventory",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Active Listings",
      value: stats?.activeListings ?? "—",
      sub: "across platforms",
      icon: Tag,
      href: "/listings",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Total Orders",
      value: stats?.totalOrders ?? "—",
      sub: "all time",
      icon: ShoppingBag,
      href: "/orders",
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Total Profit",
      value: stats ? `$${stats.totalProfit.toFixed(2)}` : "—",
      sub: `$${stats?.totalRevenue?.toFixed(2) ?? "—"} revenue`,
      icon: TrendingUp,
      href: "/orders",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back — here&apos;s your business at a glance.</p>
        </div>
        <Link
          href="/inventory/new"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Item
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Link key={card.label} href={card.href}>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          <Link href="/orders" className="text-sm text-amber-600 hover:underline">View all</Link>
        </div>
        {stats?.recentOrders?.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No orders yet — list your first item to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">Item</th>
                <th className="text-left px-5 py-3 font-medium">Platform</th>
                <th className="text-left px-5 py-3 font-medium">Sale Price</th>
                <th className="text-left px-5 py-3 font-medium">Profit</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentOrders?.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800 truncate max-w-xs">
                    {order.listing?.inventoryItem?.title}
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={order.platform} />
                  </td>
                  <td className="px-5 py-3 text-gray-700">${order.salePrice.toFixed(2)}</td>
                  <td className="px-5 py-3 text-green-600 font-medium">
                    {order.profit != null ? `$${order.profit.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
