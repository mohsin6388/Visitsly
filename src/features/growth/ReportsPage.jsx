import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Send } from 'lucide-react';
import { growthApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { inr, PageTitle, Toggle, Notice, errText } from '../../lib/saas.jsx';
import BudgetSection from './BudgetSection.jsx';
import { Skeleton } from '../../components/ui/index.jsx';
import { useFeature } from '../saas/UpgradeCard.jsx';
import { showUpgrade } from '../../lib/saas.jsx';

const RANGES = [['7d', '7d'], ['30d', '30d'], ['90d', '90d'], ['this_month', 'This month'], ['last_month', 'Last month']];


// Many source names grouped into a few simple buckets.
const GROUPS = [
  ['facebook', 'Facebook / Instagram', ['facebook_ads', 'instagram_ads', 'facebook', 'instagram', 'meta_ads']],
  ['portal', '99acres / MagicBricks / Housing', ['99acres', 'magicbricks', 'housing', 'nobroker', 'squareyards', 'commonfloor', 'email_lead']],
  ['google', 'Google Ads', ['google_ads']],
  ['whatsapp', 'Direct WhatsApp', ['whatsapp_inbound', 'whatsapp_ai', 'voice_ai']],
  ['import', 'Import / Sheet / Manual', ['csv_import', 'file_import', 'bulk_paste', 'manual']],
  ['website', 'Website / Form link', ['website_form', 'hosted_form']],
  ['cp', 'Channel partner', ['channel_partner']],
];
const groupOf = (src) => {
  const k = String(src || 'manual');
  const hit = GROUPS.find(([, , list]) => list.includes(k) || list.some((x) => k.startsWith(x)));
  return hit ? hit[0] : 'other';
};
const pctOf = (a, b) => (b ? Math.min(100, Math.round((a / b) * 1000) / 10) : 0);

function groupRows(bySource) {
  const map = new Map([...GROUPS.map(([k, label]) => [k, label]), ['other', 'Other']].map(([k, label]) => [k, { key: k, label, leads: 0, replied: 0, hot: 0, visits: 0, booked: 0, revenue: 0 }]));
  (bySource || []).forEach((x) => {
    const g = map.get(groupOf(x.source));
    ['leads', 'replied', 'hot', 'visits', 'booked', 'revenue'].forEach((f) => { g[f] += x[f] || 0; });
  });
  return [...map.values()].filter((g) => g.leads || g.replied || g.visits).sort((a, b) => b.leads - a.leads)
    .map((g) => ({ ...g, replyRate: pctOf(g.replied, g.leads), visitRate: pctOf(g.visits, g.leads), bookRate: pctOf(g.booked, g.leads) }));
}

function WeeklyReport() {
  const org = useAuthStore((s) => s.org);
  const setOrg = useAuthStore((s) => s.setOrg);
  const [phone, setPhone] = useState(org?.weeklyReport?.phone || '');
  const weeklyAllowed = useFeature('weeklyReports');
  const [msg, setMsg] = useState(null);
  const save = async (payload) => {
    try {
      const res = await growthApi.weeklyReport(payload);
      if (org) setOrg({ ...org, weeklyReport: res.data.weeklyReport });
      setMsg({ ok: true, text: 'Saved' });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
  };
  return (
    <section className="card min-w-0 space-y-3">
      <Toggle checked={org?.weeklyReport?.enabled && weeklyAllowed} label="Weekly WhatsApp report" help={weeklyAllowed ? 'Every Monday, 10 AM — leads, visits, bookings and team.' : 'Builder Pro feature — upgrade to get a weekly report on WhatsApp.'} onChange={(v) => (weeklyAllowed ? save({ enabled: v, phone: phone || null }) : showUpgrade('Weekly Reports are included in the Builder Pro plan. Upgrade to get them every Monday on WhatsApp.'))} />
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); save({ phone }); }}>
        <input className="input-field !w-auto flex-1 !py-2" placeholder="Owner WhatsApp number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn-secondary gap-2 !py-2"><Send size={14} /> Save</button>
      </form>
      <Notice msg={msg} />
    </section>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useState('30d');
  const { data, isLoading, error } = useQuery({ queryKey: ['report', range], queryFn: () => growthApi.report(range) });
  const r = data?.data?.report;
  const max = r ? Math.max(1, ...r.funnel.map((f) => f.value)) : 1;
  const groups = r ? groupRows(r.bySource) : [];
  const daily = (r?.daily || []).map((d) => ({ ...d, label: d.date.slice(5).split('-').reverse().join('/') }));
  const th = 'px-3 py-2.5 text-right';

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageTitle title="Reports & budget" subtitle={r ? r.label : 'Leads, conversion and spend'} action={
        <div className="flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1 text-xs dark:border-ink-700 dark:bg-ink-900" role="tablist">
          {RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={`rounded-lg px-2.5 py-1.5 font-semibold ${range === k ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{l}</button>)}
        </div>
      } />
      {error && <p className="card text-sm text-red-600">{errText(error)}</p>}
      {isLoading || !r ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}</div><div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div> : (
        <>
          <div className="card grid grid-cols-2 divide-ink-100 !p-0 dark:divide-ink-800 sm:grid-cols-5 sm:divide-x">
            {[['New leads', r.totals.newLeads], ['Reply rate', `${r.totals.replyRate}%`], ['Hot leads', r.totals.hot], ['Site visits', `${r.totals.visits}${r.totals.aiVisits ? ` (AI ${r.totals.aiVisits})` : ''}`], ['Bookings', `${r.totals.booked}${r.totals.revenue ? ` · ${inr(r.totals.revenue)}` : ''}`]].map(([l, v]) => (
              <div key={l} className="min-w-0 px-4 py-3"><p className="text-[11px] font-medium text-ink-500">{l}</p><p className="mt-0.5 truncate font-display text-xl font-bold text-ink-900 dark:text-white">{v}</p></div>
            ))}
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section className="card min-w-0 !p-4">
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Funnel</h2>
              <ul className="mt-3 space-y-2">
                {r.funnel.map((f) => (
                  <li key={f.key}>
                    <div className="flex justify-between text-xs"><span className="text-ink-600 dark:text-ink-300">{f.label}</span><span className="font-semibold tabular-nums">{f.value.toLocaleString('en-IN')}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, (f.value / max) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card min-w-0 !p-4">
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Daily trend</h2>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                    <Bar dataKey="leads" name="Leads" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="replies" name="Replies" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="visits" name="Visits" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="card min-w-0 !p-0">
            <h2 className="px-4 pt-4 text-sm font-semibold text-ink-900 dark:text-white">By source</h2>
            {!groups.length ? <p className="px-4 py-6 text-sm text-ink-400">No leads in this period.</p> : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-ink-50 text-[11px] uppercase text-ink-400 dark:bg-ink-800/50"><tr><th className="px-4 py-2.5">Source</th><th className={th}>Leads</th><th className={th}>Replied</th><th className={th}>Hot</th><th className={th}>Visits</th><th className={th}>Bookings</th><th className="px-4 py-2.5 text-right">Conversion</th></tr></thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {groups.map((g) => <tr key={g.key}>
                      <td className="px-4 py-2.5 font-medium text-ink-800 dark:text-ink-100">{g.label}</td>
                      <td className={`${th} font-semibold tabular-nums`}>{g.leads}</td>
                      <td className={`${th} tabular-nums`}>{g.replied} <span className="text-xs text-ink-400">{g.replyRate}%</span></td>
                      <td className={`${th} tabular-nums`}>{g.hot}</td>
                      <td className={`${th} tabular-nums`}>{g.visits} <span className="text-xs text-ink-400">{g.visitRate}%</span></td>
                      <td className={`${th} tabular-nums`}>{g.booked}{g.revenue ? <span className="text-xs text-ink-400"> · {inr(g.revenue)}</span> : null}</td>
                      <td className="px-4 py-2.5 text-right"><span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{g.bookRate}%</span></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <BudgetSection />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className="card min-w-0 !p-0">
              <h2 className="px-4 pt-4 text-sm font-semibold text-ink-900 dark:text-white">Team</h2>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-ink-50 text-[11px] uppercase text-ink-400 dark:bg-ink-800/50"><tr><th className="px-4 py-2.5">Name</th><th className={th}>Leads</th><th className={th}>Replied</th><th className={th}>Hot</th><th className={th}>Visits</th><th className={th}>Visited</th><th className="px-4 py-2.5 text-right">Bookings</th></tr></thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {r.byAgent.map((a) => <tr key={a.userId || 'none'}><td className={`px-4 py-2.5 font-medium ${a.userId ? '' : 'text-ink-400'}`}>{a.name}</td><td className={`${th} tabular-nums`}>{a.assigned}</td><td className={`${th} tabular-nums`}>{a.replied}</td><td className={`${th} tabular-nums`}>{a.hot}</td><td className={`${th} tabular-nums`}>{a.visits} <span className="text-xs text-ink-400">({a.conversion}%)</span></td><td className={`${th} tabular-nums`}>{a.visited}</td><td className="px-4 py-2.5 text-right tabular-nums">{a.booked}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>
            <WeeklyReport />
          </div>
        </>
      )}
    </div>
  );
}
