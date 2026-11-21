import { Link } from 'react-router-dom';
import { Lock, Sparkles, Check } from 'lucide-react';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';

/** Which plan first includes each feature (mirrors backend config/plans.js). */
export const FEATURE_PLAN = {
  bulkWhatsapp: 'Starter',
  emailCampaigns: 'Growth',
  teamRouting: 'Growth',
  autoFollowUps: 'Starter',
  inventory: 'Builder Pro',
  multiProjectBot: 'Builder Pro',
  metaLeadAds: 'Builder Pro',
  weeklyReports: 'Builder Pro',
  aiCalling: 'Starter',
};

/** true when the current company's plan includes the feature (unknown = allowed). */
export function useFeature(feature) {
  const org = useAuthStore((s) => s.org);
  const support = useAuthStore((s) => s.support);
  if (!org || !org.features) return true;
  if (support && org.features[feature] === undefined) return true;
  return org.features[feature] !== false;
}

/**
 * Upgrade prompt for a feature the plan doesn't include. Shown instead of
 * hiding the feature, so users see what they'd get.
 */
export default function UpgradeCard({ feature, title, body, points = [] }) {
  const org = useAuthStore((s) => s.org);
  const role = useOrgRole();
  const trial = org?.status === 'trialing';
  const plan = FEATURE_PLAN[feature];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 shadow-card dark:border-amber-900/50 dark:from-amber-950/30 dark:via-ink-900 dark:to-emerald-950/20 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"><Lock size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            {trial ? 'Not included in the free trial' : `Not included in your ${org?.planName || ''} plan`}
          </p>
          <h2 className="mt-1 font-display text-lg font-bold text-ink-900 dark:text-white">{title}</h2>
          {body && <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-300">{body}</p>}
          {points.length > 0 && (
            <ul className="mt-3 grid gap-1.5 text-sm text-ink-700 dark:text-ink-200 sm:grid-cols-2">
              {points.map((p) => <li key={p} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />{p}</li>)}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {role === 'owner' ? (
              <Link to="/billing" className="btn-primary gap-2"><Sparkles size={16} /> {plan ? `Upgrade to ${plan}` : 'See plans'}</Link>
            ) : (
              <span className="text-sm text-ink-500">Ask your account owner to upgrade{plan ? ` to ${plan}` : ''}.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Route wrapper: renders the page, or an upgrade card when the plan lacks the feature. */
export function FeatureGate({ feature, title, body, points, children }) {
  const allowed = useFeature(feature);
  if (allowed) return children;
  return (
    <div className="mx-auto max-w-3xl py-2">
      <UpgradeCard feature={feature} title={title} body={body} points={points} />
    </div>
  );
}
