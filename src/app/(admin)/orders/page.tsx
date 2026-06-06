"use client";

import { useEffect, useState } from "react";
import { Package, Truck, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  street: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface StoreOrder {
  id: string;
  item: { id: string; title: string };
  customer: Customer | null;
  orderStatus: { name: string };
  listing: { id: string } | null;
  salePrice: number;
  shippingCost: number;
  trackingCode: string | null;
  labelUrl: string | null;
  stripeSessionId: string | null;
  createdAt: string;
}

function AddressBlock({ customer }: { customer: Customer | null }) {
  if (!customer?.street) return <span className="text-gray-400">—</span>;
  return (
    <span className="text-xs text-gray-500 leading-relaxed">
      {customer.street}{customer.street2 ? `, ${customer.street2}` : ""}<br />
      {customer.city}, {customer.state} {customer.zip}
    </span>
  );
}

function LabelCell({ order, onUpdate }: { order: StoreOrder; onUpdate: (o: StoreOrder) => void }) {
  const [weight, setWeight] = useState("8");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const hasAddress = Boolean(order.customer?.street);
  const [line1, setLine1] = useState(order.customer?.street ?? "");
  const [city, setCity] = useState(order.customer?.city ?? "");
  const [state, setState] = useState(order.customer?.state ?? "");
  const [zip, setZip] = useState(order.customer?.zip ?? "");

  if (order.trackingCode) {
    return (
      <div className="space-y-1">
        <a
          href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.trackingCode}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-amber-600 hover:underline"
        >
          <Truck className="w-3 h-3" /> {order.trackingCode}
        </a>
        {order.labelUrl && (
          <a href={order.labelUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> Download label
          </a>
        )}
      </div>
    );
  }

  const statusName = order.orderStatus.name;
  if (statusName === "paid" || statusName === "pending") {
    if (!open) {
      return (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium">
          <Package className="w-3 h-3" /> Create Label
        </button>
      );
    }
    return (
      <div className="space-y-2 min-w-[220px]">
        {!hasAddress && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Ship-to address</p>
            <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address"
              className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
            <div className="flex gap-1">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City"
                className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              <input value={state} onChange={(e) => setState(e.target.value)} placeholder="ST" maxLength={2}
                className="w-12 border border-gray-200 rounded px-2 py-1 text-xs uppercase" />
              <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP"
                className="w-20 border border-gray-200 rounded px-2 py-1 text-xs" />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={weight} onChange={(e) => setWeight(e.target.value)}
            className="w-16 border border-gray-200 rounded px-2 py-1 text-xs" placeholder="oz" />
          <span className="text-xs text-gray-400">oz</span>
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex gap-1">
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true); setErr(null);
              try {
                const manualAddress = !hasAddress ? { line1, city, state, postal_code: zip, country: "US" } : undefined;
                const res = await fetch("/api/orders", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: order.id, weightOz: parseFloat(weight), manualAddress }),
                });
                let data: StoreOrder & { error?: string };
                try {
                  data = await res.json();
                } catch {
                  setErr(`Server error (${res.status})`);
                  setLoading(false);
                  return;
                }
                if (!res.ok) { setErr((data as { error?: string }).error ?? "Failed"); }
                else { onUpdate(data); }
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Network error");
              }
              setLoading(false);
            }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
            Buy Label
          </button>
          <button onClick={() => setOpen(false)} className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      </div>
    );
  }

  return <span className="text-xs text-gray-400">{statusName}</span>;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]));
  }, []);

  const totalRevenue = orders.reduce((s, o) => s + o.salePrice, 0);

  function handleUpdate(updated: StoreOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  const statusIcon = (name: string) => {
    if (name === "delivered") return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    if (name === "shipped") return <Truck className="w-3.5 h-3.5 text-blue-500" />;
    return null;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex gap-4 text-sm">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-center">
            <p className="text-gray-400 text-xs">Revenue</p>
            <p className="font-bold text-gray-900">${totalRevenue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Customer</th>
              <th className="text-left px-5 py-3 font-medium">Ship to</th>
              <th className="text-right px-5 py-3 font-medium">Sale</th>
              <th className="text-left px-5 py-3 font-medium">Channel</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Shipping label</th>
              <th className="text-left px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">No orders yet.</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 align-top">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800 max-w-[180px] truncate">{order.item.title}</p>
                  </td>
                  <td className="px-5 py-3">
                    {order.customer ? (
                      <>
                        <p className="text-gray-700">{order.customer.firstName} {order.customer.lastName}</p>
                        <p className="text-xs text-gray-400">{order.customer.email}</p>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <AddressBlock customer={order.customer} />
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    ${order.salePrice.toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge status={order.stripeSessionId ? "shop" : "meta"} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(order.orderStatus.name)}
                      <Badge status={order.orderStatus.name} />
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <LabelCell order={order} onUpdate={handleUpdate} />
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
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
