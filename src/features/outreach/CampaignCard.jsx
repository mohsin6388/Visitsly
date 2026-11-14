import { Pause, Play, Ban, RotateCcw, CalendarClock, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { fmtDateTime } from './StatusChip.jsx';

export const DISPLAY_STATUS = {
  running: { label: 'Chal raha hai', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  scheduled: { label: 'Scheduled', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  active: { label: 'Chal raha hai', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  paused: { label: 'Paused', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completed: { label: 'Poora ho gaya', className: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' },
  cancelled: { label: 'Cancelled', className: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400' },
};

function ChannelBar({ label, s, color }) {
  const done = s.sent + s.failed + s.cancelled;
  const pct = s.total ? Math.round((done / s.total) * 100) : 0;
  const sentPct = s.total ? (s.sent / s.total) * 100 : 0;
  const failPct = s.total ? (s.failed / s.total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-ink-600 dark:text-ink-300">
        <span className="flex items-center gap-1 font-medium">{s.processing > 0 && <Loader2 size={11} className="animate-spin text-brand-600" />}{label}</span>
        <span>
          <b className="text-ink-900 dark:text-white">{s.sent.toLocaleString('en-IN')}</b>/{s.total.toLocaleString('en-IN')} gaye · {pct}%
          {s.failed > 0 && <span className="text-red-600"> · {s.failed} fail</span>}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div className={`${color} transition-all duration-500`} style={{ width: `${sentPct}%` }} />
        <div className="bg-red-500 transition-all duration-500" style={{ width: `${failPct}%` }} />
      </div>
    </div>
  );
}

/** channel = jis outreach page par card dikh raha hai */
export default function CampaignCard({ campaign, channel, selected, onSelect, onAction, busy }) {
  const c = campaign;
  const wa = c.stats.whatsapp;
  const em = c.stats.email;
  const failed = (c.channels.whatsapp ? wa.failed : 0) + (c.channels.email ? em.failed : 0);
  const canPause = c.status === 'active';
  const canResume = c.status === 'paused';
  const canCancel = c.status === 'active' || c.status === 'paused';
  const status = DISPLAY_STATUS[c.displayStatus || c.status] || DISPLAY_STATUS.active;
  const startsAt = c.startsAt ? new Date(c.startsAt) : null;
  const multiDay = c.totalDays > 1;

  return (
    <div className={`rounded-xl border p-4 transition ${selected ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/10 dark:bg-brand-950/30' : 'border-ink-100 bg-white hover:border-ink-200 dark:border-ink-800 dark:bg-ink-900'}`}>
      <button type="button" onClick={onSelect} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-ink-900 dark:text-white">{c.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
            <span>{c.totalLeads.toLocaleString('en-IN')} contacts</span>
            {startsAt && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock size={12} />
                {c.displayStatus === 'scheduled' ? 'Shuru hoga' : 'Shuru hua'}: <b className="text-ink-700 dark:text-ink-200">{fmtDateTime(startsAt)}</b>
              </span>
            )}
            {multiDay && <span>{c.dailyLimit.toLocaleString('en-IN')}/din · {c.totalDays} din</span>}
            {c.completedAt && <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> {fmtDateTime(c.completedAt)}</span>}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
          <ChevronRight size={16} className={`text-ink-300 transition ${selected ? 'rotate-90 text-brand-600' : ''}`} />
        </span>
      </button>

      <div className="mt-3 space-y-2.5">
        {c.channels.whatsapp && <ChannelBar label="WhatsApp" s={wa} color="bg-green-500" />}
        {c.channels.email && <ChannelBar label="Email" s={em} color="bg-brand-500" />}
        {c.channels.email && c.leadsWithoutEmail > 0 && <p className="text-xs text-ink-500 dark:text-ink-400">{c.leadsWithoutEmail} contacts ke paas email nahi tha.</p>}
      </div>

      {(canPause || canResume || failed > 0 || canCancel) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canPause && <button type="button" disabled={busy} onClick={() => onAction('pause', c)} className="btn-secondary !px-3 !py-1.5 !text-xs"><Pause size={13} className="mr-1.5" /> Pause</button>}
          {canResume && <button type="button" disabled={busy} onClick={() => onAction('resume', c)} className="btn-secondary !px-3 !py-1.5 !text-xs"><Play size={13} className="mr-1.5" /> Resume</button>}
          {failed > 0 && <button type="button" disabled={busy} onClick={() => onAction('retry', c, channel)} className="btn-secondary !px-3 !py-1.5 !text-xs"><RotateCcw size={13} className="mr-1.5" /> {failed} fail dobara bhejein</button>}
          {canCancel && <button type="button" disabled={busy} onClick={() => onAction('cancel', c)} className="btn-secondary !px-3 !py-1.5 !text-xs !text-red-600"><Ban size={13} className="mr-1.5" /> Cancel</button>}
        </div>
      )}
    </div>
  );
}
