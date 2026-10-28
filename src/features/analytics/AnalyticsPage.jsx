import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, ArrowUpRight, Bot, Building2, CalendarCheck,
  ChevronRight, AlertCircle, Flame, MessageCircle, MessageSquare,
  RefreshCw, Send, Sparkles, Target, Users, Zap,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { analyticsApi } from '../../api/analyticsApi.js';
import { useAuthStore } from '../../store/authStore.js';
import SetupChecklist from '../saas/SetupChecklist.jsx';
import MetaBillingSection from './MetaBillingSection.jsx';

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'previous_month', label: 'Previous month' },
];

const number = (value) => Number(value || 0).toLocaleString('en-IN');

function formatDate(value) {
  if (!value) return 'No recent activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No recent activity';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function titleCase(value = '') {
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function MetricCard({ icon: Icon, label, value, hint, tone, to, loading }) {
  const content = (
    <div className="group h-full rounded-2xl border border-slate-200/80 bg-white dark:border-ink-800 dark:bg-ink-900 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${tone}`}><Icon size={20} strokeWidth={1.9} /></span>
        {to && <ArrowUpRight size={17} className="text-slate-300 transition group-hover:text-emerald-600" />}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500 dark:text-ink-400">{label}</p>
      {loading ? <div className="mt-2 h-9 w-20 animate-pulse rounded-lg bg-slate-100" /> : <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{number(value)}</p>}
      <p className="mt-2 min-h-4 text-xs text-slate-400 dark:text-ink-500">{hint}</p>
    </div>
  );
  return to ? <Link to={to} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">{content}</Link> : content;
}

function StatusPill({ children, tone = 'neutral', dot = false }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/15',
    red: 'bg-red-50 text-red-700 ring-red-600/15',
    neutral: 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-ink-300 ring-slate-500/10',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tones[tone] || tones.neutral}`}>{dot && <span className={`h-1.5 w-1.5 rounded-full ${tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'red' ? 'bg-red-500' : 'bg-slate-400'}`} />}{children}</span>;
}

function SectionHeading({ eyebrow, title, description, action }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p><h2 className="mt-1 font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500 dark:text-ink-400">{description}</p>}</div>
    {action}
  </div>;
}

function EmptyState({ icon: Icon, title, body, action }) {
  return <div className="flex min-h-[170px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 dark:bg-ink-950 px-5 py-7 text-center">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-ink-900 text-slate-400 dark:text-ink-500 shadow-sm ring-1 ring-slate-200"><Icon size={19} /></span>
    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-ink-200">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-ink-400">{body}</p>
    {action && <div className="mt-3">{action}</div>}
  </div>;
}

function ScorePill({ value }) {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  const tone = score >= 70 ? 'bg-rose-50 text-rose-700' : score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-ink-300';
  return <span className={`inline-flex min-w-14 items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${tone}`}><Flame size={12} />{score}</span>;
}

export default function AnalyticsPage() {
  const user = useAuthStore((state) => state.user);
  const org = useAuthStore((state) => state.org);
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

    if (dashboardResult.status === 'fulfilled') {
      setSummary(dashboardResult.value?.data || null);
    } else {
      setError(dashboardResult.reason?.response?.data?.message || 'Dashboard data load nahi ho paaya. Connection check karke dobara try karein.');
    }
    if (seriesResult.status === 'fulfilled') setSeries(seriesResult.value?.data?.series || []);
    else setChartError(seriesResult.reason?.response?.data?.message || 'Message activity abhi load nahi ho paayi.');
    if (funnelResult.status === 'fulfilled') setFunnel(funnelResult.value?.data?.salesFunnel || []);
    else setFunnel([]);

    setLoading(false);
    setRefreshing(false);
  }, [range]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const cards = summary?.cards || {};
  const recentActivity = summary?.recentActivity || {};
  const recentConversations = recentActivity.latestConversations || [];
  const recentLeads = recentActivity.recentUploads || [];
  const qualifiedLeads = Number(cards.hotLeads || 0) + Number(cards.warmLeads || 0);
  const isWhatsAppConnected = org?.whatsapp?.status === 'connected' && Boolean(org?.whatsapp?.phoneNumberId);
  const maxFunnel = Math.max(1, ...funnel.map((item) => Number(item.count || 0)));
  const chartTotals = useMemo(() => series.reduce((total, row) => ({ sent: total.sent + Number(row.messagesSent || 0), replies: total.replies + Number(row.repliesReceived || 0) }), { sent: 0, replies: 0 }), [series]);
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const firstName = user?.name?.trim()?.split(/\s+/)[0] || 'there';

  return <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
    <SetupChecklist compact />

    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-ink-500"><span>WORKSPACE</span><span className="text-slate-300">/</span><span className="text-emerald-700">OVERVIEW</span></div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Good to see you, {firstName}<span className="text-emerald-600">.</span></h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-ink-400">Your property leads, AI conversations and site visits — all in one place.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 hidden text-xs text-slate-400 dark:text-ink-500 md:inline">{today}</span>
        <button type="button" onClick={() => fetchAll(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-ink-800 dark:bg-ink-900 px-3.5 py-2.5 text-sm font-semibold text-slate-600 dark:text-ink-300 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:bg-ink-950 disabled:opacity-60"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
        <Link to="/leads" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(5,150,105,0.2)] transition hover:bg-emerald-700"><Users size={16} /> Add a lead</Link>
      </div>
    </div>

    {error && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-start gap-2"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</span><button type="button" onClick={() => fetchAll()} className="self-start font-semibold underline underline-offset-2 sm:self-auto">Try again</button></div>}

    <section className="relative isolate overflow-hidden rounded-[26px] bg-[#0B1728] text-white shadow-[0_20px_60px_rgba(15,23,42,0.13)]">
      <div className="pointer-events-none absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-100px] left-[35%] -z-10 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-200"><Sparkles size={13} /> Visitsly property assistant</div>
          <h2 className="mt-5 max-w-xl font-display text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl">From the first WhatsApp chat to a <span className="text-emerald-300">site visit.</span></h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-[15px]">Let your property assistant understand buyer requirements, suggest matching properties, qualify the lead and help move the conversation toward a visit.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200"><MessageCircle size={13} className="text-emerald-300" /> WhatsApp conversations</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200"><Building2 size={13} className="text-sky-300" /> Property matching</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200"><Target size={13} className="text-amber-300" /> Lead scoring</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/whatsapp/conversations" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#052e27] transition hover:bg-emerald-300">Open AI inbox <ArrowRight size={16} /></Link>
            <Link to="/whatsapp" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">WhatsApp settings <ChevronRight size={15} /></Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 dark:text-ink-500">
            <span className={`inline-flex h-2 w-2 rounded-full ${isWhatsAppConnected ? 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]' : 'bg-amber-400'}`} />
            {isWhatsAppConnected ? `Connected ${org?.whatsapp?.displayPhoneNumber ? `· ${org.whatsapp.displayPhoneNumber}` : '· WhatsApp Business'}` : 'WhatsApp needs attention'}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400 dark:text-ink-500">The lead journey</p><p className="mt-1 text-sm font-semibold text-white">One connected workflow</p></div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Zap size={18} /></span>
          </div>
          <div className="mt-4 space-y-2.5">
            {[
              { icon: MessageCircle, title: 'Buyer messages on WhatsApp', detail: 'Inquiry captured in the inbox', tint: 'text-emerald-300', bg: 'bg-emerald-400/10' },
              { icon: Bot, title: 'AI understands requirements', detail: 'Budget, location and BHK signals', tint: 'text-sky-300', bg: 'bg-sky-400/10' },
              { icon: Building2, title: 'Matching property shared', detail: 'Relevant inventory and details', tint: 'text-violet-300', bg: 'bg-violet-400/10' },
              { icon: Target, title: 'Lead qualified and scored', detail: 'Intent and readiness become visible', tint: 'text-amber-300', bg: 'bg-amber-400/10' },
              { icon: CalendarCheck, title: 'Site visit booked', detail: 'Broker can track the next step', tint: 'text-emerald-300', bg: 'bg-emerald-400/10' },
            ].map((step, index) => {
              const Icon = step.icon;
              return <div key={step.title} className="relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0e1d31]/80 p-3">
                {index < 4 && <span className="absolute left-[27px] top-[46px] z-10 h-3 w-px bg-white/15" />}
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${step.bg} ${step.tint}`}><Icon size={17} /></span>
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-100 sm:text-sm">{step.title}</p><p className="mt-0.5 text-[11px] leading-4 text-slate-400 dark:text-ink-500">{step.detail}</p></div>
                <span className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-ink-400">0{index + 1}</span>
              </div>;
            })}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-500 dark:text-ink-400">Workflow overview · Actual outcomes depend on your connected number, AI settings, inventory and buyer responses.</p>
        </div>
      </div>
    </section>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={Users} label="Total leads" value={cards.totalLeads} hint={`${number(cards.todaysUploads)} added today`} tone="bg-blue-50 text-blue-700 ring-blue-600/10" to="/leads" loading={loading && !summary} />
      <MetricCard icon={Flame} label="Qualified leads" value={qualifiedLeads} hint={`${number(cards.hotLeads)} hot · ${number(cards.warmLeads)} warm`} tone="bg-rose-50 text-rose-700 ring-rose-600/10" to="/qualified-leads" loading={loading && !summary} />
      <MetricCard icon={MessageSquare} label="Active conversations" value={cards.activeConversations} hint={`${number(cards.repliesReceived)} replies received`} tone="bg-emerald-50 text-emerald-700 ring-emerald-600/10" to="/whatsapp/conversations" loading={loading && !summary} />
      <MetricCard icon={CalendarCheck} label="Site visits scheduled" value={cards.siteVisitsScheduled} hint={`${number(cards.siteVisitsCompleted)} completed`} tone="bg-violet-50 text-violet-700 ring-violet-600/10" to="/site-visits" loading={loading && !summary} />
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white dark:border-ink-800 dark:bg-ink-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] sm:p-6">
        <SectionHeading eyebrow="Lead conversion" title="Your sales pipeline" description="See how buyer inquiries move toward a site visit." action={<Link to="/qualified-leads" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">View qualified leads <ArrowRight size={14} /></Link>} />
        {loading && !summary ? <div className="mt-6 space-y-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}</div> : funnel.length === 0 || funnel.every((item) => Number(item.count || 0) === 0) ? <div className="mt-5"><EmptyState icon={Target} title="Your pipeline starts with a lead" body="Import leads or capture your first inquiry to see qualification and site-visit progress here." action={<Link to="/leads" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Open leads <ArrowRight size={14} /></Link>} /></div> : <div className="mt-6 space-y-4">{funnel.map((item, index) => {
          const count = Number(item.count || 0);
          const width = count > 0 ? Math.max(4, (count / maxFunnel) * 100) : 0;
          const fills = ['bg-sky-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-slate-700'];
          return <div key={item.stage}>
            <div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${index === 3 ? 'bg-amber-50 text-amber-700' : index === 4 ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-ink-300'}`}>{String(index + 1).padStart(2, '0')}</span><span className="text-sm font-medium text-slate-700 dark:text-ink-200">{item.stage}</span></div><span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{number(count)}</span></div>
            <div className="ml-[38px] h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-700 ${fills[index % fills.length]}`} style={{ width: `${width}%` }} /></div>
          </div>;
        })}</div>}
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
          <div><p className="text-[11px] text-slate-400 dark:text-ink-500">Messages sent</p><p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{loading && !summary ? '—' : number(cards.messagesSent)}</p></div>
          <div><p className="text-[11px] text-slate-400 dark:text-ink-500">Follow-ups due</p><p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{loading && !summary ? '—' : number(cards.pendingFollowUps)}</p></div>
          <div><p className="text-[11px] text-slate-400 dark:text-ink-500">Closed deals</p><p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{loading && !summary ? '—' : number(cards.dealsClosed)}</p></div>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white dark:border-ink-800 dark:bg-ink-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeading eyebrow="Engagement" title="WhatsApp & email activity" description="Messages sent compared with buyer replies." />
          <div className="flex shrink-0 gap-1 rounded-xl bg-slate-100 dark:bg-ink-800 p-1">{RANGES.map((item) => <button key={item.value} type="button" onClick={() => setRange(item.value)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${range === item.value ? 'bg-white dark:bg-ink-900 text-emerald-700 shadow-sm' : 'text-slate-500 dark:text-ink-400 hover:text-slate-800 dark:text-ink-100'}`}>{item.label}</button>)}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50/70 p-3"><p className="text-[11px] font-medium text-emerald-800">Messages sent</p><p className="mt-1 text-xl font-bold tabular-nums text-slate-950 dark:text-white">{number(chartTotals.sent)}</p></div>
          <div className="rounded-xl bg-blue-50/70 p-3"><p className="text-[11px] font-medium text-blue-800">Buyer replies</p><p className="mt-1 text-xl font-bold tabular-nums text-slate-950 dark:text-white">{number(chartTotals.replies)}</p></div>
        </div>
        <div className="mt-3 h-[206px] w-full">
          {loading ? <div className="flex h-full items-center justify-center text-xs text-slate-400 dark:text-ink-500">Loading activity…</div> : chartError ? <div role="status" className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-500 dark:text-ink-400">{chartError}</div> : series.length === 0 || chartTotals.sent + chartTotals.replies === 0 ? <div className="flex h-full flex-col items-center justify-center text-center"><Activity size={24} className="text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-600 dark:text-ink-300">No activity in this period yet</p><p className="mt-1 max-w-xs text-[11px] text-slate-400 dark:text-ink-500">Once your assistant starts messaging leads, this chart will show the trend.</p></div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 10, right: 10, bottom: 0, left: -22 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={12} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,.08)', fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /><Line type="monotone" dataKey="messagesSent" stroke="#059669" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} name="Sent" /><Line type="monotone" dataKey="repliesReceived" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} name="Replies" /></LineChart></ResponsiveContainer>}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:text-ink-500"><span>{range === 'previous_month' ? 'Previous calendar month' : `Last ${range === '7d' ? '7' : '30'} days, including today`}</span><span>IST · Asia/Kolkata</span></div>
      </section>
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white dark:border-ink-800 dark:bg-ink-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] sm:p-6">
        <SectionHeading eyebrow="Buyer conversations" title="Latest activity in the AI inbox" description="Pick up where a buyer left off." action={<Link to="/whatsapp/conversations" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">Open inbox <ArrowRight size={14} /></Link>} />
        <div className="mt-4 divide-y divide-slate-100">
          {loading && !summary ? <div className="space-y-3 py-2">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</div> : recentConversations.length === 0 ? <EmptyState icon={MessageCircle} title="Your inbox is ready" body="New buyer conversations and AI summaries will appear here once leads start replying on WhatsApp." action={<Link to="/whatsapp/conversations" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white dark:border-ink-800 dark:bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-ink-200 hover:bg-slate-50">View conversations <ArrowRight size={14} /></Link>} /> : recentConversations.slice(0, 5).map((conversation) => {
            const lead = conversation.leadId || {};
            const score = Number(conversation.currentLeadScore || 0);
            const isManual = conversation.status === 'manual';
            return <button type="button" key={conversation._id} onClick={() => navigate(`/whatsapp/conversations?id=${conversation._id}`)} className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-slate-50/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{(lead.name || 'B').trim().charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-800 dark:text-ink-100">{lead.name || 'New buyer'}</p><StatusPill tone={isManual ? 'amber' : 'green'}>{isManual ? 'Human takeover' : 'AI active'}</StatusPill></div><p className="mt-1 truncate text-xs text-slate-500 dark:text-ink-400">{conversation.aiSummary || lead.phone || 'Open conversation to review buyer requirements'}</p><p className="mt-1 text-[10px] text-slate-400 dark:text-ink-500">{formatDate(conversation.lastMessageAt)}</p></div>
              <div className="flex shrink-0 flex-col items-end gap-1"><ScorePill value={score} /><span className="text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-ink-500">Lead score</span></div>
            </button>;
          })}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white dark:border-ink-800 dark:bg-ink-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] sm:p-6">
        <SectionHeading eyebrow="New inquiries" title="Recently added leads" description="Every new lead is an opportunity to start a conversation." action={<Link to="/leads" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">All leads <ArrowRight size={14} /></Link>} />
        <div className="mt-4 divide-y divide-slate-100">
          {loading && !summary ? <div className="space-y-3 py-2">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</div> : recentLeads.length === 0 ? <EmptyState icon={Users} title="No leads added yet" body="Import your spreadsheet or add a buyer manually. You can then qualify the lead through your WhatsApp workflow." action={<Link to="/leads" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"><Users size={14} /> Add or import leads</Link>} /> : recentLeads.slice(0, 5).map((lead) => {
            const status = String(lead.status || 'new').toLowerCase();
            const tone = status === 'hot' || status === 'site_visit' ? 'red' : status === 'warm' || status === 'contacted' || status === 'qualified' ? 'amber' : status === 'closed' ? 'green' : 'neutral';
            return <Link key={lead._id} to="/leads" className="flex items-center gap-3 py-3.5 transition hover:bg-slate-50/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-ink-800 text-slate-500 dark:text-ink-400"><Users size={17} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800 dark:text-ink-100">{lead.name || 'Unnamed lead'}</p><p className="mt-1 truncate text-xs text-slate-500 dark:text-ink-400">{[lead.city, lead.phone].filter(Boolean).join(' · ') || 'Location and contact details not added'}</p><p className="mt-1 text-[10px] text-slate-400 dark:text-ink-500">Added {formatDate(lead.createdAt)}</p></div>
              <div className="flex shrink-0 flex-col items-end gap-1"><StatusPill tone={tone}>{titleCase(status)}</StatusPill><span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-ink-500">Open lead <ChevronRight size={12} /></span></div>
            </Link>;
          })}
        </div>
      </section>
    </div>

    <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-ink-800 dark:bg-ink-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] sm:p-6">
      <SectionHeading eyebrow="Keep moving" title="Quick actions" description="Jump straight into your next task." />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Users, title: 'Import leads', body: 'Bring buyer data from Excel or CSV.', to: '/leads', tint: 'bg-blue-50 text-blue-700' },
          { icon: Building2, title: 'Manage properties', body: 'Keep inventory ready for AI matching.', to: '/properties', tint: 'bg-violet-50 text-violet-700' },
          { icon: Send, title: 'Launch a campaign', body: 'Follow up with a selected audience.', to: '/outreach/whatsapp', tint: 'bg-emerald-50 text-emerald-700' },
          { icon: CalendarCheck, title: 'Manage site visits', body: 'Review bookings and next appointments.', to: '/site-visits', tint: 'bg-amber-50 text-amber-700' },
        ].map((action) => {
          const Icon = action.icon;
          return <Link key={action.title} to={action.to} className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-sm"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.tint}`}><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 dark:text-ink-100">{action.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-ink-400">{action.body}</span></span><ArrowUpRight size={15} className="shrink-0 text-slate-300 transition group-hover:text-emerald-600" /></Link>;
        })}
      </div>
    </section>

    <MetaBillingSection />
  </div>;
}
