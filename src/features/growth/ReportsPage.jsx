import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Loader2, Send } from 'lucide-react';
import { growthApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { inr, PageTitle, Toggle, Notice, errText, SOURCE_LABEL } from '../../lib/saas.jsx';

const RANGES = [['7d', '7 din'], ['30d', '30 din'], ['90d', '90 din'], ['this_month', 'Is mahine'], ['last_month', 'Pichhla mahina']];

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
  const daily = (r?.daily || []).map((d) => ({ ...d, label: d.date.slice(5).split('-').reverse().join('/') }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle title="Reports" subtitle={r ? `${r.label} — leads se booking tak ka poora hisaab` : 'Leads se booking tak ka poora hisaab'} action={
        <div className="flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1 text-sm dark:border-ink-700 dark:bg-ink-900" role="tablist">
          {RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${range === k ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{l}</button>)}
        </div>
      } />
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

          <section className="card min-w-0 !p-0">
            <h2 className="px-5 pt-5 font-semibold text-ink-900 dark:text-white">Source-wise — kaunsa paisa kaam kar raha hai</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase text-ink-400 dark:bg-ink-800/50"><tr><th className="px-5 py-2.5">Source</th><th className="px-3 py-2.5 text-right">Leads</th><th className="px-3 py-2.5 text-right">Reply</th><th className="px-3 py-2.5 text-right">Hot</th><th className="px-3 py-2.5 text-right">Visits</th><th className="px-3 py-2.5 text-right">Visit %</th><th className="px-5 py-2.5 text-right">Bookings</th></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {r.bySource.map((x) => <tr key={x.source}><td className="px-5 py-2.5 font-medium">{SOURCE_LABEL[x.source] || x.source}</td><td className="px-3 py-2.5 text-right font-mono">{x.leads}</td><td className="px-3 py-2.5 text-right font-mono">{x.replied} <span className="text-xs text-ink-400">({x.replyRate}%)</span></td><td className="px-3 py-2.5 text-right font-mono">{x.hot}</td><td className="px-3 py-2.5 text-right font-mono">{x.visits}</td><td className="px-3 py-2.5 text-right font-mono">{x.visitRate}%</td><td className="px-5 py-2.5 text-right font-mono">{x.booked}{x.revenue ? <span className="block text-xs text-ink-400">{inr(x.revenue)}</span> : null}</td></tr>)}
                  {!r.bySource.length && <tr><td colSpan={7} className="px-5 py-8 text-center text-ink-500">Is range mein koi lead nahi</td></tr>}
                </tbody>
              </table>
            </div>
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
