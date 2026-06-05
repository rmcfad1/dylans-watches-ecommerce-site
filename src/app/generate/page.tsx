"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Copy, Check, RefreshCw, PlusCircle } from "lucide-react";

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"];
const CATEGORIES = ["Smartwatch", "Watch", "Electronics", "Other"];
const PLATFORMS = [
  { key: "meta", label: "Meta (Facebook/Instagram Shop)" },
  { key: "ebay", label: "eBay" },
  { key: "mercari", label: "Mercari" },
];

interface GeneratedListing {
  title: string;
  description: string;
  suggestedPrice: number;
  tags: string[];
}

export default function GeneratePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    item: "",
    category: "Smartwatch",
    condition: "Good",
    platform: "meta",
    notes: "",
    purchasePrice: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GeneratedListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"title" | "description" | null>(null);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
      } else {
        setResult(data);
      }
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
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          description: result.description,
          brand: form.item,
          category: form.category,
          condition: form.condition,
          notes: form.notes,
          purchasePrice: parseFloat(form.purchasePrice) || 0,
        }),
      });
      if (res.ok) {
        const item = await res.json();
        router.push(`/inventory/${item.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text: string, field: "title" | "description") {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          AI Listing Generator
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Describe your item and Claude will write an optimized title, description, and price suggestion. Then save it directly to inventory.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-5">
        {/* Platform selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                onClick={() => set("platform", p.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.platform === p.key
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-purple-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Item</label>
            <span className={`text-xs ${form.item.length > 80 ? "text-red-500 font-medium" : "text-gray-400"}`}>
              {form.item.length}/80
            </span>
          </div>
          <input
            type="text"
            value={form.item}
            onChange={(e) => set("item", e.target.value.slice(0, 80))}
            placeholder="e.g. Apple Watch Series 8 GPS 41mm Silver"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Price ($) <span className="text-gray-400 font-normal">(what you paid)</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.purchasePrice}
              onChange={(e) => set("purchasePrice", e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Missing charger, cracked bezel, etc."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || !form.item.trim()}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3 rounded-lg font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Listing
            </>
          )}
        </button>

        {!form.item.trim() && (
          <p className="text-xs text-center text-gray-400">Enter the item name to generate.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">
          {error === "ANTHROPIC_API_KEY not configured" ? (
            <>
              <strong>API key not set.</strong> Add <code className="bg-red-100 px-1 rounded">ANTHROPIC_API_KEY</code> to your <code className="bg-red-100 px-1 rounded">.env.local</code> file and restart the server.
            </>
          ) : error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Suggested price */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Suggested List Price</p>
              <p className="text-3xl font-bold text-green-700 mt-0.5">${result.suggestedPrice.toFixed(2)}</p>
              {form.purchasePrice && (
                <p className="text-xs text-green-600 mt-0.5">
                  Est. profit: ${(result.suggestedPrice - parseFloat(form.purchasePrice)).toFixed(2)}
                </p>
              )}
            </div>
            {result.tags?.length > 0 && (
              <div className="flex gap-1 flex-wrap justify-end max-w-xs">
                {result.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Title</p>
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(result.title, "title")}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg"
                >
                  {copied === "title" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copied === "title" ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={generate}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
            </div>
            <p className="text-gray-900 font-medium">{result.title}</p>
            <p className="text-xs text-gray-400 mt-1">{result.title.length} characters</p>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</p>
              <button
                onClick={() => copyText(result.description, "description")}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg"
              >
                {copied === "description" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied === "description" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{result.description}</p>
          </div>

          {/* Save to inventory */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-purple-900">Save to Inventory</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Creates a new inventory item with this title, description, and your item details.
                  {!form.purchasePrice && " Add a purchase price above to track profit."}
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
