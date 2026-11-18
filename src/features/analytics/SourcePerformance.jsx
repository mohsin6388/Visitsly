import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, PieChart } from 'lucide-react';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Tooltip, Cell } from 'recharts';
import { analyticsApi } from '../../api/analyticsApi.js';
import { Skeleton } from '../../components/ui/index.jsx';

const LABELS = {
  facebook: 'Facebook / Instagram',
  google: 'Google Ads',
  '99acres': '99acres',
  magicbricks: 'MagicBricks',
  housing: 'Housing.com',
  nobroker: 'NoBroker',
  other_portals: 'Other portals',
  website: 'Website / form',
  whatsapp: 'WhatsApp (direct)',
  channel_partner: 'Channel partners',
  upload: 'Sheet upload',
  manual: 'Added manually',
  other: 'Other',
};

// Distinct, colour-blind-friendly slice colours (largest source first).
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#64748b', '#f97316', '#14b8a6', '#a855f7', '#94a3b8'];

const n = (v) => Number(v || 0).toLocaleString('en-IN');

function SourceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-ink-700 dark:bg-ink-900">
      <p className="font-semibold text-slate-900 dark:text-white">{r.label}</p>
      <p className="mt-1 text-slate-600 dark:text-ink-300"><b className="tabular-nums">{n(r.total)}</b> leads · {r.pct}%</p>
    </div>
  );
}

/** Overview → "Lead sources": a donut of how many leads came from each source. */
export default function SourcePerformance({ className = '' }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    analyticsApi.sourcePerformance(days)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.message || 'Could not load lead sources.'))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [days]);

  const totals = data?.totals || {};
  const sum = (data?.sources || []).reduce((acc, r) => acc + Number(r.total || 0), 0);
  const rows = (data?.sources || [])
    .filter((r) => Number(r.total) > 0)
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ ...r, label: LABELS[r.key] || LABELS.other, color: COLORS[i % COLORS.length], pct: sum ? Math.round((r.total / sum) * 100) : 0 }));

  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] dark:border-ink-800 dark:bg-ink-900 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-slate-950 dark:text-white">Lead sources</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-400">Where your leads come from</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
            {[7, 30, 90].map((d) => <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${days === d ? 'bg-white text-emerald-700 shadow-sm dark:bg-ink-900' : 'text-slate-500 dark:text-ink-400'}`}>{d}d</button>)}
          </div>
          <button type="button" onClick={load} aria-label="Refresh" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error} <button type="button" className="font-semibold underline" onClick={load}>Retry</button></p>}

      <div className="mt-3">
        {loading && !data ? (
          <div className="space-y-2.5">{[80, 60, 45, 30].map((w) => <Skeleton key={w} className="h-6" style={{ width: `${w}%` }} />)}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-ink-700">
            <PieChart size={22} className="text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-ink-200">No leads in this period</p>
            <Link to="/lead-sources" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">Connect a lead source <ArrowRight size={13} /></Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <div className="relative h-[190px] w-[190px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={rows} dataKey="total" nameKey="label" innerRadius={62} outerRadius={90} paddingAngle={rows.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                    {rows.map((r) => <Cell key={r.key} fill={r.color} />)}
                  </Pie>
                  <Tooltip content={<SourceTooltip />} />
                </RePieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-bold tabular-nums text-slate-950 dark:text-white">{n(totals.total ?? sum)}</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-ink-400">leads</span>
                {Number(totals.today) > 0 && <span className="mt-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">+{n(totals.today)} today</span>}
              </div>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-2">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-2.5 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-ink-200">{r.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{n(r.total)}</span>
                  <span className="w-10 text-right text-xs tabular-nums text-slate-400">{r.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
