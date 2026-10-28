import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Eye, X } from 'lucide-react';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';
import { hardNavigate } from '../../lib/saas.jsx';

/**
 * Top-of-app banners: trial days left, trial over / payment due (read-only),
 * plan limit reached, and Visitsly support mode.
 */
export default function SubscriptionBanner() {
  const org = useAuthStore((s) => s.org);
  const support = useAuthStore((s) => s.support);
  const clearSession = useAuthStore((s) => s.clearSession);
  const role = useOrgRole();
  const [limitMsg, setLimitMsg] = useState(null);

  useEffect(() => {
    const onBilling = (e) => setLimitMsg(e.detail);
    window.addEventListener('propai:billing', onBilling);
    return () => window.removeEventListener('propai:billing', onBilling);
  }, []);

  const exitSupport = () => {
    clearSession();
    window.close();
    hardNavigate('/login');
  };

  const user = useAuthStore((s) => s.user);
  const banners = [];
  if (user?.mustChangePassword && !support) {
    banners.push(
      <div key="pw" className="flex flex-wrap items-center justify-between gap-2 bg-sky-700 px-4 py-2 text-sm text-white">
        <span>Aap temporary password se login hain. Apna password badal lijiye.</span>
        <Link to="/profile" className="rounded-md bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">Password badlein</Link>
      </div>,
    );
  }
  if (support) {
    banners.push(
      <div key="imp" className="flex flex-wrap items-center justify-between gap-2 bg-violet-700 px-4 py-2 text-sm text-white">
        <span className="flex items-center gap-2"><Eye size={16} /> Visitsly support mode: <strong>{support.orgName || org?.name}</strong> ka account (60 min). Har change unke data mein hoga.</span>
        <button onClick={exitSupport} className="rounded-md bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">Exit</button>
      </div>,
    );
  }
  const sub = org?.subscription;
  const billingLink = role === 'owner' ? <Link to="/billing" className="rounded-md bg-white/20 px-3 py-1 font-semibold hover:bg-white/30">Plan choose karein</Link> : <span className="text-xs opacity-90">Company owner se kahiye</span>;
  if (sub && !sub.active) {
    banners.push(
      <div key="inactive" className="flex flex-wrap items-center justify-between gap-2 bg-red-600 px-4 py-2 text-sm text-white">
        <span className="flex items-center gap-2"><AlertTriangle size={16} /> {sub.reason} Abhi aap sirf data dekh aur export kar sakte hain.</span>
        {billingLink}
      </div>,
    );
  } else if (org?.status === 'trialing' && sub?.daysLeft <= 7) {
    banners.push(
      <div key="trial" className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-amber-950">
        <span className="flex items-center gap-2"><Clock size={16} /> Free trial ke {sub.daysLeft} din baaki hain.</span>
        {role === 'owner' && <Link to="/billing" className="rounded-md bg-amber-950/10 px-3 py-1 font-semibold hover:bg-amber-950/20">Plan choose karein</Link>}
      </div>,
    );
  } else if (org?.status === 'past_due') {
    banners.push(
      <div key="due" className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-amber-950">
        <span className="flex items-center gap-2"><AlertTriangle size={16} /> Pichhla payment fail hua. {sub?.daysLeft} din mein update karein, warna account read-only ho jayega.</span>
        {role === 'owner' && <Link to="/billing" className="rounded-md bg-amber-950/10 px-3 py-1 font-semibold hover:bg-amber-950/20">Billing</Link>}
      </div>,
    );
  }
  if (limitMsg?.code === 'PLAN_LIMIT') {
    banners.push(
      <div key="limit" className="flex flex-wrap items-center justify-between gap-2 bg-ink-900 px-4 py-2 text-sm text-white">
        <span className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-400" /> {limitMsg.message}</span>
        <span className="flex items-center gap-2">{role === 'owner' && <Link to="/billing" onClick={() => setLimitMsg(null)} className="rounded-md bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">Upgrade</Link>}<button onClick={() => setLimitMsg(null)} aria-label="Dismiss"><X size={16} /></button></span>
      </div>,
    );
  }
  if (!banners.length) return null;
  return <div className="flex-shrink-0">{banners}</div>;
}
