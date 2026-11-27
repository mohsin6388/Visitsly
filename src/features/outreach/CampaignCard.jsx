import { Pause, Play, Ban, RotateCcw, CalendarClock, Trash2 } from 'lucide-react';
import { fmtDateTime } from './StatusChip.jsx';

export const DISPLAY_STATUS = {
  running: { label: 'Running', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  scheduled: { label: 'Scheduled', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  active: { label: 'Running', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  paused: { label: 'Paused', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completed: { label: 'Completed', className: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' },
  cancelled: { label: 'Cancelled', className: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400' },
};

const num = (v) => Number(v || 0).toLocaleString('en-IN');

function IconBtn({ title, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${danger ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800'}`}
    >
      {children}
    </button>
  );
}

/** Compact campaign tile: total · sent · failed, plus quick actions. */
export default function CampaignCard({ campaign, channel, selected, onSelect, onAction, busy }) {
  const c = campaign;
  const s = c.stats?.[channel] || { total: 0, sent: 0, failed: 0, pending: 0, paused: 0, processing: 0 };
  const pending = Math.max(0, (s.pending || 0) + (s.paused || 0) + (s.processing || 0));
  const canPause = c.status === 'active';
  const canResume = c.status === 'paused';
  const canCancel = c.status === 'active' || c.status === 'paused';
  // Finished / cancelled campaigns can be deleted (history only; contacts stay).
  const canDelete = !canCancel;
  const status = DISPLAY_STATUS[c.displayStatus || c.status] || DISPLAY_STATUS.active;
  const startsAt = c.startsAt ? new Date(c.startsAt) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect())}
      className={`cursor-pointer rounded-xl border p-3.5 transition ${selected ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/15 dark:bg-brand-950/30' : 'border-ink-100 bg-white hover:border-ink-300 hover:shadow-sm dark:border-ink-800 dark:bg-ink-900'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-ink-900 dark:text-white" title={c.name}>{c.name}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
      </div>
      {startsAt && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
          <CalendarClock size={11} /> {fmtDateTime(startsAt)}{c.totalDays > 1 ? ` · ${num(c.dailyLimit)}/day · ${c.totalDays} days` : ''}{c.notScheduled > 0 ? ` · ${num(c.notScheduled)} not scheduled` : ''}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-ink-50 py-1.5 dark:bg-ink-800/60"><p className="text-[10px] text-ink-500">Total</p><p className="text-sm font-bold tabular-nums text-ink-900 dark:text-white">{num(s.total)}</p></div>
        <div className="rounded-lg bg-green-50 py-1.5 dark:bg-green-900/20"><p className="text-[10px] text-green-700 dark:text-green-300">Sent</p><p className="text-sm font-bold tabular-nums text-green-700 dark:text-green-300">{num(s.sent)}</p></div>
        <div className="rounded-lg bg-red-50 py-1.5 dark:bg-red-900/20"><p className="text-[10px] text-red-600 dark:text-red-300">Failed</p><p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-300">{num(s.failed)}</p></div>
      </div>
      {pending > 0 && <p className="mt-1.5 text-[11px] text-ink-400">{num(pending)} pending</p>}
      {channel === 'email' && c.leadsWithoutEmail > 0 && <p className="mt-1 text-[11px] text-ink-400">{num(c.leadsWithoutEmail)} without email</p>}

      {(canPause || canResume || s.failed > 0 || canCancel || canDelete) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {canPause && <IconBtn title="Pause" disabled={busy} onClick={() => onAction('pause', c)}><Pause size={12} /> Pause</IconBtn>}
          {canResume && <IconBtn title="Resume" disabled={busy} onClick={() => onAction('resume', c)}><Play size={12} /> Resume</IconBtn>}
          {s.failed > 0 && <IconBtn title="Retry failed" disabled={busy} onClick={() => onAction('retry', c, channel)}><RotateCcw size={12} /> Retry {num(s.failed)}</IconBtn>}
          {canCancel && <IconBtn title="Cancel campaign" danger disabled={busy} onClick={() => onAction('cancel', c)}><Ban size={12} /> Cancel</IconBtn>}
          {canDelete && <IconBtn title="Delete campaign" danger disabled={busy} onClick={() => onAction('delete', c)}><Trash2 size={12} /> Delete</IconBtn>}
        </div>
      )}
    </div>
  );
}
