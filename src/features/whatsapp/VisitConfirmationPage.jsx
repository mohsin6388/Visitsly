import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Send, Phone, CheckCircle2, XCircle, Clock3, PhoneOff, PhoneCall, MessageCircle, ArrowRight, RefreshCw,
  Settings2, PhoneIncoming, HelpCircle, ChevronDown, FileText, Trash2, CalendarCheck, Users,
} from 'lucide-react';
import { settingsApi } from '../../api/settingsApi.js';
import { whatsappApi } from '../../api/whatsappApi.js';
import { meetingApi } from '../../api/meetingApi.js';
import { voiceApi } from '../../api/saasApi.js';
import UpgradeCard from '../saas/UpgradeCard.jsx';
import LeadCallingPanel from './LeadCallingPanel.jsx';
import { Toggle, errText, showUpgrade } from '../../lib/saas.jsx';
import { toast, showDialog, Skeleton, confirmDialog, ErrorInfo, Modal } from '../../components/ui/index.jsx';
import { getSocket } from '../../lib/socket.js';
import { useAuthStore } from '../../store/authStore.js';

const bodyOf = (t) => (t?.components || []).find((c) => String(c.type).toUpperCase() === 'BODY')?.text || t?.bodyText || '';
const varCount = (text) => Math.max(0, ...[...String(text).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
const CALL_FAIL = ['no-answer', 'busy', 'failed', 'canceled', 'cancelled', 'error', 'call-disconnected', 'stopped'];

const BADGE = {
  confirmed: ['Confirmed', 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', CheckCircle2],
  declined: ['Not coming', 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', XCircle],
  pending: ['Awaiting reply', 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', Clock3],
};
const CALL_BADGE = {
  answered: ['Answered', 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', PhoneIncoming],
  missed: ['Missed', 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', PhoneOff],
  in_progress: ['In progress', 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300', Phone],
};
const OUTCOME = {
  confirmed: ['Confirmed', 'text-green-700', CheckCircle2],
  declined: ['Not coming', 'text-red-600', XCircle],
  unclear: ['Unclear', 'text-amber-700', HelpCircle],
};
const RESULT = {
  reschedule: 'Rescheduled',
  follow_up: 'Follow up later',
  callback_later: 'Busy — WhatsApp sent',
  not_interested: 'Not interested',
};

const money = (v, currency = 'INR') => {
  if (v == null) return '—';
  try { return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v); } catch { return `${currency} ${v}`; }
};
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

function MiniStat({ label, value, hint }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[11px] font-medium text-ink-500">{label}</p>
      {value == null ? <Skeleton className="mt-1 h-6 w-10" /> : <p className="font-display text-xl font-bold tabular-nums text-ink-900 dark:text-white">{value}</p>}
      {hint && <p className="truncate text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

/** Collapsible settings: voice, pricing, usage, test call, timing and template. */
function SettingsPanel({ open, cfg, voice, aiOn, save, usable, pickTemplate, testPhone, setTestPhone, onTest, testing }) {
  if (!open) return null;
  const p = voice?.pricing;
  const sel = 'input-field mt-1 !py-2';
  return (
    <section className="card space-y-4 !p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/60"><p className="text-[11px] text-ink-500">Voice</p><p className="text-sm font-semibold text-ink-900 dark:text-white">{voice ? (voice.available ? voice.languageLabel : 'Coming soon') : '…'}</p></div>
        <div className="rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/60"><p className="text-[11px] text-ink-500">Price</p><p className="text-sm font-semibold text-ink-900 dark:text-white">{p ? `${money(p.perMinute, p.currency)}/min` : '…'}{p?.taxRate ? <span className="text-[11px] font-normal text-ink-400"> + {Math.round(p.taxRate * 100)}% tax</span> : null}</p></div>
        <div className="rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/60"><p className="text-[11px] text-ink-500">This month</p><p className="text-sm font-semibold text-ink-900 dark:text-white">{voice ? `${voice.minutesThisMonth || 0} min · ${money(voice.costThisMonth ?? 0, p?.currency)}` : '…'}</p>{voice?.planAllows && <p className="text-[11px] text-ink-400">{(voice.includedMinutes || 0) + (voice.prepaidMinutes || 0)} min included · extra minutes billed per minute</p>}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {aiOn ? <>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call after booking
            <select className={sel} value={cfg.callDelayMinutes ?? 1} onChange={(e) => save({ callDelayMinutes: Number(e.target.value) })}>{[1, 5, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m === 1 ? 'Instantly' : m < 60 ? `${m} min` : `${m / 60} hr`}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Retry if missed
            <select className={sel} value={cfg.callRetries ?? 0} onChange={(e) => save({ callRetries: Number(e.target.value) })}>{[0, 1, 2].map((m) => <option key={m} value={m}>{m === 0 ? 'No — send WhatsApp' : `${m}x (after 1 hr)`}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call from
            <select className={sel} value={cfg.callStartHour ?? 10} onChange={(e) => save({ callStartHour: Number(e.target.value) })}>{[8, 9, 10, 11, 12].map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call until
            <select className={sel} value={cfg.callEndHour ?? 19} onChange={(e) => save({ callEndHour: Number(e.target.value) })}>{[17, 18, 19, 20, 21].map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <Toggle checked={cfg.reminderCall !== false} onChange={(v) => save({ reminderCall: v })} label="Reminder call on the visit day" help="On the day of a confirmed visit, the AI calls to remind the customer (at least 1 hour before the visit, in calling hours)." />
          </div>
        </> : (
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">WhatsApp reminder before visit
            <select className={sel} value={cfg.hoursBefore} onChange={(e) => save({ hoursBefore: Number(e.target.value) })}>{[3, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} hours</option>)}</select>
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
        <label className="min-w-[240px] flex-1 text-xs font-semibold text-ink-600 dark:text-ink-300">WhatsApp template (outside 24h window)
          <select className={sel} value={cfg.templateName ? `${cfg.templateName}::${cfg.templateLanguage}` : ''} onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">None</option>
            {usable.map((t) => <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>{t.name} · {t.language}</option>)}
          </select>
        </label>
        <Link to="/whatsapp/templates" className="pb-2 text-xs font-semibold text-brand-600 hover:underline">New template</Link>
        {aiOn && voice?.available && <>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Test call
            <input className="input-field mt-1 !w-40 !py-2" inputMode="tel" placeholder="98XXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          </label>
          <button type="button" className="btn-secondary gap-2 !py-2 text-sm" onClick={onTest} disabled={testing}>{testing ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />} Call me</button>
        </>}
      </div>
      {voice && !voice.available && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">AI calling is not active on your account yet. Visits are confirmed on WhatsApp.</p>}
    </section>
  );
}

/** One call row; full transcript/summary opens in a popup. */
function CallRow({ c, busy, onRun, onOpen, onDelete }) {
  const b = CALL_BADGE[c.status] || CALL_BADGE.in_progress; const Icon = b[2];
  const o = c.outcome ? OUTCOME[c.outcome] : null; const OIcon = o?.[2];
  const canRetry = c.status === 'missed' && c.meetingId && ['scheduled', 'rescheduled'].includes(c.meetingStatus);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-900 dark:text-white">{c.lead.name} <span className="font-normal text-ink-400">{c.lead.phone}</span></p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-ink-400">{when(c.at)}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold ${b[1]}`}><Icon size={10} />{b[0]}</span>
          {o && <span className={`inline-flex items-center gap-1 font-semibold ${o[1]}`}><OIcon size={11} />{o[0]}</span>}
          {c.kind === 'reminder' && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700">Visit-day reminder</span>}
          {c.confirmedByCall && c.outcome === 'confirmed' && <span className="rounded-full bg-green-50 px-1.5 py-0.5 font-semibold text-green-700">Visit confirmed by call</span>}
          {c.status === 'answered' && <span className="text-ink-400">{dur(c.durationSec)}</span>}
          {c.whatsappFallback && <span className="font-semibold text-emerald-700">WhatsApp sent</span>}
          {c.result && RESULT[c.result] && <span className="text-ink-500">{RESULT[c.result]}</span>}
          <ErrorInfo message={c.error} title="Call error" />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {(c.summary || c.transcript?.length > 1 || c.recordingUrl) && <button type="button" onClick={() => onOpen(c)} title="View call" aria-label="View call details" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-700 dark:hover:bg-ink-800"><FileText size={15} /></button>}
        {c.status !== 'in_progress' && <button type="button" onClick={() => onDelete(c)} title="Delete from history" aria-label="Delete call from history" className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={15} /></button>}
        {canRetry && <>
          <button type="button" disabled={Boolean(busy)} onClick={() => onRun('call', c.meetingId)} title="Call again" className="rounded-lg border border-ink-200 p-1.5 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300">{busy === `call:${c.meetingId}` ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => onRun('wa', c.meetingId)} title="Send WhatsApp" className="rounded-lg border border-ink-200 p-1.5 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300">{busy === `wa:${c.meetingId}` ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}</button>
        </>}
      </div>
    </li>
  );
}

export default function VisitConfirmationPage() {
  const user = useAuthStore((s) => s.user);
  const [cfg, setCfg] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [section, setSection] = useState('visits'); // visits | leads
  const [voice, setVoice] = useState(null);
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState(null);
  const [callFilter, setCallFilter] = useState('all');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState('');
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState(user?.phone || '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openCall, setOpenCall] = useState(null);

  const loadVoice = useCallback(() => voiceApi.settings().then((r) => setVoice(r.data.voice)).catch(() => setVoice({ available: false })), []);
  const loadStats = useCallback(() => meetingApi.confirmationStats(days).then((r) => setStats(r.data.stats)).catch(() => setStats(null)), [days]);
  const loadCalls = useCallback(() => voiceApi.history({ section: 'visits', days, result: callFilter }).then((r) => setCalls(r.data)).catch(() => setCalls({ summary: {}, items: [] })), [days, callFilter]);
  const refreshAll = useCallback(() => { loadStats(); loadCalls(); loadVoice(); }, [loadStats, loadCalls, loadVoice]);

  useEffect(() => {
    settingsApi.get()
      .then((r) => setCfg({ hoursBefore: 24, templateName: '', templateLanguage: '', templateVariableCount: 0, callEnabled: true, callDelayMinutes: 1, callStartHour: 10, callEndHour: 19, callRetries: 0, reminderCall: true, ...(r.data.settings.visitConfirm || {}) }))
      .catch((e) => showDialog({ title: 'Could not load settings', message: errText(e) }));
    whatsappApi.templates().then((r) => setTemplates(r.data?.templates || [])).catch(() => {});
    loadVoice();
  }, [loadVoice]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadCalls(); }, [loadCalls]);

  // Live: call results and WhatsApp replies update without refresh.
  useEffect(() => {
    const socket = getSocket();
    const onUpdate = () => { loadStats(); loadCalls(); loadVoice(); };
    socket.on('meeting:updated', onUpdate);
    socket.on('meeting:created', onUpdate);
    socket.on('call:updated', onUpdate);
    return () => { socket.off('meeting:updated', onUpdate); socket.off('meeting:created', onUpdate); socket.off('call:updated', onUpdate); };
  }, [loadStats, loadCalls, loadVoice]);

  const usable = useMemo(() => templates.filter((t) => varCount(bodyOf(t)) <= 4 && !(t.components || []).some((c) => String(c.type).toUpperCase() === 'HEADER' && c.format && String(c.format).toUpperCase() !== 'TEXT')), [templates]);

  const save = async (patch) => {
    setCfg((c) => ({ ...c, ...patch }));
    try {
      await settingsApi.update({ visitConfirm: patch });
      toast.success('Saved');
    } catch (e) { toast.error(errText(e)); }
  };

  const toggleAi = async (v) => {
    if (v && voice && voice.planAllows === false) { showUpgrade('AI calling is available on paid plans. Upgrade to turn on instant AI confirmation calls.'); return; }
    if (v && voice && !voice.available) { toast.error('AI calling is not active on your account yet'); return; }
    if (!v && !(await confirmDialog({ title: 'Turn off AI calls?', message: 'Visits will be confirmed on WhatsApp (YES / NO) only. You can turn it back on anytime.', confirmLabel: 'Turn off' }))) return;
    save({ callEnabled: v, enabled: true, mode: 'call_first' });
  };

  const pickTemplate = (key) => {
    const t = usable.find((x) => `${x.name}::${x.language}` === key);
    save({ templateName: t?.name || '', templateLanguage: t?.language || '', templateVariableCount: t ? varCount(bodyOf(t)) : 0 });
  };

  const testCall = async () => {
    if (String(testPhone).replace(/\D/g, '').length < 10) { toast.error('Enter a 10-digit mobile number'); return; }
    setTesting(true);
    try {
      const res = await voiceApi.testCall(testPhone);
      showDialog({ tone: 'success', title: 'Test call on its way 📞', message: res.message });
    } catch (err) {
      showDialog({ title: 'Test call failed', message: errText(err) });
    } finally { setTesting(false); }
  };

  const run = async (kind, id) => {
    setBusy(`${kind}:${id}`);
    try {
      const res = kind === 'wa' ? await meetingApi.sendConfirmation(id) : kind === 'call' ? await meetingApi.callConfirmation(id) : await meetingApi.markConfirmation(id, kind === 'yes' ? 'confirmed' : 'declined');
      toast.success(res.message || 'Done');
    } catch (e) {
      showDialog({ title: kind === 'call' ? 'Call failed' : 'Action failed', message: errText(e) });
    } finally { setBusy(''); refreshAll(); }
  };

  const deleteCall = async (c) => {
    if (!(await confirmDialog({ title: 'Delete this call?', message: 'It is removed from the call history. The site visit and its confirmation stay.', confirmLabel: 'Delete', danger: true }))) return;
    try { await voiceApi.deleteCall(c.id); setCalls((d) => ({ ...d, items: d.items.filter((x) => x.id !== c.id) })); toast.success('Call deleted'); } catch (e) { toast.error(errText(e)); }
  };
  const clearCalls = async () => {
    if (!(await confirmDialog({ title: 'Clear visit call history?', message: 'All finished confirmation and reminder calls are removed from this list. Site visits are not changed.', confirmLabel: 'Clear history', danger: true }))) return;
    try { const r = await voiceApi.clearHistory('visits'); toast.success(r.message); loadCalls(); loadStats(); } catch (e) { toast.error(errText(e)); }
  };

  if (!cfg) return <div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-14" /><Skeleton className="h-20" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div></div>;
  const aiOn = cfg.callEnabled !== false && voice?.available !== false && voice?.planAllows !== false;
  const sum = calls?.summary;
  const tabs = [['all', 'All', sum?.total], ['answered', 'Answered', sum?.answered], ['missed', 'Missed', sum?.missed]];

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-6">
      {/* Header + settings toggle on top */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900 dark:text-white"><PhoneCall size={22} className="text-brand-600" /> AI calling</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{aiOn ? 'Booked visits get an instant AI confirmation call.' : 'Calls are off — visits confirm on WhatsApp.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-36 rounded-xl border border-ink-200 bg-white px-3 py-2 dark:border-ink-700 dark:bg-ink-900"><Toggle checked={cfg.callEnabled !== false} onChange={toggleAi} label={cfg.callEnabled !== false ? 'On' : 'Off'} disabled={voice && !voice.available && cfg.callEnabled === false} /></div>
          <button type="button" onClick={() => setSettingsOpen((v) => !v)} aria-expanded={settingsOpen} className={`btn-secondary gap-2 !py-2 text-sm ${settingsOpen ? '!border-brand-400 !text-brand-700' : ''}`}><Settings2 size={15} /> Settings <ChevronDown size={14} className={`transition ${settingsOpen ? 'rotate-180' : ''}`} /></button>
          <button type="button" onClick={refreshAll} className="btn-secondary !px-2.5 !py-2" aria-label="Refresh"><RefreshCw size={15} /></button>
        </div>
      </div>

      {voice?.planAllows === false && (
        <UpgradeCard
          feature="aiCalling"
          title="AI calling is a paid-plan feature"
          body="On a paid plan, every booked site visit gets an instant AI confirmation call (Hindi / English), with WhatsApp as the fallback. Growth includes 30 minutes a month and Builder Pro 100; extra minutes are billed per minute. Until then, visits are confirmed on WhatsApp."
        />
      )}

      <SettingsPanel open={settingsOpen} cfg={cfg} voice={voice} aiOn={aiOn} save={save} usable={usable} pickTemplate={pickTemplate} testPhone={testPhone} setTestPhone={setTestPhone} onTest={testCall} testing={testing} />

      {/* Two boxes: calls after a visit is booked · AI calling for leads */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['visits', 'Visit confirmation calls', 'Calls after a visit is booked in chat, and visit-day reminders', CalendarCheck, stats ? `${stats.callsPlaced ?? 0} calls · ${stats.confirmedByCall ?? 0} confirmed` : ''],
          ['leads', 'AI calling leads', 'Call contacts from Upload Data with your script', Users, voice?.queue?.queued ? `${voice.queue.queued} in queue` : ''],
        ].map(([key, title, sub, Icon, hint]) => (
          <button key={key} type="button" onClick={() => setSection(key)} aria-pressed={section === key} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${section === key ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/15 dark:bg-brand-950/30' : 'border-ink-100 bg-white hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900'}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${section === key ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}><Icon size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-bold text-ink-900 dark:text-white">{title}</span>
              <span className="mt-0.5 block text-xs text-ink-500">{sub}</span>
              {hint && <span className="mt-1.5 block text-[11px] font-semibold text-brand-700 dark:text-brand-300">{hint}</span>}
            </span>
          </button>
        ))}
      </div>

      {section === 'leads' ? (
        <LeadCallingPanel voice={voice} days={days} onOpen={setOpenCall} onChanged={loadVoice} />
      ) : (
        <>
          {/* Stats strip */}
          <section className="card flex flex-wrap items-stretch !p-0">
            <div className="grid flex-1 grid-cols-2 divide-ink-100 dark:divide-ink-800 sm:grid-cols-4 sm:divide-x">
              <MiniStat label="Visits" value={stats?.visits} hint={stats ? `${stats.upcoming} upcoming` : ''} />
              <MiniStat label="AI calls" value={stats?.callsPlaced} hint={stats ? `${stats.callsAnswered} answered · ${stats.callsMissed ?? stats.callsNotAnswered} missed` : ''} />
              <MiniStat label="WhatsApp sent" value={stats?.whatsappSent} hint={stats ? `${stats.whatsappFallbacks} after missed call` : ''} />
              <MiniStat label="Confirmed" value={stats?.confirmed} hint={stats ? `${stats.confirmedByCall} call · ${stats.confirmedByWhatsapp} WhatsApp · ${stats.declined} declined` : ''} />
            </div>
            <div className="flex items-center border-l border-ink-100 px-3 dark:border-ink-800">
              <select aria-label="Period" className="input-field !w-auto !py-1.5 text-xs" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
            </div>
          </section>

          <section className="card flex min-w-0 flex-col !p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3 dark:border-ink-800">
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Calls after WhatsApp booking</h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-ink-700">
                  {tabs.map(([key, label, n]) => <button key={key} type="button" onClick={() => setCallFilter(key)} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${callFilter === key ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{label}{n != null ? ` ${n}` : ''}</button>)}
                </div>
                {calls?.items?.length > 0 && <button type="button" onClick={clearCalls} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"><Trash2 size={12} /> Clear</button>}
              </div>
            </div>
            <ul className="max-h-[520px] divide-y divide-ink-100 overflow-y-auto dark:divide-ink-800">
              {calls === null ? [1, 2, 3, 4].map((i) => <li key={i} className="px-4 py-3"><Skeleton className="h-9" /></li>) : calls.items.map((c) => <CallRow key={c.id} c={c} busy={busy} onRun={run} onOpen={setOpenCall} onDelete={deleteCall} />)}
              {calls && calls.items.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-400">{callFilter === 'all' ? 'No calls yet' : 'No calls in this filter'}</li>}
            </ul>
          </section>
          <p className="text-[11px] text-ink-400">Upcoming visits are in <Link to="/site-visits" className="font-semibold text-brand-600 hover:underline">Site visits <ArrowRight size={11} className="inline" /></Link></p>
        </>
      )}

      <Modal open={Boolean(openCall)} onClose={() => setOpenCall(null)} title={openCall ? `Call · ${openCall.lead?.name || ''}` : ''} size="max-w-lg">
        {openCall && <div className="space-y-3 text-sm">
          <p className="text-xs text-ink-500">{when(openCall.at)}{openCall.visitDate ? ` · Visit ${openCall.visitDate} ${openCall.visitTime || ''}` : ''}{openCall.project ? ` · ${openCall.project}` : ''}{openCall.status === 'answered' ? ` · ${dur(openCall.durationSec)} (${openCall.minutes || 1} min)` : ''}</p>
          {openCall.summary && <p className="rounded-lg bg-ink-50 px-3 py-2 text-ink-700 dark:bg-ink-800/60 dark:text-ink-200">{openCall.summary}</p>}
          {openCall.transcript?.length > 1 && <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-ink-100 p-3 text-xs dark:border-ink-800">{openCall.transcript.map((t, i) => <p key={i} className={t.role === 'agent' ? 'text-ink-700 dark:text-ink-200' : 'text-brand-700 dark:text-brand-300'}><span className="font-semibold">{t.role === 'agent' ? 'AI' : 'Customer'}:</span> {t.text}</p>)}</div>}
          {openCall.recordingUrl && <a href={openCall.recordingUrl} target="_blank" rel="noreferrer" className="inline-block text-xs font-semibold text-brand-600 hover:underline">Play recording</a>}
        </div>}
      </Modal>
    </div>
  );
}
