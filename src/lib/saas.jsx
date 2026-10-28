import { useState } from 'react';
import { Copy } from 'lucide-react';

/** Small helpers shared by the SaaS pages. */
export const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const STATUS_LABEL = {
  trialing: 'Free trial',
  active: 'Active',
  past_due: 'Payment due',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
};

export const STATUS_TONE = {
  trialing: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  past_due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
};

export const LIMIT_LABEL = {
  users: 'Team members',
  contacts: 'Contacts',
  aiConversations: 'AI conversations (is mahine)',
  campaignsPerMonth: 'Campaigns (is mahine)',
  whatsappNumbers: 'WhatsApp numbers',
};

export const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', agent: 'Agent' };

export const ROLE_HELP = {
  owner: 'Sab kuch + billing',
  manager: 'Sab kuch, billing chhod kar',
  agent: 'Leads, chats, site visits, follow-ups',
};

export function StatusPill({ status }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status] || STATUS_TONE.cancelled}`}>{STATUS_LABEL[status] || status}</span>;
}

export function UsageBar({ label, used = 0, limit }) {
  const unlimited = limit === null || limit === undefined;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-500';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-600 dark:text-ink-300">{label}</span>
        <span className="font-mono text-xs text-ink-500 dark:text-ink-400">
          {Number(used).toLocaleString('en-IN')} / {unlimited ? 'Unlimited' : Number(limit).toLocaleString('en-IN')}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: unlimited ? '4%' : `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}

/** Loads Razorpay Checkout once. */
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Full page navigation that also works in the hash-router demo build. */
export function hardNavigate(path) {
  if (window.location.hash.startsWith('#/')) {
    window.location.hash = `#${path}`;
    window.location.reload();
  } else {
    window.location.assign(path);
  }
}

/** Read-only value with a Copy button (URLs, keys, snippets). */
export function CopyBox({ label, value, multiline = false, help }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="min-w-0">
      {label && <p className="mb-1 text-xs font-semibold text-ink-500 dark:text-ink-400">{label}</p>}
      <div className="flex min-w-0 items-start gap-2">
        {multiline
          ? <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-lg bg-ink-50 p-3 font-mono text-xs text-ink-700 dark:bg-ink-800 dark:text-ink-200">{value}</pre>
          : <code className="min-w-0 flex-1 break-all rounded-lg bg-ink-50 px-3 py-2 font-mono text-xs text-ink-700 dark:bg-ink-800 dark:text-ink-200">{value || '—'}</code>}
        <button type="button" onClick={copy} disabled={!value} className="btn-secondary shrink-0 gap-1.5 !px-3 !py-2 text-xs"><Copy size={13} />{copied ? 'Copied' : 'Copy'}</button>
      </div>
      {help && <p className="mt-1 text-xs text-ink-400">{help}</p>}
    </div>
  );
}

/** Accessible on/off switch. */
export function Toggle({ checked, onChange, label, help, disabled }) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span className="min-w-0"><span className="block text-sm font-medium text-ink-800 dark:text-ink-100">{label}</span>{help && <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{help}</span>}</span>
      <button type="button" role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-ink-200 dark:bg-ink-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function PageTitle({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ msg }) {
  if (!msg) return null;
  return <p role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>{msg.text}</p>;
}

export const errText = (err, fallback = 'Kuch galat hua') => {
  const d = err?.response?.data;
  return d?.details?.[0]?.message || d?.message || err?.message || fallback;
};

export const SOURCE_LABEL = {
  website_form: 'Website form',
  hosted_form: 'Form link',
  facebook_ads: 'Facebook ads',
  instagram_ads: 'Instagram ads',
  google_ads: 'Google ads',
  '99acres': '99acres',
  magicbricks: 'MagicBricks',
  housing: 'Housing.com',
  nobroker: 'NoBroker',
  email_lead: 'Email',
  channel_partner: 'Channel partner',
  whatsapp_inbound: 'WhatsApp (khud aaya)',
  csv_import: 'Sheet upload',
  manual: 'Manual',
};
