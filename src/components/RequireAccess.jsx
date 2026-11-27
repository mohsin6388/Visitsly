import { Link, Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useCan, useOrgRole, useAuthStore, teamAvailable } from '../store/authStore.js';

/** Where an agent lands first: the first page they are allowed to open. */
export function firstAllowedPath(can) {
  const order = [['dashboard', '/dashboard'], ['leads', '/leads'], ['inbox', '/whatsapp/conversations'], ['whatsappLeads', '/whatsapp/leads'], ['siteVisits', '/site-visits'], ['followUps', '/follow-ups'], ['properties', '/properties']];
  const hit = order.find(([key]) => can(key));
  return hit ? hit[1] : '/profile';
}

/**
 * Route guard. Direct URL access to a page the person may not open shows a "No access" screen
 * (the backend refuses the data as well — this is only the friendly front).
 *   <RequireAccess perm="leads">…</RequireAccess>          one permission
 *   <RequireAccess any={['leads','inbox']}>…</…>           any of them
 *   <RequireAccess ownerOnly>…</RequireAccess>             company owner only
 *   <RequireAccess ownerOnly teamPlan>…</RequireAccess>    owner, and a plan with a team (Growth+)
 */
export default function RequireAccess({ perm, any, ownerOnly = false, teamPlan = false, children }) {
  const can = useCan();
  const role = useOrgRole();
  const org = useAuthStore((s) => s.org);
  let ok = true;
  if (ownerOnly && role !== 'owner') ok = false;
  if (ok && perm && !can(perm)) ok = false;
  if (ok && any && !can.any(...any)) ok = false;
  if (ok && teamPlan && org && !teamAvailable(org)) ok = false;
  if (ok) return children;
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Lock size={22} /></span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">No access</h1>
      <p className="mt-1 text-sm text-slate-500">
        {teamPlan && role === 'owner' ? 'Team members are available on Growth and above.' : role === 'owner' ? 'This page is not available.' : 'You do not have access to this page. Ask your company owner to turn it on for you.'}
      </p>
      <Link to={role === 'owner' ? '/dashboard' : firstAllowedPath(can)} className="btn-secondary mt-5 inline-flex">Go to my home page</Link>
    </div>
  );
}

/** For `<Navigate>` redirects that depend on the person's permissions. */
export function HomeFor({ connected }) {
  const can = useCan();
  const role = useOrgRole();
  if (role !== 'owner') return <Navigate to={firstAllowedPath(can)} replace />;
  return <Navigate to={connected ? '/dashboard' : '/whatsapp'} replace />;
}
