import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Loader2, Mail, CheckCircle2, XCircle, Clock3, Inbox } from 'lucide-react';
import { emailApi } from '../../api/emailApi.js';
import { PageTitle } from '../../lib/saas.jsx';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const shiftDays = (n) => new Date(Date.now() + 330 * 60000 - n * 86400000).toISOString().slice(0, 10);

const fmtTime = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDay = (v) => new Date(`${v}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

const TONE = {
  sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  cancelled: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
};

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={19} /></span>
        <div><p className="text-xs text-ink-500">{label}</p><p className="text-xl font-bold text-ink-900 dark:text-white">{Number(value || 0).toLocaleString('en-IN')}</p></div>
      </div>
    </div>
  );
}

export default function EmailDetailsPage() {
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(shiftDays(6));
  const [to, setTo] = useState(istToday());
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchDraft.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await emailApi.details({ page, limit: 25, ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(search ? { search } : {}) });
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Email details load nahi hui.');
    } finally { setLoading(false); }
  }, [page, status, from, to, search]);
  useEffect(() => { load(); }, [load]);

  const preset = (days) => { setFrom(days === null ? '' : shiftDays(days)); setTo(days === null ? '' : istToday()); setPage(1); };
  const pickDay = (day) => { setFrom(day); setTo(day); setPage(1); };

  const summary = data?.summary || {};
  const items = data?.items || [];
  const daily = data?.daily || [];
  const pg = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 pb-8">
      <PageTitle title="Email details" action={<button onClick={load} className="btn-secondary inline-flex items-center gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Mail} label="Total" value={summary.total} tone="bg-blue-50 text-blue-600 dark:bg-blue-900/30" />
        <Stat icon={CheckCircle2} label="Sent" value={summary.sent} tone="bg-green-50 text-green-600 dark:bg-green-900/30" />
        <Stat icon={XCircle} label="Failed" value={summary.failed} tone="bg-red-50 text-red-600 dark:bg-red-900/30" />
        <Stat icon={Clock3} label="Pending" value={summary.pending} tone="bg-amber-50 text-amber-600 dark:bg-amber-900/30" />
      </div>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
            {STATUS_TABS.map((tab) => (
              <button key={tab.value} type="button" onClick={() => { setStatus(tab.value); setPage(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === tab.value ? 'bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500'}`}>{tab.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input type="date" className="input-field !py-1.5 text-xs" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
            <span className="text-xs text-ink-400">–</span>
            <input type="date" className="input-field !py-1.5 text-xs" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
          </div>
          <div className="flex gap-1 text-xs">
            <button type="button" onClick={() => preset(0)} className="rounded-lg border border-ink-200 px-2.5 py-1.5 font-semibold text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300">Today</button>
            <button type="button" onClick={() => preset(6)} className="rounded-lg border border-ink-200 px-2.5 py-1.5 font-semibold text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300">7 days</button>
            <button type="button" onClick={() => preset(29)} className="rounded-lg border border-ink-200 px-2.5 py-1.5 font-semibold text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300">30 days</button>
            <button type="button" onClick={() => preset(null)} className="rounded-lg border border-ink-200 px-2.5 py-1.5 font-semibold text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300">All time</button>
          </div>
          <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input-field !pl-9" placeholder="Email ya subject search" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} />
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      </section>

      {daily.length > 0 && (
        <section className="card !p-0">
          <h2 className="px-5 pt-4 text-sm font-semibold text-ink-900 dark:text-white">Din ke hisaab se</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-ink-500"><th className="px-5 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Total</th><th className="px-3 py-2 font-medium">Sent</th><th className="px-3 py-2 font-medium">Failed</th><th className="px-3 py-2 font-medium">Pending</th><th className="px-5 py-2" /></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {daily.map((d) => (
                  <tr key={d.date}>
                    <td className="px-5 py-2.5 font-medium text-ink-800 dark:text-ink-100">{fmtDay(d.date)}</td>
                    <td className="px-3 py-2.5">{d.total}</td>
                    <td className="px-3 py-2.5 text-green-700 dark:text-green-300">{d.sent}</td>
                    <td className="px-3 py-2.5 text-red-600">{d.failed}</td>
                    <td className="px-3 py-2.5 text-amber-600">{d.pending}</td>
                    <td className="px-5 py-2.5 text-right"><button type="button" onClick={() => pickDay(d.date)} className="text-xs font-semibold text-brand-600 hover:underline">Dekhein</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card !p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-ink-100 text-left text-xs text-ink-500 dark:border-ink-800"><th className="px-5 py-3 font-medium">Kisko</th><th className="px-3 py-3 font-medium">Subject / Campaign</th><th className="px-3 py-3 font-medium">Time</th><th className="px-3 py-3 font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {loading && !items.length ? (
                <tr><td colSpan={4} className="py-14 text-center"><Loader2 className="mx-auto animate-spin text-ink-400" /></td></tr>
              ) : !items.length ? (
                <tr><td colSpan={4} className="py-14 text-center text-sm text-ink-500"><Inbox className="mx-auto mb-2 text-ink-300" size={26} />Koi email nahi mili. <Link to="/outreach/email" className="font-semibold text-brand-600 hover:underline">Campaign banayein</Link></td></tr>
              ) : items.map((m) => (
                <tr key={m._id} className="align-top">
                  <td className="px-5 py-3"><p className="font-medium text-ink-900 dark:text-white">{m.lead?.name || m.to}</p>{m.lead?.name && <p className="text-xs text-ink-500">{m.to}</p>}</td>
                  <td className="max-w-[320px] px-3 py-3"><p className="truncate text-ink-800 dark:text-ink-100">{m.subject || '—'}</p><p className="truncate text-xs text-ink-500">{m.campaign?.name || '—'}</p></td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-600 dark:text-ink-300">{fmtTime(m.sentAt || m.createdAt)}</td>
                  <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${TONE[m.status] || TONE.cancelled}`}>{m.status}</span>{m.status === 'failed' && m.errorMessage && <p className="mt-1 max-w-[260px] text-xs text-red-600">{m.errorMessage}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-xs text-ink-500 dark:border-ink-800">
          <span>{pg.total} records</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-ink-200 p-1.5 disabled:opacity-40 dark:border-ink-700" aria-label="Previous page"><ChevronLeft size={15} /></button>
            <span>Page {pg.page} / {pg.totalPages}</span>
            <button type="button" disabled={page >= pg.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-ink-200 p-1.5 disabled:opacity-40 dark:border-ink-700" aria-label="Next page"><ChevronRight size={15} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
