import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Send, Phone, CheckCircle2, XCircle, Clock3, PhoneOff, PhoneCall, MessageCircle, ArrowRight, RefreshCw, Settings2, CalendarCheck, KeyRound,
} from 'lucide-react';
import { settingsApi } from '../../api/settingsApi.js';
import { whatsappApi } from '../../api/whatsappApi.js';
import { meetingApi } from '../../api/meetingApi.js';
import { voiceApi } from '../../api/saasApi.js';
import { PageTitle, Toggle, errText, CopyBox } from '../../lib/saas.jsx';
import { toast, showDialog, Skeleton } from '../../components/ui/index.jsx';
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

function Stat({ icon: Icon, label, value, tone, hint }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3.5 dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon size={16} /></span><p className="text-xs font-medium text-ink-500">{label}</p></div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-900 dark:text-white">{value ?? <Skeleton className="h-7 w-10" />}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

function Step({ n, title, children, active }) {
  return (
    <div className={`flex gap-3 rounded-xl p-3 ${active ? 'bg-brand-50 dark:bg-brand-950/30' : ''}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800'}`}>{n}</span>
      <div><p className="text-sm font-semibold text-ink-900 dark:text-white">{title}</p><p className="mt-0.5 text-xs leading-5 text-ink-500 dark:text-ink-400">{children}</p></div>
    </div>
  );
}

/** Per-company AI calling (Bolna) setup with a test call. */
function VoiceSetup({ voice, onSaved }) {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ apiKey: '', agentId: voice?.agentId || '', fromNumber: voice?.fromNumber || '' });
  const [editing, setEditing] = useState(!(voice?.apiKeySet && voice?.agentId));
  const [busy, setBusy] = useState('');
  const [testPhone, setTestPhone] = useState(user?.phone || '');
  useEffect(() => { setForm((f) => ({ ...f, agentId: voice?.agentId || '', fromNumber: voice?.fromNumber || '' })); setEditing(!(voice?.apiKeySet && voice?.agentId)); }, [voice?.agentId, voice?.fromNumber, voice?.apiKeySet]);
  const ready = Boolean(voice?.enabled && voice?.apiKeySet && voice?.agentId);

  const save = async (e) => {
    e.preventDefault();
    if (!voice?.apiKeySet && !form.apiKey.trim()) { toast.error('Bolna API key daalein'); return; }
    if (!form.agentId.trim()) { toast.error('Agent ID daalein'); return; }
    setBusy('save');
    try {
      await voiceApi.update({ enabled: true, agentId: form.agentId.trim(), fromNumber: form.fromNumber.trim(), ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}) });
      setForm((f) => ({ ...f, apiKey: '' }));
      setEditing(false);
      toast.success('AI calling connect ho gaya. Ab ek test call karke dekhein.');
      onSaved?.();
    } catch (err) {
      showDialog({ title: 'AI calling save nahi hua', message: errText(err) });
    } finally { setBusy(''); }
  };
  const test = async () => {
    if (String(testPhone).replace(/\D/g, '').length < 10) { toast.error('Apna 10 digit mobile number daalein'); return; }
    setBusy('test');
    try {
      const res = await voiceApi.testCall(testPhone);
      showDialog({ tone: 'success', title: 'Test call lag rahi hai 📞', message: `${res.message}\n\nAgar call nahi aaye to Bolna dashboard mein agent ka phone number aur balance check karein.` });
    } catch (err) {
      showDialog({ title: 'Test call nahi lagi', message: errText(err) });
    } finally { setBusy(''); }
  };
  const disable = async () => {
    if (!window.confirm('AI calling band karein?')) return;
    try { await voiceApi.update({ enabled: false }); toast.success('AI calling band'); onSaved?.(); } catch (err) { toast.error(errText(err)); }
  };

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white"><PhoneCall size={16} className="text-brand-600" /> AI calling (aapki company ke liye)</h2>
        {ready ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Connected</span> : <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Set nahi hai</span>}
      </div>
      {ready && !editing ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-ink-300">Agent: <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs dark:bg-ink-800">{voice.agentId}</code>{voice.fromNumber ? <> · Number: <b>{voice.fromNumber}</b></> : null} · Is mahine: <b>{voice.minutesThisMonth || 0} min</b></p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Test call is number par
              <input className="input-field mt-1 !w-48" inputMode="tel" placeholder="98XXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            </label>
            <button type="button" className="btn-primary gap-2" onClick={test} disabled={busy === 'test'}>{busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />} Test call karein</button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>Badlein</button>
            <button type="button" className="text-xs font-semibold text-red-600" onClick={disable}>Band karein</button>
          </div>
          {voice.webhookUrl && <CopyBox label="Bolna agent ke webhook mein ye URL daalein (call ka result yahan aayega)" value={voice.webhookUrl} />}
        </div>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-xs leading-5 text-ink-600 dark:text-ink-300">
            <li><a href="https://platform.bolna.ai" target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">Bolna</a> par account banayein aur ek Hindi/Hinglish voice agent banayein.</li>
            <li>Agent ke "extraction" mein <code>visit_confirmed</code> (yes/no) aur <code>visit_date</code>, <code>visit_time</code> jodein.</li>
            <li>Developers section se API key aur agent ID neeche paste karein.</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-ink-800 dark:text-ink-100">API key<input className="input-field mt-1.5" type="password" autoComplete="new-password" placeholder={voice?.apiKeySet ? 'Purani key rakhne ke liye khali chhodein' : 'bn-…'} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} /></label>
            <label className="text-sm font-medium text-ink-800 dark:text-ink-100">Agent ID<input className="input-field mt-1.5" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} /></label>
            <label className="text-sm font-medium text-ink-800 dark:text-ink-100">Call kis number se (optional)<input className="input-field mt-1.5" placeholder="+91…" value={form.fromNumber} onChange={(e) => setForm({ ...form, fromNumber: e.target.value })} /></label>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary gap-2" disabled={busy === 'save'}>{busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Save & connect</button>
            {ready && <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      )}
    </section>
  );
}

