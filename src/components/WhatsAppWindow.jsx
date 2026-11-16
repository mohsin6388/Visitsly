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
          <b>24 ghante ka WhatsApp window band hai.</b>{' '}
          {neverReplied ? 'Customer ne abhi tak reply nahi kiya' : 'Customer ne 24 ghante se reply nahi kiya'} — isliye seedha message nahi ja sakta. Pehle ek approved template bhejein; customer reply karega to chat khul jayegi.
        </span>
      </p>
      <button type="button" onClick={onTemplate} className="btn-primary flex items-center gap-1.5 whitespace-nowrap !py-2 text-xs">
        <Send size={13} /> Template bhejein
      </button>
    </div>
  );
}

/** Small "window open for X h" hint above the message box. */
export function WindowOpenHint({ lastInboundAt }) {
  const hours = windowHoursLeft(lastInboundAt);
  if (!hours || hours > 24) return null;
  const label = hours >= 1 ? `${Math.floor(hours)} ghante` : `${Math.max(1, Math.round(hours * 60))} minute`;
  return (
    <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-ink-400">
      <Clock size={11} /> Chat window abhi {label} aur khuli hai
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
      lockLabel={<>Sirf <b>{leadName || 'ye contact'}</b> ko template jayega.</>}
      defaultMode="now"
      zIndex={80}
      initialName={`${leadName || 'Contact'} · Template`.slice(0, 120)}
      onClose={onClose}
      onLaunched={(data) => { onSent?.(data); }}
    />
  );
}
