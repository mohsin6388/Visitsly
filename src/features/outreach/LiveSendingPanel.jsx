import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Loader2, Mail, MessageCircle, X, XCircle } from 'lucide-react';
import { useOutreachEvents } from '../../hooks/useOutreachLive.js';
import { campaignApi } from '../../api/outreachApi.js';
import { useOrgRole } from '../../store/authStore.js';
import { showSendError } from '../../components/ui/index.jsx';

const IDLE_HIDE_MS = 20_000; // hide this long after the last message once nothing is sending
const RECENT = 6;

/**
 * Top-of-app panel while a bulk campaign is sending: which campaign, progress,
 * who is being messaged right now and the last few results. Appears on its own
 * when the worker starts and hides shortly after the last message.
 */
export default function LiveSendingPanel() {
  const role = useOrgRole();
  const [campaigns, setCampaigns] = useState({}); // id -> { name, channel, stats }
  const [current, setCurrent] = useState(null); // { name, contact, channel }
  const [recent, setRecent] = useState([]); // [{ jobId, name, contact, status, error }]
  const [lastEventAt, setLastEventAt] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(''); // campaign id the user closed
  const [, tick] = useState(0);
  const names = useRef({});

  const ensureName = (id) => {
    if (!id || names.current[id]) return;
    names.current[id] = '…';
    campaignApi.get(id).then((r) => {
      const c = r.data?.campaign;
      names.current[id] = c?.name || 'Campaign';
      setCampaigns((prev) => ({ ...prev, [id]: { ...prev[id], name: names.current[id], stats: prev[id]?.stats || c?.stats } }));
    }).catch(() => { names.current[id] = 'Campaign'; });
  };

  useOutreachEvents({
    onJob: (p) => {
      if (!p.campaignId) return; // single-lead openers are not bulk sends
      ensureName(p.campaignId);
      const contact = p.channel === 'email' ? p.email : p.phone;
      setLastEventAt(Date.now());
      if (p.status === 'processing') {
        setCurrent({ jobId: p.jobId, name: p.name || 'Contact', contact, channel: p.channel, campaignId: p.campaignId });
        return;
      }
      if (['sent', 'failed'].includes(p.status)) {
        setCurrent((c) => (c?.jobId === p.jobId ? null : c));
        setRecent((list) => [{ jobId: p.jobId, name: p.name || 'Contact', contact, channel: p.channel, status: p.status, error: p.lastError }, ...list.filter((x) => x.jobId !== p.jobId)].slice(0, RECENT));
      }
    },
    onProgress: (p) => {
      if (!p.campaignId) return;
      ensureName(p.campaignId);
      setLastEventAt(Date.now());
      setCampaigns((prev) => ({ ...prev, [p.campaignId]: { ...prev[p.campaignId], name: names.current[p.campaignId], stats: p.stats } }));
    },
    onCampaign: (p) => {
      if (p.status === 'deleted' || p.status === 'cancelled' || p.status === 'completed') {
        setCampaigns((prev) => { const next = { ...prev }; if (p.status !== 'completed') delete next[p.campaignId]; return next; });
      }
    },
  });

  // Re-render every few seconds so the panel hides itself when idle.
  useEffect(() => {
    if (!lastEventAt) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [lastEventAt]);

  if (role === 'agent') return null;
  const active = Object.entries(campaigns)
    .map(([id, c]) => {
      const st = c.stats ? (c.stats.whatsapp?.total ? c.stats.whatsapp : c.stats.email) || {} : {};
      const channel = c.stats?.whatsapp?.total ? 'whatsapp' : 'email';
      const done = (st.sent || 0) + (st.failed || 0);
      const left = (st.pending || 0) - (st.scheduled || 0) + (st.processing || 0);
      return { id, name: c.name && c.name !== '…' ? c.name : 'Campaign', channel, st, done, left, total: st.total || 0 };
    })
    .filter((c) => c.total > 0);
  const sending = Boolean(current) || active.some((c) => c.left > 0);
  const idle = Date.now() - lastEventAt > IDLE_HIDE_MS;
  const main = active.find((c) => c.left > 0) || active[0];
  if (!lastEventAt || (!sending && idle) || (main && dismissed === main.id)) return null;

  const pct = main?.total ? Math.round((main.done / main.total) * 100) : 0;
  const Icon = (current?.channel || main?.channel) === 'email' ? Mail : MessageCircle;

  return (
    <div className="flex-shrink-0 border-b border-emerald-200 bg-emerald-50/95 px-4 py-2.5 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-50 sm:px-6" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {sending ? 'Sending' : 'Finished'}: {main?.name || 'Bulk campaign'}
            {main && <span className="ml-2 font-normal text-emerald-800/80 dark:text-emerald-200/80">{main.done.toLocaleString('en-IN')} / {main.total.toLocaleString('en-IN')} done{main.st.failed ? ` · ${main.st.failed} failed` : ''}</span>}
          </p>
          <div className="mt-1 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
          </div>
        </div>
        {current && (
          <p className="hidden min-w-0 items-center gap-1.5 truncate text-xs md:flex">
            <Icon size={14} /> Now: <b className="truncate">{current.name}</b> <span className="opacity-70">{current.contact}</span>
          </p>
        )}
        <div className="flex items-center gap-1">
          <Link to={main?.channel === 'email' ? '/outreach/email' : '/outreach/whatsapp'} className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900">Open</Link>
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="rounded-md p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900" aria-label={collapsed ? 'Show who is being messaged' : 'Hide details'} aria-expanded={!collapsed}>
            <ChevronDown size={16} className={collapsed ? '' : 'rotate-180'} />
          </button>
          <button type="button" onClick={() => setDismissed(main?.id || 'all')} className="rounded-md p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900" aria-label="Hide"><X size={16} /></button>
        </div>
      </div>
      {!collapsed && (current || recent.length > 0) && (
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-11">
          {current && (
            <li className="inline-flex max-w-[240px] items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium ring-1 ring-emerald-200 dark:bg-emerald-900/60 dark:ring-emerald-800">
              <Loader2 size={12} className="shrink-0 animate-spin text-emerald-600" /><span className="truncate">{current.name}</span>
            </li>
          )}
          {recent.map((r) => (
            <li key={r.jobId}>
              <button
                type="button"
                disabled={r.status !== 'failed'}
                onClick={() => showSendError(r.error || 'The message could not be sent.')}
                className={`inline-flex max-w-[240px] items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${r.status === 'sent' ? 'bg-white ring-emerald-200 dark:bg-emerald-900/40 dark:ring-emerald-800' : 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900'}`}
                title={r.status === 'failed' ? 'See why it failed' : r.contact}
              >
                {r.status === 'sent' ? <CheckCircle2 size={12} className="shrink-0 text-emerald-600" /> : <XCircle size={12} className="shrink-0" />}
                <span className="truncate">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