export default function VisitConfirmationPage() {
  const [cfg, setCfg] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [visits, setVisits] = useState(null);
  const [voice, setVoice] = useState(null);
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState('');

  const loadVisits = useCallback(() => meetingApi.list({ when: 'upcoming', limit: 100 }).then((r) => setVisits((r.data.meetings || []).filter((m) => ['scheduled', 'rescheduled'].includes(m.status)))).catch((e) => { setVisits([]); toast.error(errText(e)); }), []);
  const loadVoice = useCallback(() => voiceApi.settings().then((r) => setVoice(r.data.voice)).catch(() => setVoice({})), []);
  const loadStats = useCallback(() => meetingApi.confirmationStats(days).then((r) => setStats(r.data.stats)).catch(() => setStats(null)), [days]);

  useEffect(() => {
    settingsApi.get()
      .then((r) => setCfg({ enabled: false, hoursBefore: 24, templateName: '', templateLanguage: '', templateVariableCount: 0, callEnabled: false, callAfterHours: 3, mode: 'call_first', callDelayMinutes: 30, callStartHour: 10, callEndHour: 19, callRetries: 0, ...(r.data.settings.visitConfirm || {}) }))
      .catch((e) => showDialog({ title: 'Settings load nahi hui', message: errText(e) }));
    whatsappApi.templates().then((r) => setTemplates(r.data?.templates || [])).catch(() => {});
    loadVisits(); loadVoice();
  }, [loadVisits, loadVoice]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // Live: call result / WhatsApp reply updates the list without refresh.
  useEffect(() => {
    const socket = getSocket();
    const onUpdate = () => { loadVisits(); loadStats(); };
    socket.on('meeting:updated', onUpdate);
    socket.on('meeting:created', onUpdate);
    return () => { socket.off('meeting:updated', onUpdate); socket.off('meeting:created', onUpdate); };
  }, [loadVisits, loadStats]);

  const usable = useMemo(() => templates.filter((t) => varCount(bodyOf(t)) <= 4 && !(t.components || []).some((c) => String(c.type).toUpperCase() === 'HEADER' && c.format && String(c.format).toUpperCase() !== 'TEXT')), [templates]);
  const voiceReady = Boolean(voice?.enabled && voice?.apiKeySet && voice?.agentId);

  const save = async (patch) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    try {
      await settingsApi.update({ visitConfirm: patch });
      toast.success('Save ho gaya');
    } catch (e) { toast.error(errText(e)); }
  };

  const pickTemplate = (key) => {
    const t = usable.find((x) => `${x.name}::${x.language}` === key);
    save({ templateName: t?.name || '', templateLanguage: t?.language || '', templateVariableCount: t ? varCount(bodyOf(t)) : 0 });
  };

  const run = async (kind, id) => {
    setBusy(`${kind}:${id}`);
    try {
      const res = kind === 'wa' ? await meetingApi.sendConfirmation(id) : kind === 'call' ? await meetingApi.callConfirmation(id) : await meetingApi.markConfirmation(id, kind === 'yes' ? 'confirmed' : 'declined');
      toast.success(res.message || 'Ho gaya');
    } catch (e) {
      showDialog({ title: kind === 'call' ? 'Call nahi lagi' : 'Nahi ho paaya', message: errText(e) });
    } finally { setBusy(''); loadVisits(); loadStats(); }
  };

  if (!cfg) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;
  const callFirst = cfg.mode !== 'whatsapp_first';

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <PageTitle title="Visit confirmation" subtitle="Site visit book hote hi AI call karke confirm karta hai. Call na uthe to WhatsApp par confirm hota hai." action={<button type="button" onClick={() => { loadVisits(); loadStats(); }} className="btn-secondary gap-2 !py-2 text-sm"><RefreshCw size={15} /> Refresh</button>} />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Pichhle {days} din</h2>
          <select className="input-field !w-auto !py-1.5 text-xs" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90].map((d) => <option key={d} value={d}>{d} din</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={CalendarCheck} label="Visits" value={stats?.visits} tone="bg-violet-50 text-violet-700" hint={stats ? `${stats.upcoming} aane wali` : ''} />
          <Stat icon={PhoneCall} label="Confirmation calls" value={stats?.callsPlaced} tone="bg-sky-50 text-sky-700" hint={stats ? `${stats.callsAnswered} uthi · ${stats.callsNotAnswered} nahi uthi` : ''} />
          <Stat icon={MessageCircle} label="WhatsApp confirmation" value={stats?.whatsappSent} tone="bg-emerald-50 text-emerald-700" hint={stats ? `${stats.whatsappFallbacks} call na uthne par gaye` : ''} />
          <Stat icon={CheckCircle2} label="Confirmed" value={stats?.confirmed} tone="bg-green-50 text-green-700" hint={stats ? `${stats.confirmedByCall} call se · ${stats.confirmedByWhatsapp} WhatsApp se · ${stats.declined} mana` : ''} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white"><Settings2 size={16} className="text-brand-600" /> Confirmation kaise ho?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[['call_first', 'Pehle AI call, phir WhatsApp', 'Recommended — call na uthe to WhatsApp par confirm'], ['whatsapp_first', 'Pehle WhatsApp, phir AI call', 'Jawab na aaye to AI call']].map(([key, title, help]) => (
            <button key={key} type="button" onClick={() => save({ mode: key })} className={`rounded-xl border p-3 text-left ${cfg.mode === key || (!cfg.mode && key === 'call_first') ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/15 dark:bg-brand-900/20' : 'border-ink-200 dark:border-ink-700'}`}>
              <p className="text-sm font-semibold text-ink-900 dark:text-white">{title}</p><p className="mt-0.5 text-xs text-ink-500">{help}</p>
            </button>
          ))}
        </div>

        {callFirst ? (
          <div className="grid gap-1 sm:grid-cols-3">
            <Step n={1} title="Visit book hui" active>AI chat mein visit book hote hi owner ko WhatsApp alert.</Step>
            <Step n={2} title={`${cfg.callDelayMinutes ?? 30} min baad AI call`} active={cfg.callEnabled && voiceReady}>Calling hours ({cfg.callStartHour ?? 10}–{cfg.callEndHour ?? 19} baje) mein.</Step>
            <Step n={3} title="Call na uthe → WhatsApp" active={cfg.callEnabled}>"Humne call kiya tha…" message, YES/NO reply se confirm.</Step>
          </div>
        ) : (
          <div className="grid gap-1 sm:grid-cols-3">
            <Step n={1} title={`${cfg.hoursBefore} ghante pehle WhatsApp`} active={cfg.enabled}>"Kya aap aa rahe hain? YES/NO"</Step>
            <Step n={2} title={`${cfg.callAfterHours} ghante jawab nahi → AI call`} active={cfg.callEnabled && voiceReady}>Calling hours mein hi.</Step>
            <Step n={3} title="Site visits page par status" active>Confirmed / Nahi aa rahe</Step>
          </div>
        )}

        <div className="space-y-3 border-t border-ink-100 pt-4 dark:border-ink-800">
          <Toggle checked={!!cfg.callEnabled} onChange={(v) => { if (v && !voiceReady) { toast.error('Pehle neeche AI calling connect karein'); return; } save({ callEnabled: v }); }} label="AI call se confirm karein" help={voiceReady ? 'Aapka Bolna agent call karega' : 'Neeche AI calling set karein'} />
          <Toggle checked={!!cfg.enabled} onChange={(v) => save({ enabled: v })} label="WhatsApp se confirm karein" help="Call na uthe ya call band ho to WhatsApp par confirmation" />
          <div className="grid gap-3 sm:grid-cols-4">
            {callFirst ? <>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Booking ke kitni der baad call
                <select className="input-field mt-1" value={cfg.callDelayMinutes ?? 30} onChange={(e) => save({ callDelayMinutes: Number(e.target.value) })}>{[5, 15, 30, 60, 120, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} ghante`}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call na uthe to dobara call
                <select className="input-field mt-1" value={cfg.callRetries ?? 0} onChange={(e) => save({ callRetries: Number(e.target.value) })}>{[0, 1, 2].map((m) => <option key={m} value={m}>{m === 0 ? 'Nahi, seedha WhatsApp' : `${m} baar (1 ghante baad)`}</option>)}</select>
              </label>
            </> : <>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">WhatsApp kitne ghante pehle
                <select className="input-field mt-1" value={cfg.hoursBefore} onChange={(e) => save({ hoursBefore: Number(e.target.value) })}>{[3, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} ghante</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Jawab ka wait (phir call)
                <select className="input-field mt-1" value={cfg.callAfterHours} onChange={(e) => save({ callAfterHours: Number(e.target.value) })}>{[1, 2, 3, 6, 12].map((h) => <option key={h} value={h}>{h} ghante</option>)}</select>
              </label>
            </>}
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call kab se
              <select className="input-field mt-1" value={cfg.callStartHour ?? 10} onChange={(e) => save({ callStartHour: Number(e.target.value) })}>{[8, 9, 10, 11, 12].map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Call kab tak
              <select className="input-field mt-1" value={cfg.callEndHour ?? 19} onChange={(e) => save({ callEndHour: Number(e.target.value) })}>{[17, 18, 19, 20, 21].map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
            </label>
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

      {voice ? <VoiceSetup voice={voice} onSaved={loadVoice} /> : <Skeleton className="h-40 !rounded-xl" />}

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
                    {c.whatsappFallbackAt && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><MessageCircle size={11} /> WhatsApp bheja</span>}
                    {c.sentAt && !c.whatsappFallbackAt && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><MessageCircle size={11} /> WhatsApp gaya</span>}
                    {c.confirmedVia && <span className="rounded-full bg-ink-100 px-2 py-0.5 font-semibold text-ink-600">via {c.confirmedVia === 'call' ? 'call' : c.confirmedVia === 'manual' ? 'aap' : 'WhatsApp'}</span>}
                  </p>
                  {c.error && <p className="mt-1 text-xs text-red-600">{c.error}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {b && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${b[1]}`}><Icon size={13} />{b[0]}</span>}
                  {voiceReady && <button type="button" disabled={Boolean(busy)} onClick={() => run('call', v._id)} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-xs">{busy === `call:${v._id}` ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}AI call</button>}
                  <button type="button" disabled={Boolean(busy)} onClick={() => run('wa', v._id)} className="btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-xs">{busy === `wa:${v._id}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}WhatsApp</button>
                  {c.status !== 'confirmed' && <button type="button" disabled={Boolean(busy)} onClick={() => run('yes', v._id)} className="btn-secondary !py-1.5 text-xs text-green-700" title="Customer ne phone par confirm kiya">✓ Confirm</button>}
                </div>
              </li>
            );
          })}
          {visits?.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-500">Koi aane wali visit nahi.</li>}
        </ul>
      </section>
    </div>
  );
}
