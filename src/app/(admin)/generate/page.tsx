"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Loader2, Copy, Check, RefreshCw, PlusCircle, Upload, X,
  ImageIcon, Star, Camera,
} from "lucide-react";
import type { GeneratedListing, PhotoNote } from "@/lib/ai";

const CONDITIONS = ["new", "new other", "used", "used great", "used good", "used poor", "for parts"];
const CATEGORIES = ["Smartwatch", "Watch", "Electronics", "Other"];

const PLATFORM_LABELS: Record<string, string> = {
  ebay: "eBay",
  meta: "Meta (FB/IG)",
  mercari: "Mercari",
  direct: "Direct",
};

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  ebay: 80,
  meta: 100,
  mercari: 40,
  direct: 80,
};

const PLATFORM_COLORS: Record<string, string> = {
  ebay: "bg-yellow-50 border-yellow-200 text-yellow-800",
  meta: "bg-blue-50 border-blue-200 text-blue-800",
  mercari: "bg-red-50 border-red-200 text-red-800",
  direct: "bg-gray-50 border-gray-200 text-gray-800",
};

const PLATFORM_BADGE: Record<string, string> = {
  ebay: "bg-yellow-100 text-yellow-700 border-yellow-300",
  meta: "bg-blue-100 text-blue-700 border-blue-300",
  mercari: "bg-red-100 text-red-700 border-red-300",
  direct: "bg-gray-100 text-gray-700 border-gray-300",
};

type PlatformKey = "ebay" | "meta" | "mercari" | "direct";

