import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Send, Phone, CheckCircle2, XCircle, Clock3, PhoneOff, PhoneCall, MessageCircle, ArrowRight, RefreshCw,
  Settings2, CalendarCheck, Languages, IndianRupee, PhoneIncoming, HelpCircle,
} from 'lucide-react';
import { settingsApi } from '../../api/settingsApi.js';
import { whatsappApi } from '../../api/whatsappApi.js';
import { meetingApi } from '../../api/meetingApi.js';
import { voiceApi } from '../../api/saasApi.js';
import { PageTitle, Toggle, errText } from '../../lib/saas.jsx';
import { toast, showDialog, Skeleton, confirmDialog } from '../../components/ui/index.jsx';
import { getSocket } from '../../lib/socket.js';
import { useAuthStore } from '../../store/authStore.js';

const bodyOf = (t) => (t?.components || []).find((c) => String(c.type).toUpperCase() === 'BODY')?.text || t?.bodyText || '';
const varCount = (text) => Math.max(0, ...[...String(text).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
const CALL_FAIL = ['no-answer', 'busy', 'failed', 'canceled', 'cancelled', 'error', 'call-disconnected', 'stopped'];

const BADGE = {
  confirmed: ['Confirmed', 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', CheckCircle2],
  declined: ['Nahi aa rahe', 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', XCircle],
  pending: ['Jawab ka wait', 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', Clock3],
};

const money = (v, currency = 'INR') => {
  if (v == null) return '—';
  try { return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v); } catch { return `${currency} ${v}`; }
};
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

function Stat({ icon: Icon, label, value, tone, hint }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3.5 dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon size={16} /></span><p className="text-xs font-medium text-ink-500">{label}</p></div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-900 dark:text-white">{value ?? <Skeleton className="h-7 w-10" />}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

function Step({ n, title, children, active = true }) {
  return (
    <div className={`flex gap-3 rounded-xl p-3 ${active ? 'bg-brand-50 dark:bg-brand-950/30' : ''}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800'}`}>{n}</span>
      <div><p className="text-sm font-semibold text-ink-900 dark:text-white">{title}</p><p className="mt-0.5 text-xs leading-5 text-ink-500 dark:text-ink-400">{children}</p></div>
    </div>
  );
}

/** AI calling switch + language/voice + price per minute (platform-managed, nothing to set up). */
function AiCallingCard({ cfg, voice, onToggle, onTest, testing, testPhone, setTestPhone }) {
  const p = voice?.pricing;
  const on = cfg.callEnabled !== false;
  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white"><PhoneCall size={16} className="text-brand-600" /> AI call se confirm karein</h2>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">Voice aur bot hum sambhalte hain — aapko kuch set nahi karna. Band karne par sirf WhatsApp se confirmation hoga.</p>
        </div>
        <div className="w-56 shrink-0"><Toggle checked={on} onChange={onToggle} label={on ? 'Chalu hai' : 'Band hai'} disabled={voice && !voice.available && !on} /></div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><Languages size={12} /> Voice</p>
          <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">{voice ? (voice.available ? voice.languageLabel : 'Jaldi aa raha hai') : '…'}</p>
          <p className="text-[11px] text-ink-400">Aapke country + customer ki language ke hisab se</p>
        </div>
        <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><IndianRupee size={12} /> Pricing</p>
          <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">{p ? `${money(p.perMinute, p.currency)} / minute` : '…'}</p>
          <p className="text-[11px] text-ink-400">{p?.taxRate ? `+ ${Math.round(p.taxRate * 100)}% tax · ` : ''}sirf utne minute jitni der baat hui</p>
        </div>
        <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><Clock3 size={12} /> Is mahine</p>
          <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">{voice ? `${voice.minutesThisMonth || 0} min · ${money(voice.costThisMonth ?? 0, p?.currency)}` : '…'}</p>
          <p className="text-[11px] text-ink-400">Billing page se minutes add kar sakte hain</p>
        </div>
      </div>

      {on && voice?.available && (
        <div className="flex flex-wrap items-end gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Voice sunne ke liye test call
            <input className="input-field mt-1 !w-44" inputMode="tel" placeholder="98XXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          </label>
          <button type="button" className="btn-secondary gap-2 !py-2 text-sm" onClick={onTest} disabled={testing}>{testing ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />} Test call</button>
        </div>
      )}
      {voice && !voice.available && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">AI calling abhi aapke account par active nahi hui hai. Tab tak confirmation WhatsApp se hoga.</p>}
    </section>
  );
}

const CALL_BADGE = {
  answered: ['Call uthi', 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', PhoneIncoming],
  missed: ['Miss hui', 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', PhoneOff],
  in_progress: ['Call chal rahi hai', 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300', Phone],
};
const OUTCOME = {
  confirmed: ['Visit confirm', 'text-green-700'],
  declined: ['Nahi aa paayenge', 'text-red-600'],
  unclear: ['Saaf jawab nahi mila', 'text-amber-700'],
};

/** All AI calling work in one place: who was called, who picked up, who missed. */
function AiCallsSection({ data, filter, setFilter, busy, onRun, days }) {
  const sum = data?.summary;
  const tabs = [['all', 'Sab', sum?.total], ['answered', 'Uthi', sum?.answered], ['missed', 'Miss', sum?.missed]];
  return (
    <section className="card !p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">AI calls</h2>
          <p className="text-xs text-ink-500">Pichhle {days} din — kisko call gayi, kisne uthayi, kiski miss hui</p>
        </div>
        <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-ink-700">
          {tabs.map(([key, label, n]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${filter === key ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{label}{n != null ? ` · ${n}` : ''}</button>
          ))}
        </div>
      </div>
      <ul className="mt-2 divide-y divide-ink-100 dark:divide-ink-800">
        {data === null ? [1, 2, 3].map((i) => <li key={i} className="px-5 py-3"><Skeleton className="h-10" /></li>) : data.items.map((c) => {
          const b = CALL_BADGE[c.status]; const Icon = b[2]; const o = c.outcome ? OUTCOME[c.outcome] : null;
          const canRetry = c.status === 'missed' && c.meetingId && ['scheduled', 'rescheduled'].includes(c.meetingStatus);
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-ink-900 dark:text-white">{c.lead.name} <span className="font-normal text-ink-400">{c.lead.phone}</span></p>
                <p className="text-xs text-ink-500">{when(c.at)}{c.visitDate ? ` · Visit ${c.visitDate} ${c.visitTime || ''}` : ''}{c.project ? ` · ${c.project}` : ''}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${b[1]}`}><Icon size={11} />{b[0]}</span>
                  {o && <span className={`inline-flex items-center gap-1 font-semibold ${o[1]}`}>{c.outcome === 'unclear' ? <HelpCircle size={11} /> : c.outcome === 'confirmed' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}{o[0]}</span>}
                  {c.status === 'answered' && <span className="text-ink-400">{dur(c.durationSec)} · {c.minutes || 1} min</span>}
                  {c.attempts > 1 && <span className="text-ink-400">{c.attempts}x try</span>}
                  {c.whatsappFallback && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><MessageCircle size={11} /> WhatsApp bheja</span>}
                  {c.recordingUrl && <a href={c.recordingUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">Recording</a>}
                </p>
                {c.summary && <p className="mt-1 line-clamp-2 text-xs text-ink-500">{c.summary}</p>}
                {c.error && <p className="mt-1 text-xs text-red-600">{c.error}</p>}
              </div>
              {canRetry && (
                <div className="flex gap-2">
                  <button type="button" disabled={Boolean(busy)} onClick={() => onRun('call', c.meetingId)} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-xs">{busy === `call:${c.meetingId}` ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}Dobara call</button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => onRun('wa', c.meetingId)} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-xs">{busy === `wa:${c.meetingId}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}WhatsApp</button>
                </div>
              )}
            </li>
          );
        })}
        {data && data.items.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-500">{filter === 'all' ? 'Abhi tak koi AI call nahi gayi. Visit book hote hi yahan dikhne lagegi.' : 'Is filter mein koi call nahi.'}</li>}
      </ul>
    </section>
  );
}

export default function VisitConfirmationPage() {
  const user = useAuthStore((s) => s.user);
  const [cfg, setCfg] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [visits, setVisits] = useState(null);
  const [voice, setVoice] = useState(null);
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState(null);
  const [callFilter, setCallFilter] = useState('all');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState('');
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState(user?.phone || '');

  const loadVisits = useCallback(() => meetingApi.list({ when: 'upcoming', limit: 100 }).then((r) => setVisits((r.data.meetings || []).filter((m) => ['scheduled', 'rescheduled'].includes(m.status)))).catch((e) => { setVisits([]); toast.error(errText(e)); }), []);
  const loadVoice = useCallback(() => voiceApi.settings().then((r) => setVoice(r.data.voice)).catch(() => setVoice({ available: false })), []);
  const loadStats = useCallback(() => meetingApi.confirmationStats(days).then((r) => setStats(r.data.stats)).catch(() => setStats(null)), [days]);
  const loadCalls = useCallback(() => meetingApi.confirmationCalls({ days, result: callFilter }).then((r) => setCalls(r.data)).catch(() => setCalls({ summary: {}, items: [] })), [days, callFilter]);
  const refreshAll = useCallback(() => { loadVisits(); loadStats(); loadCalls(); loadVoice(); }, [loadVisits, loadStats, loadCalls, loadVoice]);

  useEffect(() => {
    settingsApi.get()
      .then((r) => setCfg({ hoursBefore: 24, templateName: '', templateLanguage: '', templateVariableCount: 0, callEnabled: true, callDelayMinutes: 30, callStartHour: 10, callEndHour: 19, callRetries: 0, ...(r.data.settings.visitConfirm || {}) }))
      .catch((e) => showDialog({ title: 'Settings load nahi hui', message: errText(e) }));
    whatsappApi.templates().then((r) => setTemplates(r.data?.templates || [])).catch(() => {});
    loadVisits(); loadVoice();
  }, [loadVisits, loadVoice]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadCalls(); }, [loadCalls]);

  // Live: call result / WhatsApp reply updates everything without refresh.
  useEffect(() => {
    const socket = getSocket();
    const onUpdate = () => { loadVisits(); loadStats(); loadCalls(); loadVoice(); };
    socket.on('meeting:updated', onUpdate);
    socket.on('meeting:created', onUpdate);
    return () => { socket.off('meeting:updated', onUpdate); socket.off('meeting:created', onUpdate); };
  }, [loadVisits, loadStats, loadCalls, loadVoice]);

  const usable = useMemo(() => templates.filter((t) => varCount(bodyOf(t)) <= 4 && !(t.components || []).some((c) => String(c.type).toUpperCase() === 'HEADER' && c.format && String(c.format).toUpperCase() !== 'TEXT')), [templates]);

  const save = async (patch) => {
    setCfg((c) => ({ ...c, ...patch }));
    try {
      await settingsApi.update({ visitConfirm: patch });
      toast.success('Save ho gaya');
    } catch (e) { toast.error(errText(e)); }
  };

  const toggleAi = async (v) => {
    if (v && voice && !voice.available) { toast.error('AI calling abhi aapke account par active nahi hai'); return; }
    if (!v && !(await confirmDialog({ title: 'AI call band karein?', message: 'Ab visit sirf WhatsApp se confirm hogi. Aap jab chahein dobara chalu kar sakte hain.', confirmLabel: 'Haan, band karein' }))) return;
    save({ callEnabled: v, enabled: true, mode: 'call_first' });
  };

  const pickTemplate = (key) => {
    const t = usable.find((x) => `${x.name}::${x.language}` === key);
    save({ templateName: t?.name || '', templateLanguage: t?.language || '', templateVariableCount: t ? varCount(bodyOf(t)) : 0 });
  };

  const testCall = async () => {
    if (String(testPhone).replace(/\D/g, '').length < 10) { toast.error('Apna 10 digit mobile number daalein'); return; }
    setTesting(true);
    try {
      const res = await voiceApi.testCall(testPhone);
      showDialog({ tone: 'success', title: 'Test call lag rahi hai 📞', message: res.message });
    } catch (err) {
      showDialog({ title: 'Test call nahi lagi', message: errText(err) });
    } finally { setTesting(false); }
  };

  const run = async (kind, id) => {
    setBusy(`${kind}:${id}`);
    try {
      const res = kind === 'wa' ? await meetingApi.sendConfirmation(id) : kind === 'call' ? await meetingApi.callConfirmation(id) : await meetingApi.markConfirmation(id, kind === 'yes' ? 'confirmed' : 'declined');
      toast.success(res.message || 'Ho gaya');
    } catch (e) {
      showDialog({ title: kind === 'call' ? 'Call nahi lagi' : 'Nahi ho paaya', message: errText(e) });
    } finally { setBusy(''); refreshAll(); }
  };

  if (!cfg) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;
  const aiOn = cfg.callEnabled !== false && voice?.available !== false;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <PageTitle title="Visit confirmation" subtitle={aiOn ? 'Site visit book hote hi AI call karke confirm karta hai. Call na uthe to WhatsApp par confirm hota hai.' : 'Site visit WhatsApp par YES / NO se confirm hoti hai.'} action={<button type="button" onClick={refreshAll} className="btn-secondary gap-2 !py-2 text-sm"><RefreshCw size={15} /> Refresh</button>} />

      <AiCallingCard cfg={cfg} voice={voice} onToggle={toggleAi} onTest={testCall} testing={testing} testPhone={testPhone} setTestPhone={setTestPhone} />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Pichhle {days} din</h2>
          <select className="input-field !w-auto !py-1.5 text-xs" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90].map((d) => <option key={d} value={d}>{d} din</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={CalendarCheck} label="Visits" value={stats?.visits} tone="bg-violet-50 text-violet-700" hint={stats ? `${stats.upcoming} aane wali` : ''} />
          <Stat icon={PhoneCall} label="AI calls" value={stats?.callsPlaced} tone="bg-sky-50 text-sky-700" hint={stats ? `${stats.callsAnswered} uthi · ${stats.callsMissed ?? stats.callsNotAnswered} miss` : ''} />
          <Stat icon={MessageCircle} label="WhatsApp confirmation" value={stats?.whatsappSent} tone="bg-emerald-50 text-emerald-700" hint={stats ? `${stats.whatsappFallbacks} call na uthne par gaye` : ''} />
          <Stat icon={CheckCircle2} label="Confirmed" value={stats?.confirmed} tone="bg-green-50 text-green-700" hint={stats ? `${stats.confirmedByCall} call se · ${stats.confirmedByWhatsapp} WhatsApp se · ${stats.declined} mana` : ''} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white"><Settings2 size={16} className="text-brand-600" /> Confirmation kaise hoti hai</h2>
        {aiOn ? (
          <div className="grid gap-1 sm:grid-cols-3">
            <Step n={1} title="Visit book hui">AI chat mein visit book hote hi owner ko WhatsApp alert.</Step>
            <Step n={2} title={`${cfg.callDelayMinutes ?? 30} min baad AI call`}>Customer se property aur time confirm karwata hai ({cfg.callStartHour ?? 10}–{cfg.callEndHour ?? 19} baje ke beech).</Step>
            <Step n={3} title="Call na uthe → WhatsApp">"Humne call kiya tha…" message, YES / NO reply se confirm.</Step>
          </div>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            <Step n={1} title={`Visit se ${cfg.hoursBefore} ghante pehle WhatsApp`}>"Kya aap aa rahe hain? YES / NO"</Step>
            <Step n={2} title="Site visits page par status">Confirmed / Nahi aa rahe — owner ko alert.</Step>
          </div>
        )}

        <div className="space-y-3 border-t border-ink-100 pt-4 dark:border-ink-800">
          <div className="grid gap-3 sm:grid-cols-4">
            {aiOn ? <>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Booking ke kitni der baad call
                <select className="input-field mt-1" value={cfg.callDelayMinutes ?? 30} onChange={(e) => save({ callDelayMinutes: Number(e.target.value) })}>{[5, 15, 30, 60, 120, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} ghante`}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call na uthe to dobara call
                <select className="input-field mt-1" value={cfg.callRetries ?? 0} onChange={(e) => save({ callRetries: Number(e.target.value) })}>{[0, 1, 2].map((m) => <option key={m} value={m}>{m === 0 ? 'Nahi, seedha WhatsApp' : `${m} baar (1 ghante baad)`}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call kab se
                <select className="input-field mt-1" value={cfg.callStartHour ?? 10} onChange={(e) => save({ callStartHour: Number(e.target.value) })}>{[8, 9, 10, 11, 12].map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call kab tak
                <select className="input-field mt-1" value={cfg.callEndHour ?? 19} onChange={(e) => save({ callEndHour: Number(e.target.value) })}>{[17, 18, 19, 20, 21].map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
              </label>
            </> : (
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">WhatsApp kitne ghante pehle
                <select className="input-field mt-1" value={cfg.hoursBefore} onChange={(e) => save({ hoursBefore: Number(e.target.value) })}>{[3, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} ghante</option>)}</select>
              </label>
            )}
          </div>
          <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300">WhatsApp template (jab customer ne 24 ghante se message na kiya ho)
            <select className="input-field mt-1 sm:max-w-md" value={cfg.templateName ? `${cfg.templateName}::${cfg.templateLanguage}` : ''} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">Koi nahi</option>
              {usable.map((t) => <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>{t.name} · {t.language}</option>)}
            </select>
            <span className="mt-1 block font-normal text-ink-400">Variables: {'{{1}}'} naam · {'{{2}}'} project · {'{{3}}'} din · {'{{4}}'} time. <Link to="/whatsapp/templates" className="font-semibold text-brand-600 hover:underline">Naya template banayein</Link></span>
          </label>
        </div>
      </section>

      <section className="card !p-0">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Aane wali visits</h2>
          <Link to="/site-visits" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600">Site visits page <ArrowRight size={13} /></Link>
        </div>
        <ul className="mt-2 divide-y divide-ink-100 dark:divide-ink-800">
          {visits === null ? [1, 2, 3].map((i) => <li key={i} className="px-5 py-3"><Skeleton className="h-10" /></li>) : visits.map((v) => {
            const c = v.confirmation || {};
            const b = BADGE[c.status];
            const Icon = b?.[2];
            const callStatus = String(c.callStatus || '').toLowerCase();
            const callFailed = CALL_FAIL.includes(callStatus);
            return (
              <li key={v._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900 dark:text-white">{v.leadId?.name || 'Lead'} <span className="font-normal text-ink-400">{v.leadId?.phone}</span></p>
                  <p className="text-xs text-ink-500">{v.preferredDate} · {v.preferredTime}{v.propertyId?.projectName ? ` · ${v.propertyId.projectName}` : ''}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    {c.calledAt && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${callFailed ? 'bg-red-50 text-red-700' : callStatus === 'completed' ? 'bg-sky-50 text-sky-700' : 'bg-ink-100 text-ink-600'}`}>{callFailed ? <PhoneOff size={11} /> : <Phone size={11} />}{callFailed ? 'Call nahi uthi' : callStatus === 'completed' ? 'Call hui' : 'Call lag rahi hai'}{c.callAttempts > 1 ? ` (${c.callAttempts}x)` : ''}</span>}
                    {c.sentAt && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><MessageCircle size={11} /> {c.whatsappFallbackAt ? 'WhatsApp bheja' : 'WhatsApp gaya'}</span>}
                    {c.confirmedVia && <span className="rounded-full bg-ink-100 px-2 py-0.5 font-semibold text-ink-600">via {c.confirmedVia === 'call' ? 'call' : c.confirmedVia === 'manual' ? 'aap' : 'WhatsApp'}</span>}
                  </p>
                  {c.error && <p className="mt-1 text-xs text-red-600">{c.error}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {b && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${b[1]}`}><Icon size={13} />{b[0]}</span>}
                  {aiOn && <button type="button" disabled={Boolean(busy)} onClick={() => run('call', v._id)} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-xs">{busy === `call:${v._id}` ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}AI call</button>}
                  <button type="button" disabled={Boolean(busy)} onClick={() => run('wa', v._id)} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-xs">{busy === `wa:${v._id}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}WhatsApp</button>
                  {c.status !== 'confirmed' && <button type="button" disabled={Boolean(busy)} onClick={() => run('yes', v._id)} className="btn-secondary !py-1.5 text-xs text-green-700" title="Customer ne phone par confirm kiya">✓ Confirm</button>}
                </div>
              </li>
            );
          })}
          {visits?.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-500">Koi aane wali visit nahi.</li>}
        </ul>
      </section>

      <AiCallsSection data={calls} filter={callFilter} setFilter={setCallFilter} busy={busy} onRun={run} days={days} />
    </div>
  );
}
