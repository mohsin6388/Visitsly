import { Lock, Send, Clock } from 'lucide-react';
import CampaignLauncher from '../features/outreach/CampaignLauncher.jsx';

/** Hours of the 24h WhatsApp window left (0 when closed). */
export function windowHoursLeft(lastInboundAt) {
  const t = lastInboundAt ? new Date(lastInboundAt).getTime() : 0;
  if (!t) return 0;
  const left = 24 * 3600 * 1000 - (Date.now() - t);
  return left > 0 ? left / 3600000 : 0;
}

/**
 * Shown in place of the message box when the customer's 24-hour window is closed.
 * WhatsApp only allows an approved template until the customer replies again.
 */
export function WindowClosedBar({ neverReplied = false, onTemplate, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-amber-50/70 px-4 py-3 text-sm dark:border-ink-800 dark:bg-amber-900/10 ${className}`}>
      <p className="flex min-w-0 flex-1 items-start gap-2 text-ink-700 dark:text-ink-200">
        <Lock size={15} className="mt-0.5 shrink-0 text-amber-600" />
        <span>
          <b>WhatsApp 24-hour window is closed.</b>{' '}
          {neverReplied ? 'The customer hasn’t replied yet' : 'No reply in the last 24 hours'} — send an approved template; the chat reopens when they reply.
        </span>
      </p>
      <button type="button" onClick={onTemplate} className="btn-primary flex items-center gap-1.5 whitespace-nowrap !py-2 text-xs">
        <Send size={13} /> Send template
      </button>
    </div>
  );
}

/** Small "window open for X h" hint above the message box. */
export function WindowOpenHint({ lastInboundAt }) {
  const hours = windowHoursLeft(lastInboundAt);
  if (!hours || hours > 24) return null;
  const label = hours >= 1 ? `${Math.floor(hours)} h` : `${Math.max(1, Math.round(hours * 60))} min`;
  return (
    <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-ink-400">
      <Clock size={11} /> Chat window open for {label} more
    </p>
  );
}

/** Pick an approved template and send it now or schedule it, for this one contact. */
export function TemplateSendModal({ leadId, leadName, onClose, onSent }) {
  return (
    <CampaignLauncher
      channel="whatsapp"
      initialLeadIds={[String(leadId)]}
      lockSelection
      lockLabel={<>Template goes only to <b>{leadName || 'this contact'}</b>.</>}
      defaultMode="now"
      zIndex={80}
      initialName={`${leadName || 'Contact'} · Template`.slice(0, 120)}
      onClose={onClose}
      onLaunched={(data) => { onSent?.(data); }}
    />
  );
}