export default function GeneratePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [form, setForm] = useState({
    item: "",
    category: "Smartwatch",
    condition: "used good",
    notes: "",
  });
  const [photos, setPhotos] = useState<
    { file: File; url: string; uploading: boolean; blobUrl?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GeneratedListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("ebay");

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function uploadFile(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url as string;
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;

    const entries = arr.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      uploading: true,
      blobUrl: undefined as string | undefined,
    }));
    setPhotos((prev) => [...prev, ...entries]);

    for (const entry of entries) {
      const blobUrl = await uploadFile(entry.file);
      setPhotos((prev) =>
        prev.map((p) =>
          p.url === entry.url
            ? { ...p, uploading: false, blobUrl: blobUrl ?? undefined }
            : p
        )
      );
    }
  }, []);

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p.url !== url));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const imageUrls = photos.filter((p) => p.blobUrl).map((p) => p.blobUrl!);
      const res = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, platform: "ebay", imageUrls }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Generation failed");
      else setResult(data as GeneratedListing);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  async function saveToInventory() {
    if (!result) return;
    setSaving(true);
    try {
      const titleToSave = result.titles
        ? result.titles[selectedPlatform]
        : result.title;

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleToSave,
          description: result.description,
          category: form.category,
          condition: form.condition,
          notes: form.notes,
        }),
      });
      if (!res.ok) return;
      const item = await res.json();

      const uploadedUrls = photos.filter((p) => p.blobUrl).map((p) => p.blobUrl!);
      if (uploadedUrls.length > 0) {
        await fetch(`/api/inventory/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: uploadedUrls }),
        });
      }

      router.push(`/inventory/${item.id}`);
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const canGenerate =
    form.item.trim().length > 0 && !loading && photos.every((p) => !p.uploading);

  const photoAnalysis = result?.photoAnalysis ?? null;

  function noteForPhoto(index: number, notes: PhotoNote[]): string | null {
    return notes.find((n) => n.index === index)?.note ?? null;
  }

  function orderBadge(index: number): number | null {
    if (!photoAnalysis) return null;
    const pos = photoAnalysis.recommendedOrder.indexOf(index);
    return pos === -1 ? null : pos + 1;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          AI Listing Generator
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Describe your item, add photos, and Claude will write platform-optimized titles,
          a description, price suggestion, and photo quality feedback.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-5">

        {/* Product name */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Product Name</label>
            <span
              className={`text-xs ${form.item.length > 80 ? "text-red-500 font-medium" : "text-gray-400"}`}
            >
              {form.item.length}/80
            </span>
          </div>
          <input
            type="text"
            value={form.item}
            onChange={(e) => set("item", e.target.value.slice(0, 80))}
            placeholder="e.g. Apple Watch Series 8 GPS 41mm Silver Aluminum"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        {/* Category + Condition */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Missing charger, scratches on bezel, original box included, etc."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        {/* Photo upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photos{" "}
            <span className="text-gray-400 font-normal">
              (optional — Claude will analyze them and suggest best order)
            </span>
          </label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-purple-400 bg-purple-50"
                : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  addFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Drag &amp; drop photos here, or{" "}
              <span className="text-purple-600 font-medium">click to browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — multiple files supported</p>
          </div>

          {/* Thumbnails with optional analysis overlay */}
          {photos.length > 0 && (
            <div className="mt-3 flex gap-3 flex-wrap">
              {photos.map((p, idx) => {
                const note = photoAnalysis
                  ? noteForPhoto(idx, photoAnalysis.photoNotes)
                  : null;
                const rank = orderBadge(idx);
                const isHero = photoAnalysis?.heroIndex === idx;

                return (
                  <div key={p.url} className="relative group w-24">
                    <div className="relative w-24 h-24">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt=""
                        className={`w-full h-full object-cover rounded-lg border-2 ${
                          isHero
                            ? "border-purple-500"
                            : "border-gray-200"
                        } ${p.uploading ? "opacity-50" : ""}`}
                      />
                      {p.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                        </div>
                      )}
                      {!p.blobUrl && !p.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg">
                          <ImageIcon className="w-4 h-4 text-red-400" />
                        </div>
                      )}
                      {/* Rank badge */}
                      {rank !== null && (
                        <div className="absolute top-1 left-1 bg-purple-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                          {rank}
                        </div>
                      )}
                      {/* Hero badge */}
                      {isHero && (
                        <div className="absolute bottom-1 left-1 bg-purple-600 text-white rounded px-1 py-0.5 text-xs font-medium shadow flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> Hero
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(p.url);
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Per-photo note */}
                    {note && (
                      <p className="text-xs text-gray-500 mt-1 leading-tight">{note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Photo quality score */}
          {photoAnalysis && (
            <div className="mt-3 flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
              <Camera className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-purple-800">Photo Quality</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-3.5 h-3.5 ${
                        n <= photoAnalysis.qualityScore
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-purple-600">
                  {photoAnalysis.qualityScore}/5
                </span>
              </div>
              <span className="text-xs text-purple-600 ml-auto">
                Best order: photo{" "}
                {photoAnalysis.recommendedOrder.map((i) => i + 1).join(" → ")}
              </span>
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={!canGenerate}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3 rounded-lg font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Generating…
            </>
          ) : photos.some((p) => p.uploading) ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Uploading photos…
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> Generate Listing
            </>
          )}
        </button>
        {!form.item.trim() && (
          <p className="text-xs text-center text-gray-400">Enter a product name to generate.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">
          {error === "ANTHROPIC_API_KEY not configured" ? (
            <>
              <strong>API key not set.</strong> Add{" "}
              <code className="bg-red-100 px-1 rounded">ANTHROPIC_API_KEY</code> to your
              environment variables.
            </>
          ) : (
            error
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Price + Tags */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide">
                Suggested List Price
              </p>
              <p className="text-3xl font-bold text-green-700 mt-0.5">
                ${result.suggestedPrice.toFixed(2)}
              </p>
            </div>
            {result.tags?.length > 0 && (
              <div className="flex gap-1 flex-wrap justify-end max-w-xs">
                {result.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Platform-optimized titles */}
          {result.titles && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Platform-Optimized Titles
                </p>
                <button
                  onClick={generate}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>

              <div className="space-y-3">
                {(["ebay", "meta", "mercari", "direct"] as PlatformKey[]).map((platform) => {
                  const title = result.titles[platform];
                  const limit = PLATFORM_CHAR_LIMITS[platform];
                  const overLimit = title.length > limit;
                  const isSelected = selectedPlatform === platform;

                  return (
                    <div
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? PLATFORM_COLORS[platform] + " ring-2 ring-offset-0"
                          : "border-gray-100 hover:border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded border ${PLATFORM_BADGE[platform]}`}
                          >
                            {PLATFORM_LABELS[platform]}
                          </span>
                          <span
                            className={`text-xs ${overLimit ? "text-red-500 font-medium" : "text-gray-400"}`}
                          >
                            {title.length}/{limit}
                          </span>
                          {isSelected && (
                            <span className="text-xs font-medium text-purple-600">
                              ✓ selected for save
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyText(title, `title-${platform}`);
                          }}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white px-2 py-0.5 rounded"
                        >
                          {copied === `title-${platform}` ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {copied === `title-${platform}` ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{title}</p>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Click a title card to select it for saving. Copy any title to clipboard individually.
              </p>
            </div>
          )}

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Description
              </p>
              <button
                onClick={() => copyText(result.description, "description")}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg"
              >
                {copied === "description" ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied === "description" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
              {result.description}
            </p>
          </div>

          {/* Save to Inventory */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-purple-900">Save to Inventory</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Saves with the{" "}
                  <span className="font-medium">{PLATFORM_LABELS[selectedPlatform]}</span> title.
                  Upload photos are attached automatically.
                </p>
              </div>
              <button
                onClick={saveToInventory}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap ml-4"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PlusCircle className="w-4 h-4" />
                )}
                {saving ? "Saving…" : "Save to Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
