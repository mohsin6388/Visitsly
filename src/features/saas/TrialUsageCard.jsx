import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';
import { UsageMeters } from './BillingPage.jsx';

/** Dashboard card: what's left of the free trial (contacts, bulk messages, AI conversations). */
export default function TrialUsageCard() {
  const org = useAuthStore((s) => s.org);
  const role = useOrgRole();
  if (!org || org.status !== 'trialing') return null;
  const days = org.subscription?.daysLeft ?? 0;
  return (
    <section className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-emerald-50 p-4 shadow-card dark:border-sky-900 dark:from-sky-950/30 dark:to-emerald-950/20 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><Gift size={18} className="text-sky-600" /> Free trial — {days} {days === 1 ? 'day' : 'days'} left</h2>
        {role === 'owner' && <Link to="/billing" className="btn-primary !py-1.5 text-xs">Choose a plan</Link>}
      </div>
      <div className="mt-4 grid gap-4">
        <UsageMeters org={org} compact />
      </div>
    </section>
  );
}
