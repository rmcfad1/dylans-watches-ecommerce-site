"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

interface PlatformConn {
  id?: string;
  platform: string;
  isActive: boolean;
  hasToken: boolean;
  shopId: string | null;
  catalogId: string | null;
  pageId: string | null;
  expiresAt: string | null;
}

const PLATFORMS = [
  {
    key: "meta",
    label: "Meta Commerce (Facebook/Instagram Shop)",
    description: "Publish product listings to your Facebook and Instagram Shop. Requires a Meta Business account with Commerce enabled.",
    fields: ["accessToken", "catalogId", "pageId"],
    fieldLabels: { accessToken: "Access Token", catalogId: "Catalog ID", pageId: "Page ID (optional)" },
    oauthConnect: false,
  },
  {
    key: "ebay",
    label: "eBay",
    description: "Connect via eBay OAuth to import inventory and sync listings. Requires Client ID, Client Secret, and RuName set in environment variables.",
    fields: [] as string[],
    fieldLabels: {} as Record<string, string>,
    oauthConnect: true,
  },
  {
    key: "mercari",
    label: "Mercari",
    description: "Mercari US integration for cross-platform inventory sync.",
    fields: ["accessToken"],
    fieldLabels: { accessToken: "API Token" },
    oauthConnect: false,
  },
];

export default function SettingsPage() {
  const [connections, setConnections] = useState<Record<string, PlatformConn>>({});
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [refreshingEbay, setRefreshingEbay] = useState(false);
  const [ebayMsg, setEbayMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadConnections();
    // Show eBay callback status from URL params
    const params = new URLSearchParams(window.location.search);
    const ebayStatus = params.get("ebay");
    if (ebayStatus === "connected") {
      setEbayMsg({ type: "success", text: "eBay connected successfully." });
      window.history.replaceState({}, "", "/settings");
    } else if (ebayStatus === "error") {
      const reason = params.get("reason") ?? "Unknown error";
      setEbayMsg({ type: "error", text: `eBay connection failed: ${reason}` });
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  function loadConnections() {
    fetch("/api/settings/platforms")
      .then((r) => r.json())
      .then((data: PlatformConn[]) => {
        const map: Record<string, PlatformConn> = {};
        data.forEach((c) => { map[c.platform] = c; });
        setConnections(map);
      });
  }

  function setField(platform: string, field: string, value: string) {
    setForms((f) => ({ ...f, [platform]: { ...f[platform], [field]: value } }));
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
      loadConnections();
      setForms((f) => ({ ...f, [platformKey]: {} }));
    } finally {
      setSaving(null);
    }
  }

  async function refreshEbayToken() {
    setRefreshingEbay(true);
    setEbayMsg(null);
    try {
      const res = await fetch("/api/ebay/refresh", { method: "POST" });
      const data = await res.json() as { refreshed?: boolean; expiresAt?: string; error?: string };
      if (res.ok) {
        setEbayMsg({ type: "success", text: `Token refreshed. Expires ${new Date(data.expiresAt!).toLocaleDateString()}.` });
        loadConnections();
      } else {
        setEbayMsg({ type: "error", text: data.error ?? "Refresh failed." });
      }
    } finally {
      setRefreshingEbay(false);
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
          const expiresAt = conn?.expiresAt ? new Date(conn.expiresAt) : null;
          const expiringSoon = expiresAt && expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

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
                  {isConnected && expiresAt && (
                    <p className={`text-xs mt-1 ${expiringSoon ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                      Token expires {expiresAt.toLocaleDateString()}
                      {expiringSoon && " — expiring soon"}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {isConnected ? "Connected" : "Not connected"}
                </span>
              </div>

              {/* eBay OAuth flow */}
              {p.oauthConnect ? (
                <div className="space-y-3">
                  {p.key === "ebay" && ebayMsg && (
                    <p className={`text-sm rounded-lg px-3 py-2 ${ebayMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {ebayMsg.text}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <a
                      href="/api/ebay/auth"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                    >
                      {isConnected ? "Reconnect eBay" : "Connect eBay"}
                    </a>
                    {isConnected && (
                      <button
                        onClick={refreshEbayToken}
                        disabled={refreshingEbay}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {refreshingEbay ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Refresh Token
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Requires <code className="bg-gray-100 px-1 rounded">EBAY_CLIENT_ID</code>, <code className="bg-gray-100 px-1 rounded">EBAY_CLIENT_SECRET</code>, and <code className="bg-gray-100 px-1 rounded">EBAY_RUNAME</code> in environment variables.
                  </p>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-2">AI Listing Generator</h2>
        <p className="text-sm text-gray-500 mb-3">
          The AI listing generator uses Claude (Anthropic). Set your API key in <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code>:
        </p>
        <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">ANTHROPIC_API_KEY=sk-ant-...</pre>
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

      <div className="mt-5 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-2">eBay OAuth Callback URL</h2>
        <p className="text-sm text-gray-500 mb-3">
          Register this as your RuName redirect URL in the eBay Developer Portal:
        </p>
        <div className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 font-mono break-all">
          https://dylans-watches-ecommerce-site.vercel.app/api/ebay/callback
        </div>
      </div>
    </div>
  );
}
