import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CalendarCheck, Clock, Zap, BadgeCheck, PhoneCall, RotateCcw, Home, Maximize2, CheckCircle2 } from 'lucide-react';
import { orgApi, growthApi, voiceApi } from '../../api/saasApi.js';
import { followUpApi } from '../../api/followUpApi.js';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';
import { errText } from '../../lib/saas.jsx';
import { toast, showDialog, Modal } from '../../components/ui/index.jsx';

export const HOT_SCORE = 60;
export const LEAD_SCORE = 30;

/** One simple label per chat: Visit / Hot / Warm / New. */
export function leadTypeOf(lead = {}, score = 0, meetings = []) {
  if (lead.status === 'closed') return { label: 'Closed', className: 'bg-slate-200 text-slate-700 dark:bg-ink-700 dark:text-ink-200' };
  if (lead.status === 'lost') return { label: 'Lost', className: 'bg-slate-200 text-slate-600 dark:bg-ink-700 dark:text-ink-300' };
  if (lead.status === 'site_visit' || meetings.length) return { label: 'Site visit', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' };
  if (lead.status === 'hot' || score > HOT_SCORE) return { label: 'Hot', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  if (lead.status === 'warm' || score > LEAD_SCORE) return { label: 'Warm', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  return { label: 'New', className: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300' };
}

export function money(value) {
  const n = Number(value);
  if (!n) return null;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 ? 2 : 0)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/** "Today", "Tomorrow", "In 2 days" or "Mon, 18 Nov" — relative to today. */
export function friendlyDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  if (diff === -1) return 'Yesterday';
  if (diff < -1) return `${Math.abs(diff)} days ago`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function LeadActions({ lead, conversation }) {
  const role = useOrgRole();
  const org = useAuthStore((s) => s.org);
  const isManager = role === 'owner' || role === 'manager';
  const [team, setTeam] = useState([]);
  const [assigned, setAssigned] = useState(lead.assignedTo ? String(lead.assignedTo) : '');
  const [booked, setBooked] = useState(Boolean(lead.bookedAt));
  const [busy, setBusy] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setAssigned(lead.assignedTo ? String(lead.assignedTo) : '');
    setBooked(Boolean(lead.bookedAt));
  }, [lead._id, lead.assignedTo, lead.bookedAt]);
  useEffect(() => {
    if (isManager) orgApi.team().then((r) => setTeam(r.data.items.filter((m) => m.isActive))).catch(() => {});
  }, [isManager]);

  const act = async (key, fn, okText) => {
    setBusy(key);
    try {
      const res = await fn();
      toast.success(okText || res?.message || 'Done');
    } catch (err) {
      showDialog({ title: 'Could not complete this', message: errText(err) });
    } finally {
      setBusy('');
    }
  };
  if (!lead?._id) return null;
  const voiceOn = Boolean(org?.voice?.enabled);

  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500"><Zap size={13} /> Quick actions</p>
      {isManager && team.length > 0 && (
        <label className="block text-xs text-ink-500">
          Assign to
          <select className="input-field mt-1 !py-1.5" value={assigned} onChange={(e) => { const v = e.target.value; setAssigned(v); act('assign', () => growthApi.assign([lead._id], v || null), 'Lead assigned'); }}>
            <option value="">— Unassigned —</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        {voiceOn && (
          <button type="button" className="btn-secondary gap-1.5 !px-2 !py-1.5 text-xs" disabled={!!busy} onClick={() => act('call', () => voiceApi.call(lead._id), 'AI call started')}>
            <PhoneCall size={13} /> AI call
          </button>
        )}
        <button
          type="button"
          className="btn-secondary gap-1.5 !px-2 !py-1.5 text-xs"
          disabled={!!busy || conversation?.optedOut}
          title={conversation?.optedOut ? 'Customer opted out (STOP)' : 'Send a follow-up tomorrow'}
          onClick={() => {
            const date = new Date(Date.now() + 86400000);
            date.setHours(11, 0, 0, 0);
            act('fu', () => followUpApi.createForLead(lead._id, { date: date.toISOString() }), 'Follow-up set for tomorrow 11 AM');
          }}
        >
          <RotateCcw size={13} /> Follow-up tomorrow
        </button>
        {isManager && (booked ? (
          <button type="button" className="btn-secondary gap-1.5 !px-2 !py-1.5 text-xs text-green-700" disabled={!!busy} onClick={() => act('book', async () => { const r = await growthApi.markBooked(lead._id, { undo: true }); setBooked(false); return r; })}>
            <BadgeCheck size={13} /> Booked ✓
          </button>
        ) : (
          <button type="button" className="btn-secondary gap-1.5 !px-2 !py-1.5 text-xs" disabled={!!busy} onClick={() => {
            const v = window.prompt('Deal value (₹) — for reports', '');
            if (v === null) return;
            act('book', async () => { const r = await growthApi.markBooked(lead._id, { dealValue: Number(String(v).replace(/[^\d]/g, '')) || undefined }); setBooked(true); return r; }, 'Marked as booked 🎉');
          }}>
            <BadgeCheck size={13} /> Mark booked
          </button>
        ))}
        <button type="button" className="btn-secondary gap-1.5 !px-2 !py-1.5 text-xs" onClick={() => navigate('/site-visits')}>
          <CalendarCheck size={13} /> Site visits
        </button>
      </div>
    </div>
  );
}

function daysUntil(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((day(d) - day(new Date())) / 86400000);
}

function visitStatus(m) {
  const st = m.confirmation?.status;
  if (st === 'confirmed') return 'Confirmed';
  if (st === 'declined') return 'Not coming';
  if (st === 'pending') return 'Awaiting confirmation';
  return String(m.status || '').replaceAll('_', ' ');
}

export default function InsightsPanel({ active, className = '' }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const conversation = active.conversation;
  const lead = conversation.leadId || {};
  const insights = active.insights || {};
  const meetings = insights.meetings || [];
  const req = conversation.collectedRequirements || {};
  const score = Number(lead.leadScore ?? conversation.currentLeadScore ?? 0);
  const type = leadTypeOf(lead, score, meetings);
  const budget = [money(req.budgetMin), money(req.budgetMax)].filter(Boolean);
  const requirement = [req.bhk && `${String(req.bhk).replace(/\s*bhk/i, '')} BHK`, req.propertyType, req.location || req.city || lead.city, budget.length === 2 && budget[0] !== budget[1] ? `${budget[0]}–${budget[1]}` : budget[0]]
    .filter(Boolean)
    .join(' · ');
  const [summaryLine, ...rest] = String(conversation.aiSummary || '').split('\n');
  const reqFromSummary = rest.find((l) => /^Requirement:/i.test(l))?.replace(/^Requirement:\s*/i, '');
  const scoreTone = score > HOT_SCORE ? 'bg-red-500' : score > LEAD_SCORE ? 'bg-amber-500' : 'bg-ink-300';
  const scoreText = score > HOT_SCORE ? 'text-red-600' : score > LEAD_SCORE ? 'text-amber-600' : 'text-ink-700 dark:text-ink-200';
  const fu = insights.followUp;
  const visit = meetings[0];
  const fuDays = fu ? daysUntil(fu.nextFollowUpDate) : null;

  return (
    <aside className={`flex w-full flex-shrink-0 flex-col gap-3 overflow-y-auto xl:w-72 ${className}`}>
      {/* Score */}
      <div className="rounded-xl border border-ink-100 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Lead score</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${type.className}`}>{type.label}</span>
        </div>
        <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${scoreText}`}>{score}<span className="text-sm font-medium text-ink-400">/100</span></p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"><div className={`h-full rounded-full ${scoreTone}`} style={{ width: `${Math.max(3, score)}%` }} /></div>
      </div>

      {/* Chat summary */}
      <div className="rounded-xl border border-ink-100 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300"><Sparkles size={13} /> Chat summary</p>
          <button type="button" onClick={() => setMoreOpen(true)} title="Full summary & requirement" aria-label="Open full summary" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-700 dark:hover:bg-ink-800"><Maximize2 size={14} /></button>
        </div>
        <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-ink-700 dark:text-ink-200">{summaryLine || 'Summary appears after the customer replies.'}</p>
        {(requirement || reqFromSummary) && <p className="mt-2 line-clamp-2 text-xs font-medium text-ink-500 dark:text-ink-400"><Home size={11} className="mr-1 inline" />{requirement || reqFromSummary}</p>}
        <button type="button" onClick={() => setMoreOpen(true)} className="mt-2 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">View details</button>
      </div>

      {/* Visit booked or next follow-up */}
      {visit ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-900/20">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300"><CheckCircle2 size={13} /> Site visit booked</p>
          <p className="mt-1 text-sm font-semibold text-teal-900 dark:text-teal-100">{friendlyDate(`${visit.preferredDate}T${visit.preferredTime || '11:00'}:00`)} · {visit.preferredTime}</p>
          <p className="text-xs text-teal-800 dark:text-teal-200">{visit.propertyId?.projectName || 'Project not set'} · {visitStatus(visit)}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-ink-100 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500"><Clock size={13} /> Follow-up</p>
          {fu ? (
            <p className="mt-1 text-sm font-semibold text-ink-800 dark:text-ink-100">
              {fuDays <= 0 ? 'Due today' : fuDays === 1 ? 'In 1 day' : `In ${fuDays} days`}
              <span className="ml-1 font-normal text-ink-400">· {new Date(fu.nextFollowUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </p>
          ) : <p className="mt-1 text-sm text-ink-400">No follow-up scheduled</p>}
        </div>
      )}

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={lead.name || lead.phone || 'Lead details'} size="max-w-md">
        <div className="space-y-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300"><Sparkles size={13} /> Summary</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-700 dark:text-ink-200">{conversation.aiSummary || 'Summary appears after the customer replies.'}</p>
          </div>
          {(requirement || reqFromSummary) && (
            <div className="rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/60">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500"><Home size={12} /> Requirement</p>
              <p className="mt-0.5 text-sm font-medium text-ink-800 dark:text-ink-100">{requirement || reqFromSummary}</p>
            </div>
          )}
          <dl className="space-y-1 text-sm">
            {[['Score', `${score}/100`], ['Mobile', lead.phone], ['Email', lead.email], ['Language', conversation.language]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-ink-500">{k}</dt><dd className="truncate text-right font-medium text-ink-800 dark:text-ink-100">{v}</dd></div>
            ))}
          </dl>
          {insights.latestScore?.reason && <p className="text-xs leading-5 text-ink-500 dark:text-ink-400">Why this score: {insights.latestScore.reason}</p>}
          {fu?.nextFollowUpMessage && <div><p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Next follow-up message</p><p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{fu.nextFollowUpMessage}</p></div>}
          {meetings.length > 1 && <div><p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">All visits</p>{meetings.map((m) => <p key={m._id} className="mt-1 text-sm text-ink-700 dark:text-ink-200">{friendlyDate(`${m.preferredDate}T${m.preferredTime || '11:00'}:00`)} · {m.preferredTime} · {visitStatus(m)}</p>)}</div>}
          <div className="border-t border-ink-100 pt-3 dark:border-ink-800"><LeadActions lead={lead} conversation={conversation} /></div>
        </div>
      </Modal>
    </aside>
  );
}
