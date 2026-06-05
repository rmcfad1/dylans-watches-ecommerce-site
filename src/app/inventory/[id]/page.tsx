"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, ExternalLink, Loader2, Sparkles, Send, Store, Camera, X } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Link from "next/link";

interface Listing {
  id: string;
  platform: string;
  listingTitle: string;
  listedPrice: number;
  status: string;
  platformListingId: string | null;
  platformUrl: string | null;
  order: { salePrice: number; profit: number | null; status: string; buyerName: string | null } | null;
}

interface Item {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  category: string;
  condition: string;
  purchasePrice: number;
  status: string;
  notes: string | null;
  images: string;
  shopEnabled: boolean;
  shopPrice: number | null;
  shopTitle: string | null;
  listings: Listing[];
  createdAt: string;
}

const PLATFORMS = ["meta", "ebay", "mercari"];

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [showListingForm, setShowListingForm] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [shopPrice, setShopPrice] = useState("");
  const [shopTitle, setShopTitle] = useState("");
  const [savingStore, setSavingStore] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const uploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newListing, setNewListing] = useState({
    platform: "meta",
    listingTitle: "",
    listingDesc: "",
    listedPrice: "",
  });

  useEffect(() => {
    if (id) fetch(`/api/inventory/${id}`).then((r) => r.json()).then((data) => {
      setItem(data);
      setShopPrice(data.shopPrice?.toString() ?? "");
      setShopTitle(data.shopTitle ?? "");
    });
  }, [id]);

  async function uploadPhoto(file: File) {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) { alert("Upload failed"); return; }
      const { url } = await res.json();
      const currentImages: string[] = JSON.parse(item!.images || "[]");
      const updated = [...currentImages, url];
      await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, images: updated }),
      });
      const refreshed = await fetch(`/api/inventory/${id}`).then((r) => r.json());
      setItem(refreshed);
    } finally {
      uploadingRef.current = false;
      setUploadingPhoto(false);
    }
  }

  async function removePhoto(url: string) {
    const currentImages: string[] = JSON.parse(item!.images || "[]");
    const updated = currentImages.filter((u) => u !== url);
    await fetch(`/api/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, images: updated }),
    });
    const refreshed = await fetch(`/api/inventory/${id}`).then((r) => r.json());
    setItem(refreshed);
  }

  async function clearAllPhotos() {
    await fetch(`/api/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, images: [] }),
    });
    const refreshed = await fetch(`/api/inventory/${id}`).then((r) => r.json());
    setItem(refreshed);
  }

  async function saveStoreSettings(enabled: boolean) {
    setSavingStore(true);
    await fetch(`/api/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...item,
        shopEnabled: enabled,
        shopPrice: shopPrice ? parseFloat(shopPrice) : null,
        shopTitle: shopTitle || null,
      }),
    });
    const refreshed = await fetch(`/api/inventory/${id}`).then((r) => r.json());
    setItem(refreshed);
    setSavingStore(false);
  }

  async function generateForPlatform(platform: string) {
    if (!item) return;
    setGeneratingFor(platform);
    try {
      const res = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: item.brand,
          model: item.model,
          category: item.category,
          condition: item.condition,
          notes: item.notes,
          platform,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewListing((l) => ({
          ...l,
          platform,
          listingTitle: data.title,
          listingDesc: data.description,
          listedPrice: data.suggestedPrice.toString(),
        }));
        setShowListingForm(true);
      }
    } finally {
      setGeneratingFor(null);
    }
  }

  async function saveListing(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newListing, inventoryItemId: id }),
    });
    if (res.ok) {
      const refreshed = await fetch(`/api/inventory/${id}`).then((r) => r.json());
      setItem(refreshed);
      setShowListingForm(false);
    }
  }

  async function publishToMeta(listingId: string) {
    setPublishingId(listingId);
    try {
      const res = await fetch("/api/meta/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();
      if (res.ok) {
        const refreshed = await fetch(`/api/inventory/${id}`).then((r) => r.json());
        setItem(refreshed);
      } else {
        alert(`Publish failed: ${data.error}`);
      }
    } finally {
      setPublishingId(null);
    }
  }

  if (!item) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
          {item.brand && (
            <p className="text-gray-500 mt-1">{item.brand} {item.model}</p>
          )}
        </div>
        <Badge status={item.status} className="mt-1" />
      </div>

      {/* Item details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Category</p>
          <p className="font-medium">{item.category}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Condition</p>
          <Badge status={item.condition} />
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Purchase Price</p>
          <p className="font-medium">${item.purchasePrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Added</p>
          <p className="font-medium">{new Date(item.createdAt).toLocaleDateString()}</p>
        </div>
        {item.notes && (
          <div className="col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Notes</p>
            <p className="text-gray-700">{item.notes}</p>
          </div>
        )}
        {item.description && (
          <div className="col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Description</p>
            <p className="text-gray-700 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}
      </div>

      {/* Photos section */}
      {(() => {
        const parsed = (() => { try { return JSON.parse(item.images || "[]"); } catch { return []; } })();
        const images: string[] = Array.isArray(parsed) ? parsed : [];
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-gray-400" />
                Photos
              </h2>
              <div className="flex gap-2">
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => { if (confirm("Remove all photos?")) clearAllPhotos(); }}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" /> Clear All
                </button>
              )}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {uploadingPhoto ? "Uploading…" : "Add Photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) uploadPhoto(f);
                }}
              />
              </div>
            </div>
            {images.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No photos yet — click &ldquo;Add Photo&rdquo; to upload.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {images.map((url) => (
                  <div key={url} className="relative group aspect-square">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-100" />
                    <button
                      onClick={() => removePhoto(url)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Listings section */}
      <div className="bg-white rounded-xl border border-gray-200 mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Listings</h2>
          <button
            onClick={() => setShowListingForm(!showListingForm)}
            className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700"
          >
            <Plus className="w-4 h-4" /> Add Listing
          </button>
        </div>

        {/* AI quick-generate buttons */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex gap-2 flex-wrap">
          <span className="text-xs text-gray-400 self-center mr-1">Generate with AI:</span>
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => generateForPlatform(p)}
              disabled={generatingFor === p}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {generatingFor === p ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3 text-purple-500" />
              )}
              {p}
            </button>
          ))}
        </div>

        {/* New listing form */}
        {showListingForm && (
          <form onSubmit={saveListing} className="px-5 py-4 border-b border-gray-100 space-y-3 bg-amber-50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
                <select
                  value={newListing.platform}
                  onChange={(e) => setNewListing((l) => ({ ...l, platform: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newListing.listedPrice}
                  onChange={(e) => setNewListing((l) => ({ ...l, listedPrice: e.target.value }))}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={newListing.listingTitle}
                onChange={(e) => setNewListing((l) => ({ ...l, listingTitle: e.target.value }))}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={newListing.listingDesc}
                onChange={(e) => setNewListing((l) => ({ ...l, listingDesc: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowListingForm(false)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                Save Draft
              </button>
            </div>
          </form>
        )}

        {/* Existing listings */}
        {item.listings.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            No listings yet — click &ldquo;Generate with AI&rdquo; to create one.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {item.listings.map((listing) => (
              <div key={listing.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge status={listing.platform} />
                    <Badge status={listing.status} />
                    {listing.order && <Badge status={listing.order.status} />}
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{listing.listingTitle}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Listed at ${listing.listedPrice.toFixed(2)}
                    {listing.order && ` · Sold for $${listing.order.salePrice.toFixed(2)}`}
                    {listing.order?.profit != null && ` · Profit: $${listing.order.profit.toFixed(2)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {listing.platform === "meta" && listing.status === "draft" && (
                    <button
                      onClick={() => publishToMeta(listing.id)}
                      disabled={publishingId === listing.id}
                      className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {publishingId === listing.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      Publish
                    </button>
                  )}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Store / Meta Commerce panel */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-gray-900">Store &amp; Meta Commerce</h2>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${item.shopEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {item.shopEnabled ? "Live in store" : "Not in store"}
          </span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500">
            Enable this item to show in your public shop at <code className="bg-gray-100 px-1 rounded">/shop</code> and in your Meta Commerce catalog feed for Facebook &amp; Instagram Shop.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Store Title (optional)</label>
              <input
                type="text"
                value={shopTitle}
                onChange={(e) => setShopTitle(e.target.value)}
                placeholder={item.title}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Store Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={shopPrice}
                onChange={(e) => setShopPrice(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => saveStoreSettings(true)}
              disabled={savingStore || !shopPrice}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40"
            >
              {savingStore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Store className="w-3.5 h-3.5" />}
              {item.shopEnabled ? "Update Store Listing" : "Enable in Store"}
            </button>
            {item.shopEnabled && (
              <button
                onClick={() => saveStoreSettings(false)}
                disabled={savingStore}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Remove from Store
              </button>
            )}
            {item.shopEnabled && (
              <Link
                href={`/shop/${item.id}`}
                target="_blank"
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View in Store
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
