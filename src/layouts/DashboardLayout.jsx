import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, CalendarCheck, Clock, Settings as SettingsIcon,
  UserCircle, LogOut, Menu, Mail, MessageCircle, Loader2, ChevronDown,
  MessageSquare, Flame, Smartphone, PanelLeftClose, PanelLeftOpen, FileText,
  Bot, Briefcase, CreditCard, UsersRound, Rocket, Link2, TrendingUp, BarChart3, Handshake, Settings2, ListChecks, Lock,
} from 'lucide-react';
import { useAuthStore, useOrgRole, useCan, teamAvailable } from '../store/authStore.js';
import { orgApi } from '../api/saasApi.js';
import { conversationApi } from '../api/conversationApi.js';
import SupportNavButton from '../features/saas/SupportNavButton.jsx';
import SubscriptionBanner from '../features/saas/SubscriptionBanner.jsx';
import LiveSendingPanel from '../features/outreach/LiveSendingPanel.jsx';
import { authApi } from '../api/authApi.js';
import { useOutreachSummaryLive } from '../hooks/useOutreachLive.js';
import { Toaster, toast, PageLoader } from '../components/ui/index.jsx';
import { showUpgrade } from '../lib/saas.jsx';
import { getSocket } from '../lib/socket.js';

const NAV_GROUPS = [
  { type: 'link', to: '/dashboard', label: 'Overview', icon: LayoutDashboard, perm: 'dashboard' },
  { type: 'link', to: '/leads', label: 'Upload Data', icon: Users, perm: 'leads' },
  {
    type: 'group', key: 'whatsapp', label: 'WhatsApp AI', icon: MessageCircle, children: [
      { to: '/whatsapp', label: 'Connect number', icon: Smartphone, roles: ['owner'] },
      { to: '/whatsapp/ai-script', label: 'AI chat script', icon: Bot, roles: ['owner'] },
      { to: '/whatsapp/conversations', label: 'AI inbox', icon: MessageSquare, perm: 'inbox' },
      { to: '/outreach/whatsapp', label: 'Campaigns', icon: Rocket, channel: 'whatsapp', roles: ['owner'], feature: 'bulkWhatsapp' },
      { to: '/whatsapp/leads', label: 'WhatsApp leads', icon: Flame, perm: 'whatsappLeads' },
      { to: '/whatsapp/templates', label: 'Templates', icon: FileText, roles: ['owner'] },
      { to: '/whatsapp/visit-confirmation', label: 'AI calling', icon: CalendarCheck, roles: ['owner'], feature: 'aiCalling' },
    ],
  },
  {
    type: 'group', key: 'email', label: 'Email automation', icon: Mail, children: [
      { to: '/email/setup', hideLocked: true, label: 'Setup', icon: Settings2, roles: ['owner'], feature: 'emailCampaigns' },
      { to: '/outreach/email', hideLocked: true, label: 'Campaigns', icon: Mail, channel: 'email', roles: ['owner'], feature: 'emailCampaigns' },
      { to: '/email/templates', hideLocked: true, label: 'Templates', icon: FileText, roles: ['owner'], feature: 'emailCampaigns' },
      { to: '/email/details', hideLocked: true, label: 'Email details', icon: ListChecks, roles: ['owner'], feature: 'emailCampaigns' },
    ],
  },
  { type: 'link', to: '/properties', label: 'Properties', icon: Building2, perm: 'properties' },
  { type: 'link', to: '/site-visits', label: 'Site visits', icon: CalendarCheck, perm: 'siteVisits' },
  { type: 'link', to: '/follow-ups', label: 'Follow-ups', icon: Clock, perm: 'followUps' },
  {
    type: 'group', key: 'growth', label: 'Growth tools', icon: TrendingUp, children: [
      { to: '/reports', label: 'Reports & budget', icon: BarChart3, roles: ['owner'] },
      { to: '/lead-sources', label: 'Lead sources', icon: Link2, roles: ['owner'] },
      { to: '/channel-partners', label: 'Channel partners', icon: Handshake, roles: ['owner'] },
    ],
  },
  {
    type: 'group', key: 'company', label: 'Workspace & billing', icon: Briefcase, children: [
      { to: '/team', label: 'Team & members', icon: UsersRound, roles: ['owner'], teamPlan: true },
      { to: '/team', label: 'Company details', icon: Building2, roles: ['owner'], teamPlan: 'off' }, // Starter / Trial: no team, only the company details
      { to: '/billing', label: 'Plan & billing', icon: CreditCard, roles: ['owner'] },
    ],
  },
  {
    type: 'group', key: 'account', label: 'Settings', icon: SettingsIcon, children: [
      { to: '/profile', label: 'My profile', icon: UserCircle },
      { to: '/settings', label: 'AI & business settings', icon: SettingsIcon, roles: ['owner'] },
    ],
  },
];

