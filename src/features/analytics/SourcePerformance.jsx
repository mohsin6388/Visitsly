import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Facebook, Globe, Building2, MessageCircle, Search, Handshake, Upload, UserPlus, Link2, RefreshCw } from 'lucide-react';
import { analyticsApi } from '../../api/analyticsApi.js';
import { Skeleton } from '../../components/ui/index.jsx';

const META = {
  facebook: { label: 'Facebook / Instagram ads', icon: Facebook, tint: 'bg-[#1877F2]/10 text-[#1877F2]' },
  google: { label: 'Google Ads', icon: Search, tint: 'bg-amber-50 text-amber-700' },
  '99acres': { label: '99acres', icon: Building2, tint: 'bg-sky-50 text-sky-700' },
  magicbricks: { label: 'MagicBricks', icon: Building2, tint: 'bg-red-50 text-red-700' },
  housing: { label: 'Housing.com', icon: Building2, tint: 'bg-violet-50 text-violet-700' },
  nobroker: { label: 'NoBroker', icon: Building2, tint: 'bg-rose-50 text-rose-700' },
  other_portals: { label: 'Other portals / email', icon: Building2, tint: 'bg-slate-100 text-slate-600' },
  website: { label: 'Website / form link', icon: Globe, tint: 'bg-emerald-50 text-emerald-700' },
  whatsapp: { label: 'WhatsApp (khud message kiya)', icon: MessageCircle, tint: 'bg-green-50 text-green-700' },
  channel_partner: { label: 'Channel partners', icon: Handshake, tint: 'bg-teal-50 text-teal-700' },
  upload: { label: 'Sheet upload', icon: Upload, tint: 'bg-slate-100 text-slate-600' },
  manual: { label: 'Manually added', icon: UserPlus, tint: 'bg-slate-100 text-slate-600' },
  other: { label: 'Other', icon: Link2, tint: 'bg-slate-100 text-slate-600' },
};

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const ago = (d) => {
  if (!d) return '';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min pehle`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ghante pehle`;
  return `${Math.round(h / 24)} din pehle`;
};

/** Overview → "Leads kahan se aa rahi hain": every channel with hot / visit counts. */
export default function SourcePerformance() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    analyticsApi.sourcePerformance(days)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.message || 'Lead sources load nahi hue'))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [days]);

  const rows = data?.sources || [];
  const max = Math.max(1, ...rows.map((r) => r.total));
  const paid = rows.filter((r) => ['facebook', 'google', '99acres', 'magicbricks', 'housing', 'nobroker', 'other_portals', 'website', 'whatsapp', 'channel_partner'].includes(r.key));

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] dark:border-ink-800 dark:bg-ink-900 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Lead sources</p>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white">Leads kahan se aa rahi hain</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-ink-400">Facebook, Google, 99acres, MagicBricks, website — har jagah se aayi leads aur unme se kitni hot hui.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
            {[7, 30, 90].map((d) => <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${days === d ? 'bg-white text-emerald-700 shadow-sm dark:bg-ink-900' : 'text-slate-500 dark:text-ink-400'}`}>{d} din</button>)}
          </div>
          <button type="button" onClick={load} aria-label="Refresh" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {data?.totals && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[['Total leads', data.totals.total], ['Aaj', data.totals.today], ['Hot', data.totals.hot], ['Site visit', data.totals.siteVisit], ['Booked / closed', data.totals.closed]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-slate-50 p-3 dark:bg-ink-800/60"><p className="text-[11px] text-slate-500 dark:text-ink-400">{l}</p><p className="mt-0.5 font-display text-xl font-bold tabular-nums text-slate-900 dark:text-white">{n(v)}</p></div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error} <button type="button" className="font-semibold underline" onClick={load}>Dobara try karein</button></p>}

      <div className="mt-4 space-y-2.5">
        {loading && !data ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-ink-700">
            Abhi kisi source se lead nahi aayi. <Link to="/lead-sources" className="font-semibold text-emerald-700 underline">Facebook / 99acres / website jodiye</Link> — lead aate hi AI turant WhatsApp par baat shuru kar dega.
          </div>
        ) : rows.map((r) => {
          const m = META[r.key] || META.other;
          const Icon = m.icon;
          return (
            <div key={r.key} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-ink-800">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.tint}`}><Icon size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-800 dark:text-ink-100">{m.label}</p><p className="shrink-0 font-display text-base font-bold tabular-nums text-slate-900 dark:text-white">{n(r.total)}</p></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (r.total / max) * 100)}%` }} /></div>
                <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500 dark:text-ink-400">
                  {r.today > 0 && <span className="font-semibold text-emerald-700">+{n(r.today)} aaj</span>}
                  <span>🔥 {n(r.hot)} hot</span><span>📅 {n(r.siteVisit)} visit</span><span>✅ {n(r.closed)} closed</span>
                  {r.lastAt && <span>Last: {ago(r.lastAt)}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {!loading && paid.length < 3 && (
        <Link to="/lead-sources" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">Aur lead sources jodein (Facebook, 99acres, MagicBricks, Google) <ArrowRight size={13} /></Link>
      )}
    </section>
  );
}
