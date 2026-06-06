"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2, Sparkles, Camera, X } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface Listing {
  id: string;
  listingTitle: string;
  listingDesc: string | null;
  listedPrice: number;
  freeShipping: boolean;
  listedOnEbay: boolean;
  listedOnMeta: boolean;
  listedOnMercari: boolean;
  orders: { id: string }[];
}

interface Item {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  category: string;
  condition: string;
  notes: string | null;
  archived: boolean;
  images: string;
  listings: Listing[];
  createdAt: string;
}

const PLATFORMS = [
  { key: "listedOnEbay" as const,    label: "eBay" },
  { key: "listedOnMeta" as const,    label: "Meta" },
  { key: "listedOnMercari" as const, label: "Mercari" },
];

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [showListingForm, setShowListingForm] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const uploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listingForm, setListingForm] = useState({
    listingTitle: "",
    listingDesc: "",
    listedPrice: "",
    freeShipping: false,
    listedOnEbay: false,
    listedOnMeta: false,
    listedOnMercari: false,
  });

  useEffect(() => {
    if (id) fetch(`/api/inventory/${id}`).then((r) => r.json()).then((data) => {
      setItem(data);
      const listing: Listing | undefined = data.listings?.[0];
      if (listing) {
        setListingForm({
          listingTitle: listing.listingTitle,
          listingDesc: listing.listingDesc ?? "",
          listedPrice: String(listing.listedPrice),
          freeShipping: listing.freeShipping,
          listedOnEbay: listing.listedOnEbay,
          listedOnMeta: listing.listedOnMeta,
          listedOnMercari: listing.listedOnMercari,
        });
      } else {
        setListingForm((f) => ({ ...f, listingTitle: data.title }));
      }
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
      await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, images: [...currentImages, url] }),
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
    await fetch(`/api/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, images: currentImages.filter((u) => u !== url) }),
    });
    setItem(await fetch(`/api/inventory/${id}`).then((r) => r.json()));
  }

  async function clearAllPhotos() {
    await fetch(`/api/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, images: [] }),
    });
    setItem(await fetch(`/api/inventory/${id}`).then((r) => r.json()));
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
        setListingForm((f) => ({
          ...f,
          listingTitle: data.title,
          listingDesc: data.description,
          listedPrice: data.suggestedPrice?.toString() ?? f.listedPrice,
        }));
        setShowListingForm(true);
      }
    } finally {
      setGeneratingFor(null);
    }
  }

  async function saveListing(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSavingListing(true);
    const listing = item.listings?.[0];
    const method = listing ? "PUT" : "POST";
    const url = listing ? `/api/listings/${listing.id}` : "/api/listings";
    const body = listing
      ? { ...listingForm, listedPrice: Number(listingForm.listedPrice) }
      : { ...listingForm, listedPrice: Number(listingForm.listedPrice), itemId: id };
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const refreshed = await fetch(`/api/inventory/${id}`).then((r) => r.json());
        setItem(refreshed);
        setShowListingForm(false);
      }
    } finally {
      setSavingListing(false);
    }
  }

  if (!item) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const images: string[] = (() => { try { return JSON.parse(item.images || "[]"); } catch { return []; } })();
  const listing = item.listings?.[0] ?? null;

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
          {item.brand && <p className="text-gray-500 mt-1">{item.brand} {item.model}</p>}
        </div>
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

      {/* Photos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-gray-400" /> Photos
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

      {/* Listing */}
      <div className="bg-white rounded-xl border border-gray-200 mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Listing</h2>
          <button
            onClick={() => setShowListingForm(!showListingForm)}
            className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700"
          >
            <Plus className="w-4 h-4" /> {listing ? "Edit Listing" : "Create Listing"}
          </button>
        </div>

        {/* AI generation bar */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-400 mr-1">Generate title &amp; description with AI:</span>
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => generateForPlatform(p.label)}
              disabled={!!generatingFor}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {generatingFor === p.label ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-purple-500" />}
              {p.label}
            </button>
          ))}
        </div>

        {showListingForm && (
          <form onSubmit={saveListing} className="px-5 py-4 border-b border-gray-100 space-y-3 bg-amber-50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price ($)</label>
                <input
                  type="number" step="0.01" min="0" value={listingForm.listedPrice}
                  onChange={(e) => setListingForm((f) => ({ ...f, listedPrice: e.target.value }))}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listingForm.freeShipping}
                    onChange={(e) => setListingForm((f) => ({ ...f, freeShipping: e.target.checked }))}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm text-gray-700">Free shipping</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                type="text" value={listingForm.listingTitle}
                onChange={(e) => setListingForm((f) => ({ ...f, listingTitle: e.target.value }))}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={listingForm.listingDesc}
                onChange={(e) => setListingForm((f) => ({ ...f, listingDesc: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Listed on</label>
              <div className="flex gap-4">
                {PLATFORMS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={listingForm[p.key]}
                      onChange={(e) => setListingForm((f) => ({ ...f, [p.key]: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-sm text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowListingForm(false)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-white">
                Cancel
              </button>
              <button type="submit" disabled={savingListing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {savingListing && <Loader2 className="w-3 h-3 animate-spin" />}
                Save Listing
              </button>
            </div>
          </form>
        )}

        {!listing ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            No listing yet — create one or generate with AI above.
          </div>
        ) : (
          <div className="px-5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{listing.listingTitle}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  ${listing.listedPrice.toFixed(2)}{listing.freeShipping && " · Free shipping"}
                  {listing.orders.length > 0 && ` · ${listing.orders.length} order(s)`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {PLATFORMS.map((p) => (
                  <span
                    key={p.key}
                    className={`text-xs px-2 py-0.5 rounded font-medium ${listing[p.key] ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