// AI inbox pages: the page itself shows new messages live, so no toast there.
const INBOX_PATHS = ['/conversations', '/whatsapp/conversations'];
const isInboxPath = (path) => INBOX_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
const truncate = (text, max = 60) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1)}…` : t; };

function UnreadBadge({ count, className = '' }) {
  if (!count) return null;
  return <span className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${className}`} aria-label={`${count} unread conversations`}>{count > 99 ? '99+' : count}</span>;
}

const GROUP_KEYS = { whatsapp: false, email: false, growth: false, company: false, account: false };
const GROWTH_PATHS = ['/reports', '/lead-sources', '/channel-partners'];

function OutreachBadge({ stats }) {
  if (!stats || !stats.total) return null;
  const done = stats.sent === stats.total;
  return <span className="ml-auto flex items-center gap-1.5">{stats.processing > 0 && <Loader2 size={12} className="animate-spin" />}<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${done ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-ink-200'}`} title={`${stats.sent} sent, ${stats.pending + stats.paused} pending, ${stats.failed} failed`}>{stats.sent}/{stats.total}</span></span>;
}

export default function DashboardLayout() {
  const { data: outreach } = useOutreachSummaryLive();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    const path = window.location.pathname;
    return { whatsapp: path.startsWith('/whatsapp') || path === '/outreach/whatsapp', email: path.startsWith('/email') || path === '/outreach/email', growth: GROWTH_PATHS.includes(path), company: ['/team', '/billing'].includes(path), account: ['/profile', '/settings'].includes(path) };
  });
  const { user, clearSession, org, setOrg, support } = useAuthStore();
  const orgRole = useOrgRole();
  const brandName = org?.branding?.productName || org?.name || 'Visitsly';
  const brandLogo = org?.branding?.logoUrl || '';

  // Medium density for all app screens (see index.css → html.app-compact).
  useEffect(() => {
    document.documentElement.classList.add('app-compact');
    return () => document.documentElement.classList.remove('app-compact');
  }, []);
  // Keep plan, usage and subscription status fresh (banner + limits).
  useEffect(() => {
    const load = () => {
      orgApi.get().then((r) => setOrg(r.data.org)).catch(() => {});
      // Pick up permission changes the owner made (sidebar / buttons follow; the server enforces them at once).
      if (!useAuthStore.getState().support) authApi.me().then((r) => useAuthStore.getState().setUser(r.data.user)).catch(() => {});
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [setOrg]);
  // Instant on-screen alert for hot leads / booked & confirmed visits / budget.
  useEffect(() => {
    const socket = getSocket();
    const onNotification = (p) => {
      const labels = { hot_lead: '🔥 New hot lead — check the AI inbox', visit_booked: '📅 New site visit booked', visit_confirmed: '✅ A visit was confirmed', visit_declined: '⚠️ A customer can’t make their visit', budget: '💰 Budget alert — see Reports → Budget' };
      if (p?.kind && labels[p.kind]) toast.info(labels[p.kind]);
    };
    socket.on('notification:new', onNotification);
    // AI stopped for a contact (free trial: 15 replies per contact) → upgrade popup, once per chat.
    const shown = new Set();
    const onAiLimit = (p) => {
      const key = String(p?.conversationId || '');
      if (!p?.reached || shown.has(key)) return;
      shown.add(key);
      const trial = useAuthStore.getState().org?.status === 'trialing';
      showUpgrade(`${trial ? 'Free trial limit reached: the' : 'The'} AI has replied ${p.limit} times to one contact and has stopped replying to them. Upgrade to keep the AI replying, or reply yourself from the AI inbox.`, { title: trial ? 'Free trial limit reached' : 'AI reply limit reached' });
    };
    socket.on('conversation:aiLimit', onAiLimit);
    return () => { socket.off('notification:new', onNotification); socket.off('conversation:aiLimit', onAiLimit); };
  }, []);
  const navigate = useNavigate();
  const location = useLocation();

  // ---- Unread conversations: sidebar badge + toast for a new customer message ----
  // (All hooks stay above the WhatsApp redirect further down.)
  const can = useCan();
  const canSeeInbox = Boolean(orgRole) && can('inbox');
  const [unreadCount, setUnreadCount] = useState(0);
  const onInboxPage = isInboxPath(location.pathname);
  const onInboxPageRef = useRef(onInboxPage);
  onInboxPageRef.current = onInboxPage;
  const unreadTimer = useRef(null);
  const refreshUnreadNow = useCallback(() => {
    conversationApi.counts().then((r) => setUnreadCount(Number(r?.data?.counts?.unread) || 0)).catch(() => {});
  }, []);
  // Debounced (~1s) so a burst of messages causes one request.
  const refreshUnread = useCallback(() => {
    clearTimeout(unreadTimer.current);
    unreadTimer.current = setTimeout(refreshUnreadNow, 1000);
  }, [refreshUnreadNow]);
  useEffect(() => {
    if (!canSeeInbox) { setUnreadCount(0); return undefined; }
    refreshUnreadNow();
    const poll = setInterval(refreshUnreadNow, 60 * 1000); // fallback if a socket event is missed
    const socket = getSocket();
    const lastToast = new Map(); // conversationId → time (one toast per conversation per few seconds)
    const onNewMessage = (p) => {
      if (p?.message?.direction !== 'inbound') return; // ignore outbound / AI messages
      refreshUnread();
      if (onInboxPageRef.current) return;
      const key = String(p.conversationId || '');
      const now = Date.now();
      if (now - (lastToast.get(key) || 0) < 5000) return;
      lastToast.set(key, now);
      toast.info(`💬 ${p.leadName || 'New message'}: ${truncate(p.preview)}`);
    };
    socket.on('conversation:newMessage', onNewMessage);
    socket.on('conversation:updated', refreshUnread);
    return () => {
      clearInterval(poll);
      clearTimeout(unreadTimer.current);
      socket.off('conversation:newMessage', onNewMessage);
      socket.off('conversation:updated', refreshUnread);
    };
  }, [canSeeInbox, refreshUnread, refreshUnreadNow]);
  // Opening a chat clears its unread count on the server → refresh when entering / leaving the inbox.
  const inboxMounted = useRef(false);
  useEffect(() => {
    if (!inboxMounted.current) { inboxMounted.current = true; return; }
    if (canSeeInbox) refreshUnread();
  }, [onInboxPage, canSeeInbox, refreshUnread]);

  // The app always uses the light theme (the dark / light switch was removed).
  // Must stay above the WhatsApp redirect below: a hook after an early return
  // changes the hook count between renders and React blanks the whole screen.
  useEffect(() => { document.documentElement.classList.remove('dark'); }, []);

  const whatsappConnected = org?.whatsapp?.status === 'connected' && Boolean(org?.whatsapp?.phoneNumberId);
  // New workspaces complete WhatsApp setup before accessing the rest of the
  // operational onboarding routes. Settings/billing/profile and WhatsApp setup
  // stay accessible so Meta failures never trap the user without a recovery path.
  const routesAvailableBeforeWhatsApp = ['/get-started', '/whatsapp', '/profile', '/settings', '/billing', '/team', '/lead-sources'];
  const canAccessBeforeWhatsApp = routesAvailableBeforeWhatsApp.includes(location.pathname);
  // Only the owner can connect WhatsApp, so an agent is never sent to the connect page.
  const blockedByWhatsApp = Boolean(org && !support && orgRole === 'owner' && !whatsappConnected && !canAccessBeforeWhatsApp);
  // Tell the user why they were sent to /whatsapp — once per blocked navigation (the path changed),
  // never on the first landing after login. Above the early return below: hooks must not follow it.
  const prevPathRef = useRef(null);
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (blockedByWhatsApp && prev !== null && prev !== location.pathname) toast.info('Please connect your WhatsApp first to use this section.');
  }, [blockedByWhatsApp, location.pathname]);
  if (blockedByWhatsApp) {
    return <Navigate to="/whatsapp" replace state={{ onboardingRequired: true }} />;
  }

  const handleLogout = async () => {
    try { await authApi.logout(); } finally { clearSession(); navigate('/login'); }
  };

  const linkClass = (active) => `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${active ? 'bg-emerald-500 text-white shadow-[0_8px_18px_rgba(16,185,129,0.20)]' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`;

  // Owner-only entries, per-page permissions (agents), and Team only on plans that have a team.
  const allowed = (entry) => (!entry.hideLocked || org?.features?.[entry.feature] !== false) && (!entry.roles || entry.roles.includes(orgRole)) && (!entry.perm || can(entry.perm)) && (!entry.teamPlan || (entry.teamPlan === 'off' ? !teamAvailable(org) : teamAvailable(org)));
  const navItems = NAV_GROUPS
    .map((g) => (g.type === 'group' ? { ...g, children: g.children.filter(allowed) } : g))
    .filter((g) => (g.type === 'link' ? allowed(g) : g.children.length));

  const renderNav = () => navItems.map((item) => {
    if (item.type === 'link') {
      const Icon = item.icon;
      return <NavLink key={item.to} to={item.to} end onClick={() => setSidebarOpen(false)} className={({ isActive }) => linkClass(isActive)} title={sidebarCollapsed ? item.label : undefined}>
        <Icon size={18} className="shrink-0" />{!sidebarCollapsed && <span>{item.label}</span>}
      </NavLink>;
    }
    const Icon = item.icon;
    // '/whatsapp' (numbers page) must not light up for '/whatsapp/conversations' etc.
    const active = item.children.some((child) => location.pathname === child.to || (child.to !== '/whatsapp' && location.pathname.startsWith(`${child.to}/`)));
    const isOpen = expanded[item.key];
    return <div key={item.key} className="space-y-1">
      <button type="button" onClick={() => setExpanded((previous) => previous[item.key] ? { ...GROUP_KEYS } : { ...GROUP_KEYS, [item.key]: true })} className={`${linkClass(active)} relative`} title={sidebarCollapsed ? item.label : undefined} aria-expanded={Boolean(isOpen)}>
        <Icon size={18} className="shrink-0" />{sidebarCollapsed && item.key === 'whatsapp' && <UnreadBadge count={unreadCount} className="absolute right-1 top-1 !px-1 !py-0.5" />}{!sidebarCollapsed && <><span className="flex-1">{item.label}</span>{item.key === 'whatsapp' && !isOpen && <UnreadBadge count={unreadCount} />}<ChevronDown size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /></>}
      </button>
      {isOpen && !sidebarCollapsed && <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
        {item.children.map((child) => {
          const ChildIcon = child.icon;
          return <NavLink key={child.to} to={child.to} end={child.to === '/whatsapp'} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${isActive ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-300/15' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'}`}>
            <ChildIcon size={15} className="shrink-0" /><span className="flex-1">{child.label}</span>{child.to === '/whatsapp/conversations' && <UnreadBadge count={unreadCount} />}{child.feature && org?.features?.[child.feature] === false ? <Lock size={12} className="text-amber-300/80" aria-label="Upgrade to unlock" /> : child.channel && <OutreachBadge stats={outreach?.[child.channel]} />}
          </NavLink>;
        })}
      </div>}
    </div>;
  });

  const SidebarContent = <div className="flex h-full flex-col">
    <div className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-5'} border-b border-white/[0.08] py-5`}>
      {brandLogo
        ? <img src={brandLogo} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 shadow-sm" />
        : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-emerald-600 text-white shadow-lg shadow-emerald-950/40"><Building2 size={21} /></span>}
      {!sidebarCollapsed && <div className="min-w-0"><p className="truncate font-display text-sm font-bold tracking-tight text-white">{org?.name || 'Visitsly'}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">AI PROPERTY CRM</p></div>}
    </div>
    <div className={`px-5 pt-4 ${sidebarCollapsed ? 'hidden' : ''}`}><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</p></div><nav className="sidebar-scrollbar-hide min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">{renderNav()}</nav>
    <div className="space-y-1 border-t border-white/[0.08] p-3">
      <button onClick={() => setSidebarCollapsed((value) => !value)} className="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:flex" title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />} {!sidebarCollapsed && 'Collapse sidebar'}
      </button>
      <SupportNavButton collapsed={sidebarCollapsed} onNavigate={() => setSidebarOpen(false)} />
      <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white" title={sidebarCollapsed ? 'Log out' : undefined}>
        <LogOut size={18} />{!sidebarCollapsed && 'Log out'}
      </button>
    </div>
  </div>;

  return <div className="flex h-screen overflow-hidden bg-[#F5F7FB] dark:bg-ink-950">
    <aside className={`relative hidden flex-shrink-0 overflow-hidden bg-[#0B1220] transition-[width] duration-200 lg:block ${sidebarCollapsed ? 'w-[76px]' : 'w-[264px]'}`}><div className="pointer-events-none absolute -right-24 top-28 h-64 w-64 rounded-full bg-emerald-500/[0.08] blur-3xl" /><div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-blue-500/[0.06] blur-3xl" /><div className="relative z-10 h-full">{SidebarContent}</div></aside>
    {sidebarOpen && <div className="fixed inset-0 z-40 lg:hidden"><button type="button" aria-label="Close navigation" className="absolute inset-0 h-full w-full bg-black/50" onClick={() => setSidebarOpen(false)} /><aside className="absolute left-0 top-0 h-full w-72 overflow-hidden bg-[#0B1220]"><div className="pointer-events-none absolute right-[-80px] top-28 h-64 w-64 rounded-full bg-emerald-500/[0.08] blur-3xl" /><div className="relative z-10 h-full">{SidebarContent}</div></aside></div>}
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <SubscriptionBanner />
      <LiveSendingPanel />
      <header className="flex h-[72px] flex-shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur dark:border-ink-800 dark:bg-ink-900 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><button className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21} /></button><div className="min-w-0"><p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">{brandName}</p><p className="mt-0.5 text-[11px] text-slate-400">{org && org.status !== 'trialing' ? `${org.planName || 'Workspace'} plan` : 'Property sales workspace'}</p></div></div>
        <div className="flex items-center gap-2 sm:gap-3">{org?.status === 'trialing' && org?.subscription?.active !== false && <button type="button" onClick={() => orgRole === 'owner' && navigate('/billing')} title={orgRole === 'owner' ? 'Choose a plan' : 'Free trial'} className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 sm:inline-flex"><Clock size={13} />Trial: {org.subscription?.daysLeft ?? 0} {org.subscription?.daysLeft === 1 ? 'day' : 'days'} left{orgRole === 'owner' && <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white">Upgrade</span>}</button>}<button onClick={() => navigate('/whatsapp')} className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:inline-flex ${whatsappConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}><span className={`h-1.5 w-1.5 rounded-full ${whatsappConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />{whatsappConnected ? 'WhatsApp connected' : 'Connect WhatsApp'}</button><button onClick={() => navigate('/profile')} title={user?.name || 'Profile'} aria-label="Open profile" className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-left transition hover:bg-slate-50 dark:border-ink-700 dark:hover:bg-ink-800"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-brand-900 dark:text-brand-200">{user?.name?.[0]?.toUpperCase() || 'U'}</span><span className="hidden md:block"><span className="block text-xs font-semibold capitalize text-slate-700 dark:text-ink-200">{user?.name?.split(' ')?.[0] || orgRole}</span><span className="block text-[10px] capitalize text-slate-400">{orgRole}</span></span></button></div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 xl:p-7">
        {org && orgRole === 'owner' && !(org.whatsapp?.status === 'connected' && org.whatsapp?.phoneNumberId) && !['/get-started', '/whatsapp'].includes(location.pathname) && (
          <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold">Complete setup: connect WhatsApp first</p><p className="mt-0.5 text-xs sm:text-sm">Your leads, property inventory and first-message onboarding steps unlock after WhatsApp is connected.</p></div>
            <Link to="/whatsapp" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white no-underline transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950">Continue setup <span aria-hidden="true">→</span></Link>
          </div>
        )}
        <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
      </main>
    </div>
    <Toaster />
  </div>;
}
