"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface PlatformConn {
  id?: string;
  platform: string;
  isActive: boolean;
  hasToken: boolean;
  shopId: string | null;
  catalogId: string | null;
  pageId: string | null;
}

const PLATFORMS = [
  {
    key: "meta",
    label: "Meta Commerce (Facebook/Instagram Shop)",
    description: "Publish product listings to your Facebook and Instagram Shop. Requires a Meta Business account with Commerce enabled.",
    fields: ["accessToken", "catalogId", "pageId"],
    fieldLabels: {
      accessToken: "Access Token",
      catalogId: "Catalog ID",
      pageId: "Page ID (optional)",
    },
  },
  {
    key: "ebay",
    label: "eBay",
    description: "eBay integration via the eBay Sell API. Connect to publish and sync listings.",
    fields: ["accessToken"],
    fieldLabels: { accessToken: "OAuth Access Token" },
  },
  {
    key: "mercari",
    label: "Mercari",
    description: "Mercari US integration for cross-platform inventory sync.",
    fields: ["accessToken"],
    fieldLabels: { accessToken: "API Token" },
  },
];

export default function SettingsPage() {
  const [connections, setConnections] = useState<Record<string, PlatformConn>>({});
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/platforms")
      .then((r) => r.json())
      .then((data: PlatformConn[]) => {
        const map: Record<string, PlatformConn> = {};
        data.forEach((c) => { map[c.platform] = c; });
        setConnections(map);
      });
  }, []);

  function setField(platform: string, field: string, value: string) {
    setForms((f) => ({
      ...f,
      [platform]: { ...f[platform], [field]: value },
    }));
  }

  async function save(platformKey: string) {
    setSaving(platformKey);
    const fieldValues = forms[platformKey] ?? {};
    try {
      await fetch("/api/settings/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformKey,
          accessToken: fieldValues.accessToken || undefined,
          catalogId: fieldValues.catalogId || undefined,
          pageId: fieldValues.pageId || undefined,
          isActive: true,
        }),
      });
      const data: PlatformConn[] = await fetch("/api/settings/platforms").then((r) => r.json());
      const map: Record<string, PlatformConn> = {};
      data.forEach((c) => { map[c.platform] = c; });
      setConnections(map);
      setForms((f) => ({ ...f, [platformKey]: {} }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Connect your selling platforms to enable listing and order sync.</p>

      <div className="space-y-5">
        {PLATFORMS.map((p) => {
          const conn = connections[p.key];
          const isConnected = conn?.isActive && conn?.hasToken;
          return (
            <div key={p.key} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{p.label}</h2>
                    {isConnected ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{p.description}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isConnected ? "Connected" : "Not connected"}
                </span>
              </div>

              <div className="space-y-3">
                {p.fields.map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {p.fieldLabels[field as keyof typeof p.fieldLabels]}
                    </label>
                    <input
                      type={field === "accessToken" ? "password" : "text"}
                      value={forms[p.key]?.[field] ?? ""}
                      onChange={(e) => setField(p.key, field, e.target.value)}
                      placeholder={isConnected && field === "accessToken" ? "••••••••••••" : ""}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <button
                  onClick={() => save(p.key)}
                  disabled={saving === p.key}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving === p.key && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isConnected ? "Update" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-2">AI Listing Generator</h2>
        <p className="text-sm text-gray-500 mb-3">
          The AI listing generator uses Claude (Anthropic). Set your API key in <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code>:
        </p>
        <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">
          ANTHROPIC_API_KEY=sk-ant-...
        </pre>
      </div>

      <div className="mt-5 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-2">Webhook URL</h2>
        <p className="text-sm text-gray-500 mb-3">
          Set this as your Meta Commerce webhook URL to receive order notifications automatically:
        </p>
        <div className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 font-mono break-all">
          https://your-domain.com/api/meta/webhook
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Verify token: <code className="bg-gray-100 px-1 rounded">META_WEBHOOK_VERIFY_TOKEN</code> from .env.local
        </p>
      </div>
    </div>
  );
}
