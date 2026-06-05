"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";

interface Order {
  id: string;
  platform: string;
  salePrice: number;
  shippingCost: number | null;
  profit: number | null;
  status: string;
  buyerName: string | null;
  createdAt: string;
  listing: {
    listingTitle: string;
    inventoryItem: { id: string; title: string; purchasePrice: number };
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/orders").then((r) => r.json()).then(setOrders);
  }, []);

  const totalRevenue = orders.reduce((s, o) => s + o.salePrice, 0);
  const totalProfit = orders.reduce((s, o) => s + (o.profit ?? 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex gap-4 text-sm">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-center">
            <p className="text-gray-400 text-xs">Revenue</p>
            <p className="font-bold text-gray-900">${totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-center">
            <p className="text-gray-400 text-xs">Profit</p>
            <p className="font-bold text-green-600">${totalProfit.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Platform</th>
              <th className="text-left px-5 py-3 font-medium">Buyer</th>
              <th className="text-right px-5 py-3 font-medium">Cost</th>
              <th className="text-right px-5 py-3 font-medium">Sold For</th>
              <th className="text-right px-5 py-3 font-medium">Profit</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/inventory/${order.listing?.inventoryItem?.id}`}
                      className="font-medium text-gray-800 hover:text-amber-600 max-w-xs truncate block"
                    >
                      {order.listing?.inventoryItem?.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={order.platform} />
                  </td>
                  <td className="px-5 py-3 text-gray-600">{order.buyerName ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-gray-500">
                    ${order.listing?.inventoryItem?.purchasePrice?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    ${order.salePrice.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-green-600">
                    {order.profit != null ? `$${order.profit.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={order.status} />
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(order.createdAt).toLocaleDateString()}
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
