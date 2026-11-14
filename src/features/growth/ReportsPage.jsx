import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Loader2, Send } from 'lucide-react';
import { growthApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { inr, PageTitle, Toggle, Notice, errText } from '../../lib/saas.jsx';
import BudgetSection from './BudgetSection.jsx';

const RANGES = [['7d', '7 din'], ['30d', '30 din'], ['90d', '90 din'], ['this_month', 'Is mahine'], ['last_month', 'Pichhla mahina']];


// Bahut saare source naam ko 6-7 simple groups me jodte hain.
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
  const map = new Map([...GROUPS.map(([k, label]) => [k, label]), ['other', 'Doosre']].map(([k, label]) => [k, { key: k, label, leads: 0, replied: 0, hot: 0, visits: 0, booked: 0, revenue: 0 }]));
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
      <Toggle checked={org?.weeklyReport?.enabled} label="Har Monday subah 10 baje WhatsApp report" help="Pichhle hafte ki leads, visits, bookings aur team ka hisaab owner ke number par (us number ne pichhle 24 ghante mein aapke business number ko message kiya ho)." onChange={(v) => save({ enabled: v, phone: phone || null })} />
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); save({ phone }); }}>
        <input className="input-field !w-auto flex-1" placeholder="Owner ka WhatsApp number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn-secondary gap-2"><Send size={14} /> Save number</button>
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle title="Reports & budget" subtitle={r ? `${r.label}: kis source se kitni leads aayi aur kitni conversion hui` : 'Source-wise leads aur conversion'} action={
        <div className="flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1 text-sm dark:border-ink-700 dark:bg-ink-900" role="tablist">
          {RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${range === k ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{l}</button>)}
        </div>
      } />
      <BudgetSection />
      {error && <p className="card text-sm text-red-600">{errText(error)}</p>}
      {isLoading || !r ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[['Nayi leads', r.totals.newLeads], ['Reply rate', `${r.totals.replyRate}%`], ['Hot leads', r.totals.hot], ['Site visits', `${r.totals.visits}${r.totals.aiVisits ? ` (AI ${r.totals.aiVisits})` : ''}`], ['Bookings', `${r.totals.booked}${r.totals.revenue ? ` · ${inr(r.totals.revenue)}` : ''}`]].map(([l, v]) => (
              <div key={l} className="card min-w-0 !p-4"><p className="text-xs font-medium text-ink-500">{l}</p><p className="mt-1 truncate font-display text-xl font-bold text-ink-900 dark:text-white">{v}</p></div>
            ))}
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card min-w-0">
              <h2 className="font-semibold text-ink-900 dark:text-white">Funnel</h2>
              <ul className="mt-4 space-y-2.5">
                {r.funnel.map((f) => (
                  <li key={f.key}>
                    <div className="flex justify-between text-sm"><span className="text-ink-600 dark:text-ink-300">{f.label}</span><span className="font-mono font-semibold">{f.value.toLocaleString('en-IN')}</span></div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, (f.value / max) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card min-w-0">
              <h2 className="font-semibold text-ink-900 dark:text-white">Roz ka trend</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="leads" name="Leads" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="replies" name="Replies" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="visits" name="Visits" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="min-w-0 space-y-3">
            <div>
              <h2 className="font-semibold text-ink-900 dark:text-white">Leads kahan se aayi aur kitni kaam ki</h2>
              <p className="text-xs text-ink-500">Har source ki leads, unki chat (reply), visit aur booking, saath mein conversion %.</p>
            </div>
            {!groups.length && <p className="card text-sm text-ink-500">Is range mein koi lead nahi.</p>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((g) => (
                <div key={g.key} className="card min-w-0 !p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink-900 dark:text-white">{g.label}</p>
                    <p className="font-display text-2xl font-bold text-brand-700 dark:text-brand-300">{g.leads}<span className="ml-1 text-xs font-medium text-ink-400">leads</span></p>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-ink-500">Chat / reply</dt><dd className="text-right font-mono">{g.replied} <span className="text-xs text-ink-400">({g.replyRate}%)</span></dd>
                    <dt className="text-ink-500">Hot leads</dt><dd className="text-right font-mono">{g.hot}</dd>
                    <dt className="text-ink-500">Site visit</dt><dd className="text-right font-mono">{g.visits} <span className="text-xs text-ink-400">({g.visitRate}%)</span></dd>
                    <dt className="text-ink-500">Booking</dt><dd className="text-right font-mono">{g.booked}{g.revenue ? <span className="text-xs text-ink-400"> · {inr(g.revenue)}</span> : null}</dd>
                  </dl>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-1.5 text-xs dark:bg-brand-900/20">
                    <span className="text-ink-600 dark:text-ink-300">Lead se booking conversion</span>
                    <span className="font-bold text-brand-700 dark:text-brand-300">{g.bookRate}%</span>
                  </div>
                </div>
              ))}
            </div>
            {groups.length > 0 && (
              <div className="card min-w-0">
                <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Source ke hisaab se compare</h3>
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groups.map((g) => ({ name: g.label.split(' / ')[0], Leads: g.leads, Chats: g.replied, Visits: g.visits, Bookings: g.booked }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Leads" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Chats" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Visits" fill="#D97706" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Bookings" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          <section className="card min-w-0 !p-0">
            <h2 className="px-5 pt-5 font-semibold text-ink-900 dark:text-white">Team performance</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase text-ink-400 dark:bg-ink-800/50"><tr><th className="px-5 py-2.5">Name</th><th className="px-3 py-2.5 text-right">Leads</th><th className="px-3 py-2.5 text-right">Replied</th><th className="px-3 py-2.5 text-right">Hot</th><th className="px-3 py-2.5 text-right">Visits</th><th className="px-3 py-2.5 text-right">Visit hue</th><th className="px-5 py-2.5 text-right">Bookings</th></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {r.byAgent.map((a) => <tr key={a.userId || 'none'}><td className={`px-5 py-2.5 font-medium ${a.userId ? '' : 'text-ink-400'}`}>{a.name}</td><td className="px-3 py-2.5 text-right font-mono">{a.assigned}</td><td className="px-3 py-2.5 text-right font-mono">{a.replied}</td><td className="px-3 py-2.5 text-right font-mono">{a.hot}</td><td className="px-3 py-2.5 text-right font-mono">{a.visits} <span className="text-xs text-ink-400">({a.conversion}%)</span></td><td className="px-3 py-2.5 text-right font-mono">{a.visited}</td><td className="px-5 py-2.5 text-right font-mono">{a.booked}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>
          <WeeklyReport />
        </>
      )}
    </div>
  );
}
