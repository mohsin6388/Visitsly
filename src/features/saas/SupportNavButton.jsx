import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LifeBuoy } from 'lucide-react';
import { supportApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';

/** "Support" entry at the bottom of the sidebar, with a badge for unread replies. */
export default function SupportNavButton({ collapsed, onNavigate }) {
  const support = useAuthStore((s) => s.support);
  const { data } = useQuery({
    queryKey: ['support-unread'],
    queryFn: supportApi.unread,
    refetchInterval: 60_000,
    enabled: !support,
    retry: false,
  });
  const unread = data?.data?.unread || 0;
  return (
    <NavLink
      to="/help"
      onClick={onNavigate}
      title={collapsed ? 'Support' : undefined}
      className={({ isActive }) => `relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-emerald-400/10 text-emerald-200' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}
    >
      <LifeBuoy size={18} />
      {!collapsed && <span className="flex-1">Support & tickets</span>}
      {unread > 0 && (
        <span className={`rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white ${collapsed ? 'absolute right-1 top-1' : ''}`}>{unread}</span>
      )}
    </NavLink>
  );
}
