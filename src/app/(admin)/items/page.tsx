"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search, X, Upload, Loader2, ChevronDown, ChevronRight, Archive, ArchiveRestore, Download } from "lucide-react";
import Badge from "@/components/ui/Badge";

const CONDITIONS = ["new", "new other", "used", "used great", "used good", "used poor", "for parts"];

interface Item {
  id: string;
  sku: string | null;
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  condition: string;
  notes: string | null;
  description: string | null;
  archived: boolean;
  archivedAt: string | null;
}

interface Photo {
  file: File;
  preview: string;
  uploading: boolean;
  blobUrl?: string;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [archivedItems, setArchivedItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveLoadError, setArchiveLoadError] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkArchiving, setBulkArchiving] = useState(false);

  // form state
  const [blurb, setBlurb] = useState("");
  const [condition, setCondition] = useState("used good");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then(setItems);
    fetch("/api/settings/platforms")
      .then((r) => r.json())
      .then((data: { platform: string; isActive: boolean; hasToken: boolean }[]) => {
        const ebay = data.find((d) => d.platform === "ebay");
        setEbayConnected(!!ebay?.isActive && !!ebay?.hasToken);
      })
      .catch(() => {});
  }, []);

  async function importFromEbay() {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/ebay/import", { method: "POST" });
      const data = await res.json() as { imported: number; skipped: number; failed: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data);
      // Refresh items list
      const updated = await fetch("/api/inventory").then((r) => r.json()) as Item[];
      setItems(updated);
    } catch (e) {
      setImportResult({ imported: 0, skipped: 0, failed: -1 });
    } finally {
      setImporting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  }

  async function bulkArchive() {
    if (selected.size === 0) return;
    setBulkArchiving(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/inventory/${id}`, { method: "DELETE" })
        )
      );
      const archivedNow = items.filter((i) => selected.has(i.id));
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setArchivedItems((prev) => [
        ...archivedNow.map((i) => ({ ...i, archived: true, archivedAt: new Date().toISOString() })),
        ...prev,
      ]);
      setSelected(new Set());
    } finally {
      setBulkArchiving(false);
    }
  }

  async function loadArchivedItems() {
    setArchiveLoadError(false);
    try {
      const data = await fetch("/api/inventory?archived=true").then((r) => r.json()) as Item[];
      setArchivedItems(data);
    } catch {
      setArchiveLoadError(true);
    }
  }

  function toggleArchivedSection() {
    const next = !showArchived;
    setShowArchived(next);
    if (next && archivedItems.length === 0 && !archiveLoadError) {
      loadArchivedItems();
    }
  }

  async function archiveItem(id: string) {
    setArchivingId(id);
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
      if (res.ok) {
        const archived = items.find((i) => i.id === id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (archived) {
          setArchivedItems((prev) => [
            { ...archived, archived: true, archivedAt: new Date().toISOString() },
            ...prev,
          ]);
        }
      }
    } finally {
      setArchivingId(null);
    }
  }

  async function unarchiveItem(id: string) {
    setUnarchivingId(id);
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: "PATCH" });
      if (res.ok) {
        const item = await res.json() as Item;
        setArchivedItems((prev) => prev.filter((i) => i.id !== id));
        setItems((prev) => [item, ...prev]);
      }
    } finally {
      setUnarchivingId(null);
    }
  }

  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category))).sort()];

  const filtered = items.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function uploadFile(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return null;
    const { url } = await res.json() as { url: string };
    return url;
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    const newPhotos: Photo[] = arr.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: true,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    for (let i = 0; i < arr.length; i++) {
      const blobUrl = await uploadFile(arr[i]);
      setPhotos((prev) =>
        prev.map((p) =>
          p.file === arr[i] ? { ...p, uploading: false, blobUrl: blobUrl ?? undefined } : p
        )
      );
    }
  }, []);

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function resetForm() {
    setBlurb("");
    setCondition("used good");
    setDescription("");
    setNotes("");
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setShowForm(false);
  }

  async function handleSave() {
    if (!blurb.trim()) return;
    if (photos.some((p) => p.uploading)) return;
    setSaving(true);
    try {
      const imageUrls = photos.filter((p) => p.blobUrl).map((p) => p.blobUrl!);
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productBlurb: blurb.trim(),
          condition,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
          imageUrls,
        }),
      });
      if (res.ok) {
        const newItem = await res.json() as Item;
        setItems((prev) => [newItem, ...prev]);
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  }

  function formatArchivedDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Items</h1>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={bulkArchive}
              disabled={bulkArchiving}
              className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {bulkArchiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              {bulkArchiving ? "Archiving…" : `Archive ${selected.size} item${selected.size !== 1 ? "s" : ""}`}
            </button>
          )}
          {ebayConnected && (
            <button
              onClick={importFromEbay}
              disabled={importing}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {importing ? "Importing…" : "Import from eBay"}
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add Item"}
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${importResult.failed === -1 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {importResult.failed === -1
            ? "eBay import failed. Check that eBay is connected and your token is valid."
            : `Import complete — ${importResult.imported} imported, ${importResult.skipped} already existed, ${importResult.failed} failed.`}
        </div>
      )}

      {/* Inline Add Item Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">New Item</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Blurb <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="e.g. Apple Watch Series 8 45mm GPS Midnight"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="mt-1 text-xs text-gray-400">Include brand, model, size, color — AI will extract details and generate the listing title.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional — AI will generate if left blank)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Leave blank to let AI generate one from the blurb and photos…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Missing charger, scratch on bezel, original box included…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragging ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-amber-300 hover:bg-gray-50"}`}
            >
              <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-400">Drag & drop photos or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {photos.map((photo, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                    {photo.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                    {!photo.uploading && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <ChevronDown className="w-3 h-3" />
              AI will generate a Cassini-optimized title and extract brand/model
            </p>
            <div className="flex gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!blurb.trim() || saving || photos.some((p) => p.uploading)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Generating & saving…" : "Save Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter */}
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
          ))}
        </select>
      </div>

      {/* Active Items Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-28" />
            <col />
            <col className="w-32" />
            <col className="w-24" />
            <col className="w-28" />
            <col className="w-36" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length; }}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium">SKU</th>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Brand / Model</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Condition</th>
              <th className="text-left px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No items found.{" "}
                  <button onClick={() => setShowForm(true)} className="text-amber-600 hover:underline">
                    Add your first item
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 group ${selected.has(item.id) ? "bg-amber-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                    {item.sku ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/inventory/${item.id}`} className="font-medium text-gray-800 hover:text-amber-600 line-clamp-2 leading-snug">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate">
                    {item.brand || item.model
                      ? [item.brand, item.model].filter(Boolean).join(" ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs truncate">{item.category}</td>
                  <td className="px-4 py-3">
                    <Badge status={item.condition} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs truncate">
                    {item.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => archiveItem(item.id)}
                      disabled={archivingId === item.id}
                      title="Archive item"
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 whitespace-nowrap"
                    >
                      {archivingId === item.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Archive className="w-3.5 h-3.5" />}
                      Archive
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Archived Items Section */}
      <div className="mt-6">
        <button
          onClick={toggleArchivedSection}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors w-full text-left"
        >
          {showArchived
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="font-medium">Archived Items</span>
          {archivedItems.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
              {archivedItems.length}
            </span>
          )}
        </button>

        {showArchived && (
          <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
            {archiveLoadError ? (
              <div className="py-8 text-center text-sm text-red-500">
                Failed to load archived items.{" "}
                <button onClick={loadArchivedItems} className="text-amber-600 hover:underline">Retry</button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-medium">Title</th>
                    <th className="text-left px-5 py-3 font-medium">Brand / Model</th>
                    <th className="text-left px-5 py-3 font-medium">Category</th>
                    <th className="text-left px-5 py-3 font-medium">Condition</th>
                    <th className="text-left px-5 py-3 font-medium">Archived</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {archivedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                        No archived items.
                      </td>
                    </tr>
                  ) : (
                    archivedItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
                        <td className="px-5 py-3">
                          <span className="font-medium text-gray-500">{item.title}</span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">
                          {item.brand || item.model
                            ? [item.brand, item.model].filter(Boolean).join(" ")
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-gray-400">{item.category}</td>
                        <td className="px-5 py-3">
                          <Badge status={item.condition} />
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">
                          {formatArchivedDate(item.archivedAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => unarchiveItem(item.id)}
                            disabled={unarchivingId === item.id}
                            title="Unarchive item"
                            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                          >
                            {unarchivingId === item.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <ArchiveRestore className="w-3.5 h-3.5" />}
                            Unarchive
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
