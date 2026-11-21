import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { whatsappApi } from "../../api/whatsappApi.js";
import api from "../../api/axios.js";
import ConnectWhatsApp from "./ConnectWhatsApp.jsx";
import { useAuthStore, useOrgRole } from "../../store/authStore.js";

function getWebhookUrl() {
  const base = api.defaults.baseURL || window.location.origin;
  return `${base.replace(/\/api\/?$/, "")}/api/whatsapp/webhook`;
}

function unwrapError(err, fallback) {
  const metaError = err?.response?.data?.data?.metaError;
  return (
    metaError?.error_user_msg ||
    metaError?.message ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export default function WhatsAppPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusData, setStatusData] = useState(null);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [resuming, setResuming] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = useMemo(() => getWebhookUrl(), []);
  const support = useAuthStore((state) => state.support);
  const role = useOrgRole();
  const canManage = role === "owner" || role === "manager";

  const fetchStatus = useCallback(async () => {
    setRefreshing(true);
    setPageError("");
    try {
      const res = await whatsappApi.status();
      setStatusData(res?.data || null);
    } catch (err) {
      setPageError(unwrapError(err, "Could not load WhatsApp status."));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const paused = Boolean(statusData?.configured && statusData?.disconnected);

  const resumeMessaging = async () => {
    setResuming(true);
    setPageError("");
    setNotice("");
    try {
      const result = await whatsappApi.reconnect();
      setNotice(result?.message || "Messaging resumed.");
      await fetchStatus();
    } catch (err) {
      setPageError(unwrapError(err, "Could not resume messaging."));
    } finally {
      setResuming(false);
    }
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setPageError("Could not copy. Copy the webhook URL manually.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">
          WhatsApp
        </h1>
        <button
          onClick={() => {
            fetchStatus();
            setRefreshKey((key) => key + 1);
          }}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2 !py-2"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {pageError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>{pageError}</span>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {paused && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>Messaging is paused.</span>
          {canManage && (
            <button
              onClick={resumeMessaging}
              disabled={resuming}
              className="btn-primary flex items-center gap-2 !py-1.5 text-xs"
            >
              {resuming && <Loader2 size={13} className="animate-spin" />}
              Resume messaging
            </button>
          )}
        </div>
      )}

      <ConnectWhatsApp key={refreshKey} onChange={() => fetchStatus()} />

      {support && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <code className="break-all text-ink-500">{webhookUrl}</code>
          <button
            type="button"
            onClick={copyWebhook}
            className="btn-secondary !py-1 text-xs"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
