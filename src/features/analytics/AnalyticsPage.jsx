import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, AlertCircle, ArrowRight, CalendarCheck, ChevronRight, Flame, Mail,
  MessageCircle, MessageSquare, RefreshCw, Target, Users,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { analyticsApi } from '../../api/analyticsApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { Skeleton } from '../../components/ui/index.jsx';
import MetaBillingSection from './MetaBillingSection.jsx';
import SourcePerformance from './SourcePerformance.jsx';
import TrialUsageCard from '../saas/TrialUsageCard.jsx';

const RANGES = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'previous_month', label: 'Last month' },
];

const number = (value) => Number(value || 0).toLocaleString('en-IN');

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const titleCase = (value = '') => String(value).replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const CARD = 'min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] dark:border-ink-800 dark:bg-ink-900';

function Heading({ title, sub, action }) {
  return <div className="flex items-start justify-between gap-3">
    <div><h2 className="font-display text-base font-bold tracking-tight text-slate-950 dark:text-white">{title}</h2>{sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-400">{sub}</p>}</div>
    {action}
  </div>;
}

/** One row of the left "At a glance" card. */
function StatRow({ icon: Icon, label, value, hint, tone, to, loading }) {
  return <Link to={to} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 dark:hover:bg-ink-800/60">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={17} /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-medium text-slate-500 dark:text-ink-400">{label}</span>
      {hint && <span className="block truncate text-[11px] text-slate-400 dark:text-ink-500">{hint}</span>}
    </span>
    {loading ? <Skeleton className="h-6 w-10" /> : <span className="font-display text-xl font-bold tabular-nums text-slate-950 dark:text-white">{number(value)}</span>}
    <ChevronRight size={14} className="shrink-0 text-slate-300 transition group-hover:text-emerald-600" />
  </Link>;
}

function ChannelBlock({ icon: Icon, title, tone, items, loading }) {
  return <div className="rounded-xl border border-slate-100 p-3 dark:border-ink-800">
    <div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}><Icon size={14} /></span><p className="text-sm font-semibold text-slate-800 dark:text-ink-100">{title}</p></div>
    <div className={`mt-2.5 grid gap-2 ${items.length > 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {items.map(([label, value, cls]) => <div key={label}>
        <p className="text-[11px] text-slate-400 dark:text-ink-500">{label}</p>
        {loading ? <Skeleton className="mt-1 h-5 w-8" /> : <p className={`mt-0.5 text-lg font-bold tabular-nums ${cls || 'text-slate-900 dark:text-white'}`}>{number(value)}</p>}
      </div>)}
    </div>
  </div>;
}

function Empty({ icon: Icon, title, action }) {
  return <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center dark:border-ink-700">
    <Icon size={20} className="text-slate-300" />
    <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-ink-300">{title}</p>
    {action && <div className="mt-2">{action}</div>}
  </div>;
}

function ScorePill({ value }) {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  const tone = score >= 70 ? 'bg-rose-50 text-rose-700' : score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-ink-300';
  return <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${tone}`}><Flame size={11} />{score}</span>;
}

