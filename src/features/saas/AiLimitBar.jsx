import { Link } from 'react-router-dom';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';

/**
 * Shown in a chat when the AI has used up its replies for this contact
 * (free trial: 15 per contact). The AI has stopped; the user can reply by
 * hand or upgrade so the AI continues.
 */
export default function AiLimitBar({ aiLimit, onNavigate }) {
  const org = useAuthStore((s) => s.org);
  const role = useOrgRole();
  if (!aiLimit?.reached) return null;
  const trial = org?.status === 'trialing';
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
      <p className="flex min-w-0 flex-1 items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          <b>{trial ? 'Free trial limit reached' : 'AI reply limit reached'}:</b> the AI has replied {aiLimit.replies}/{aiLimit.limit} times to this contact and has stopped.{' '}
          {role === 'owner' ? 'Upgrade to keep the AI replying, or reply yourself.' : 'Reply yourself, or ask your account owner to upgrade.'}
        </span>
      </p>
      {role === 'owner' && (
        <Link to="/billing" onClick={onNavigate} className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap !py-1.5 text-xs"><Sparkles size={13} /> Upgrade</Link>
      )}
    </div>
  );
}
