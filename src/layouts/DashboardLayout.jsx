import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, CalendarCheck, Clock, Settings as SettingsIcon,
  UserCircle, LogOut, Moon, Sun, Menu, Mail, MessageCircle, Loader2, ChevronDown,
  MessageSquare, Flame, Smartphone, PanelLeftClose, PanelLeftOpen, FileText,
  Briefcase, CreditCard, UsersRound, Rocket, Link2, TrendingUp, BarChart3, Shuffle, FileSpreadsheet, Handshake, PhoneCall,
} from 'lucide-react';
import { useAuthStore, useOrgRole } from '../store/authStore.js';
import { orgApi } from '../api/saasApi.js';
import SubscriptionBanner from '../features/saas/SubscriptionBanner.jsx';
import { authApi } from '../api/authApi.js';
import { useOutreachSummaryLive } from '../hooks/useOutreachLive.js';

const NAV_GROUPS = [
  { type: 'link', to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { type: 'link', to: '/leads', label: 'All leads', icon: Users },
  { type: 'link', to: '/qualified-leads', label: 'Qualified leads', icon: Flame },
  {
    type: 'group', key: 'whatsapp', label: 'WhatsApp AI', icon: MessageCircle, children: [
      { to: '/whatsapp', label: 'Connect number', icon: Smartphone },
      { to: '/whatsapp/conversations', label: 'AI inbox', icon: MessageSquare },
      { to: '/outreach/whatsapp', label: 'Campaigns', icon: Rocket, channel: 'whatsapp', roles: ['owner', 'manager'] },
      { to: '/whatsapp/leads', label: 'WhatsApp leads', icon: Flame },
      { to: '/whatsapp/templates', label: 'Templates', icon: FileText, roles: ['owner', 'manager'] },
    ],
  },
  {
    type: 'group', key: 'email', label: 'Email automation', icon: Mail, children: [
      { to: '/email/conversations', label: 'Inbox & replies', icon: MessageSquare },
      { to: '/outreach/email', label: 'Campaigns', icon: Mail, channel: 'email', roles: ['owner', 'manager'] },
      { to: '/email/leads', label: 'Email leads', icon: Flame },
      { to: '/email/templates', label: 'Templates', icon: FileText, roles: ['owner', 'manager'] },
      { to: '/email/details', label: 'Delivery details', icon: PanelLeftOpen },
    ],
  },
  { type: 'link', to: '/properties', label: 'Properties', icon: Building2 },
  { type: 'link', to: '/site-visits', label: 'Site visits', icon: CalendarCheck },
  { type: 'link', to: '/follow-ups', label: 'Follow-ups', icon: Clock },
  {
    type: 'group', key: 'growth', label: 'Growth tools', icon: TrendingUp, children: [
      { to: '/reports', label: 'Reports & analytics', icon: BarChart3, roles: ['owner', 'manager'] },
      { to: '/lead-sources', label: 'Lead sources', icon: Link2, roles: ['owner', 'manager'] },
      { to: '/routing', label: 'Lead routing', icon: Shuffle, roles: ['owner', 'manager'] },
      { to: '/quotes', label: 'Cost sheets', icon: FileSpreadsheet },
      { to: '/channel-partners', label: 'Channel partners', icon: Handshake, roles: ['owner', 'manager'] },
      { to: '/ai-calling', label: 'AI calling', icon: PhoneCall, roles: ['owner', 'manager'] },
    ],
  },
  {
    type: 'group', key: 'company', label: 'Workspace & billing', icon: Briefcase, children: [
      { to: '/get-started', label: 'Setup checklist', icon: Rocket },
      { to: '/team', label: 'Team & members', icon: UsersRound, roles: ['owner', 'manager'] },
      { to: '/billing', label: 'Plan & billing', icon: CreditCard, roles: ['owner'] },
    ],
  },
  {
    type: 'group', key: 'account', label: 'Settings', icon: SettingsIcon, children: [
      { to: '/profile', label: 'My profile', icon: UserCircle },
      { to: '/settings', label: 'AI & business settings', icon: SettingsIcon, roles: ['owner', 'manager'] },
    ],
  },
];

const GROUP_KEYS = { whatsapp: false, email: false, growth: false, company: false, account: false };
const GROWTH_PATHS = ['/reports', '/lead-sources', '/routing', '/quotes', '/channel-partners', '/ai-calling'];

function OutreachBadge({ stats }) {
  if (!stats || !stats.total) return null;
  const done = stats.sent === stats.total;
  return <span className="ml-auto flex items-center gap-1.5">{stats.processing > 0 && <Loader2 size={12} className="animate-spin" />}<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${done ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-ink-200'}`} title={`${stats.sent} sent, ${stats.pending + stats.paused} pending, ${stats.failed} failed`}>{stats.sent}/{stats.total}</span></span>;
}

export default function DashboardLayout() {
  const { data: outreach } = useOutreachSummaryLive();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [expanded, setExpanded] = useState(() => {
    const path = window.location.pathname;
    return { whatsapp: path.startsWith('/whatsapp') || path === '/outreach/whatsapp', email: path.startsWith('/email') || path === '/outreach/email', growth: GROWTH_PATHS.includes(path), company: ['/get-started', '/team', '/billing'].includes(path), account: ['/profile', '/settings'].includes(path) };
  });
  const { user, clearSession, org, setOrg, support } = useAuthStore();
  const orgRole = useOrgRole();
  const brandName = org?.branding?.productName || org?.name || 'Visitsly';
  const brandLogo = org?.branding?.logoUrl || '';

  // Keep plan, usage and subscription status fresh (banner + limits).
  useEffect(() => {
    const load = () => orgApi.get().then((r) => setOrg(r.data.org)).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [setOrg]);
  const navigate = useNavigate();
  const location = useLocation();
  const whatsappConnected = org?.whatsapp?.status === 'connected' && Boolean(org?.whatsapp?.phoneNumberId);
  // New workspaces complete WhatsApp setup before accessing the rest of the
  // operational onboarding routes. Settings/billing/profile and WhatsApp setup
  // stay accessible so Meta failures never trap the user without a recovery path.
  const routesAvailableBeforeWhatsApp = ['/get-started', '/whatsapp', '/profile', '/settings', '/billing', '/team'];
  const canAccessBeforeWhatsApp = routesAvailableBeforeWhatsApp.includes(location.pathname);
  if (org && !support && !whatsappConnected && !canAccessBeforeWhatsApp) {
    return <Navigate to="/get-started" replace state={{ onboardingRequired: true }} />;
  }

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode((value) => !value);
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } finally { clearSession(); navigate('/login'); }
  };

  const linkClass = (active) => `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${active ? 'bg-emerald-500 text-white shadow-[0_8px_18px_rgba(16,185,129,0.20)]' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`;

  const allowed = (entry) => !entry.roles || entry.roles.includes(orgRole);
  const navItems = NAV_GROUPS
    .map((g) => (g.type === 'group' ? { ...g, children: g.children.filter(allowed) } : g))
    .filter((g) => g.type === 'link' || g.children.length);

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
      <button type="button" onClick={() => setExpanded((previous) => previous[item.key] ? { ...GROUP_KEYS } : { ...GROUP_KEYS, [item.key]: true })} className={linkClass(active)} title={sidebarCollapsed ? item.label : undefined} aria-expanded={Boolean(isOpen)}>
        <Icon size={18} className="shrink-0" />{!sidebarCollapsed && <><span className="flex-1">{item.label}</span><ChevronDown size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /></>}
      </button>
      {isOpen && !sidebarCollapsed && <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
        {item.children.map((child) => {
          const ChildIcon = child.icon;
          return <NavLink key={child.to} to={child.to} end={child.to === '/whatsapp'} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${isActive ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-300/15' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'}`}>
            <ChildIcon size={15} className="shrink-0" /><span className="flex-1">{child.label}</span>{child.channel && <OutreachBadge stats={outreach?.[child.channel]} />}
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
      <header className="flex h-[72px] flex-shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur dark:border-ink-800 dark:bg-ink-900 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><button className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21} /></button><div className="min-w-0"><p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">{brandName}</p><p className="mt-0.5 text-[11px] text-slate-400">{org ? (org.status === 'trialing' ? `Free trial · ${org.subscription?.daysLeft ?? ''} days left` : `${org.planName || 'Workspace'} plan`) : 'Property sales workspace'}</p></div></div>
        <div className="flex items-center gap-2 sm:gap-3"><button onClick={() => navigate('/whatsapp')} className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:inline-flex ${whatsappConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}><span className={`h-1.5 w-1.5 rounded-full ${whatsappConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />{whatsappConnected ? 'WhatsApp connected' : 'Connect WhatsApp'}</button><button onClick={toggleDarkMode} aria-label="Toggle dark mode" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button onClick={() => navigate('/profile')} title={user?.name || 'Profile'} aria-label="Open profile" className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-left transition hover:bg-slate-50 dark:border-ink-700 dark:hover:bg-ink-800"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-brand-900 dark:text-brand-200">{user?.name?.[0]?.toUpperCase() || 'U'}</span><span className="hidden md:block"><span className="block text-xs font-semibold capitalize text-slate-700 dark:text-ink-200">{user?.name?.split(' ')?.[0] || orgRole}</span><span className="block text-[10px] capitalize text-slate-400">{orgRole}</span></span></button></div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 xl:p-7">
        {org && !(org.whatsapp?.status === 'connected' && org.whatsapp?.phoneNumberId) && !['/get-started', '/whatsapp'].includes(location.pathname) && (
          <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold">Complete setup: connect WhatsApp first</p><p className="mt-0.5 text-xs sm:text-sm">Your leads, property inventory and first-message onboarding steps unlock after WhatsApp is connected.</p></div>
            <Link to="/get-started" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white no-underline transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950">Continue setup <span aria-hidden="true">→</span></Link>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  </div>;
}