export default function AnalyticsPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [chartError, setChartError] = useState('');

  const fetchAll = useCallback(async (isRefresh = false) => {
    setError('');
    setChartError('');
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [dashboardResult, seriesResult, funnelResult] = await Promise.allSettled([
      analyticsApi.dashboard({}),
      analyticsApi.timeseries({ range }),
      analyticsApi.funnel({}),
    ]);
    if (dashboardResult.status === 'fulfilled') setSummary(dashboardResult.value?.data || null);
    else setError(dashboardResult.reason?.response?.data?.message || 'Could not load the dashboard. Check your connection and try again.');
    if (seriesResult.status === 'fulfilled') setSeries(seriesResult.value?.data?.series || []);
    else setChartError(seriesResult.reason?.response?.data?.message || 'Could not load activity.');
    if (funnelResult.status === 'fulfilled') setFunnel(funnelResult.value?.data?.salesFunnel || []);
    else setFunnel([]);
    setLoading(false);
    setRefreshing(false);
  }, [range]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const cards = summary?.cards || {};
  const channels = summary?.channels || {};
  const wa = channels.whatsapp || {};
  const em = channels.email || {};
  const recentConversations = summary?.recentActivity?.latestConversations || [];
  const recentLeads = summary?.recentActivity?.recentUploads || [];
  const qualifiedLeads = Number(cards.hotLeads || 0) + Number(cards.warmLeads || 0);
  const maxFunnel = Math.max(1, ...funnel.map((item) => Number(item.count || 0)));
  const chartTotals = useMemo(() => series.reduce((t, row) => ({ sent: t.sent + Number(row.messagesSent || 0), replies: t.replies + Number(row.repliesReceived || 0) }), { sent: 0, replies: 0 }), [series]);
  const firstName = user?.name?.trim()?.split(/\s+/)[0] || 'there';
  const initial = loading && !summary;

  return <div className="mx-auto max-w-[1500px] space-y-5 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">Hi {firstName}<span className="text-emerald-600">.</span></h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-ink-400">Your leads, chats and visits at a glance.</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fetchAll(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
        <Link to="/leads" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"><Users size={15} /> Upload data</Link>
      </div>
    </div>

    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</span><button type="button" onClick={() => fetchAll()} className="font-semibold underline underline-offset-2">Retry</button></div>}

    <TrialUsageCard />

    {/* Row 1: stats (left) · lead-source chart (middle) · channel activity (right) */}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,380px)]">
      <section className={`${CARD} !p-3`}>
        <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">At a glance</p>
        <div className="divide-y divide-slate-100 dark:divide-ink-800">
          <StatRow icon={Users} label="Total leads" value={cards.totalLeads} hint={`${number(cards.todaysUploads)} today`} tone="bg-blue-50 text-blue-700" to="/leads" loading={initial} />
          <StatRow icon={Flame} label="Qualified" value={qualifiedLeads} hint={`${number(cards.hotLeads)} hot · ${number(cards.warmLeads)} warm`} tone="bg-rose-50 text-rose-700" to="/whatsapp/leads" loading={initial} />
          <StatRow icon={MessageSquare} label="Active chats" value={cards.activeConversations} hint={`${number(cards.repliesReceived)} replies`} tone="bg-emerald-50 text-emerald-700" to="/whatsapp/conversations" loading={initial} />
          <StatRow icon={CalendarCheck} label="Site visits" value={cards.siteVisitsScheduled} hint={`${number(cards.siteVisitsCompleted)} done`} tone="bg-violet-50 text-violet-700" to="/site-visits" loading={initial} />
          <StatRow icon={Target} label="Follow-ups due" value={cards.pendingFollowUps} tone="bg-amber-50 text-amber-700" to="/follow-ups" loading={initial} />
        </div>
      </section>

      <SourcePerformance />

      <section className={`${CARD} lg:col-span-2 xl:col-span-1`}>
        <Heading title="WhatsApp & email" sub="Messages sent and replies" action={<div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">{RANGES.map((item) => <button key={item.value} type="button" onClick={() => setRange(item.value)} className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${range === item.value ? 'bg-white text-emerald-700 shadow-sm dark:bg-ink-900' : 'text-slate-500 dark:text-ink-400'}`}>{item.label}</button>)}</div>} />
        <div className="mt-3 space-y-2.5">
          <ChannelBlock icon={MessageCircle} title="WhatsApp" tone="bg-green-50 text-green-700" loading={initial} items={[['Sent', wa.sent ?? cards.messagesSent], ['Replies', wa.replies], ['Failed', wa.failed, Number(wa.failed) ? 'text-red-600' : '']]} />
          <ChannelBlock icon={Mail} title="Email" tone="bg-blue-50 text-blue-700" loading={initial} items={[['Sent', em.sent], ['Opened', em.opened], ['Replies', em.replies], ['Failed', em.failed, Number(em.failed) ? 'text-red-600' : '']]} />
        </div>
        <div className="mt-3 h-[150px] w-full">
          {loading ? <Skeleton className="h-full w-full" /> : chartError ? <div className="flex h-full items-center justify-center text-xs text-slate-500">{chartError}</div> : series.length === 0 || chartTotals.sent + chartTotals.replies === 0 ? <div className="flex h-full flex-col items-center justify-center text-center"><Activity size={20} className="text-slate-300" /><p className="mt-1.5 text-xs font-semibold text-slate-500">No activity in this period</p></div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: -26 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={14} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} /><Line type="monotone" dataKey="messagesSent" stroke="#059669" strokeWidth={2} dot={false} name="Sent" /><Line type="monotone" dataKey="repliesReceived" stroke="#3b82f6" strokeWidth={2} dot={false} name="Replies" /></LineChart></ResponsiveContainer>}
        </div>
      </section>
    </div>

    {/* Row 2: pipeline · latest chats · new leads */}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className={CARD}>
        <Heading title="Sales pipeline" action={<Link to="/whatsapp/leads" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">View <ArrowRight size={13} /></Link>} />
        {initial ? <div className="mt-4 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7" />)}</div> : funnel.every((item) => !Number(item.count)) ? <div className="mt-3"><Empty icon={Target} title="No leads yet" action={<Link to="/leads" className="text-xs font-semibold text-emerald-700 underline">Add leads</Link>} /></div> : <div className="mt-4 space-y-3">{funnel.map((item, index) => {
          const count = Number(item.count || 0);
          const fills = ['bg-sky-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-slate-700'];
          return <div key={item.stage}>
            <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-slate-600 dark:text-ink-300">{item.stage}</span><span className="font-bold tabular-nums text-slate-900 dark:text-white">{number(count)}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800"><div className={`h-full rounded-full ${fills[index % fills.length]}`} style={{ width: `${count ? Math.max(4, (count / maxFunnel) * 100) : 0}%` }} /></div>
          </div>;
        })}</div>}
      </section>

      <section className={CARD}>
        <Heading title="Latest chats" action={<Link to="/whatsapp/conversations" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">Inbox <ArrowRight size={13} /></Link>} />
        <div className="mt-2 divide-y divide-slate-100 dark:divide-ink-800">
          {initial ? <div className="space-y-2 py-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div> : recentConversations.length === 0 ? <Empty icon={MessageCircle} title="No chats yet" /> : recentConversations.slice(0, 5).map((c) => {
            const lead = c.leadId || {};
            return <button type="button" key={c._id} onClick={() => navigate(`/whatsapp/conversations?id=${c._id}`)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-slate-50/80 dark:hover:bg-ink-800/40">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">{(lead.name || 'B').trim().charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-ink-100">{lead.name || 'New buyer'}</span><span className="block truncate text-[11px] text-slate-400">{formatDate(c.lastMessageAt)}{c.status === 'manual' ? ' · Human' : ''}</span></span>
              <ScorePill value={c.currentLeadScore} />
            </button>;
          })}
        </div>
      </section>

      <section className={CARD}>
        <Heading title="New leads" action={<Link to="/leads" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">All <ArrowRight size={13} /></Link>} />
        <div className="mt-2 divide-y divide-slate-100 dark:divide-ink-800">
          {initial ? <div className="space-y-2 py-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div> : recentLeads.length === 0 ? <Empty icon={Users} title="No leads yet" action={<Link to="/leads" className="text-xs font-semibold text-emerald-700 underline">Import leads</Link>} /> : recentLeads.slice(0, 5).map((lead) => <Link key={lead._id} to="/leads" className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50/80 dark:hover:bg-ink-800/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-ink-800"><Users size={14} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-ink-100">{lead.name || 'Unnamed lead'}</span><span className="block truncate text-[11px] text-slate-400">{formatDate(lead.createdAt)}</span></span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-ink-800 dark:text-ink-300">{titleCase(lead.status || 'new')}</span>
          </Link>)}
        </div>
      </section>
    </div>

    <MetaBillingSection />
  </div>;
}
