import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, PhoneCall, Play } from 'lucide-react';
import { voiceApi, growthApi } from '../../api/saasApi.js';
import { fmtDate, PageTitle, Toggle, Notice, errText, CopyBox } from '../../lib/saas.jsx';

const STATUS_TONE = { completed: 'text-green-700', failed: 'text-red-600', 'no-answer': 'text-amber-700', busy: 'text-amber-700' };

export default function AiCallingPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['voice'], queryFn: voiceApi.settings });
  const calls = useQuery({ queryKey: ['calls'], queryFn: () => voiceApi.calls() });
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(null);
  const v = settings.data?.data?.voice;
  useEffect(() => {
    if (v && !form) setForm({ apiKey: '', agentId: v.agentId, fromNumber: v.fromNumber, autoCallAfterMinutes: v.autoCallAfterMinutes });
  }, [v, form]);

  const save = async (payload, text = 'Saved') => {
    setMsg(null);
    try {
      const res = await voiceApi.update(payload);
      qc.setQueryData(['voice'], { data: { voice: res.data.voice } });
      setMsg({ ok: true, text });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
  };

  if (settings.isLoading || !v || !form) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;
  const items = calls.data?.data?.items || [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageTitle title="AI calling" subtitle="Hindi / Hinglish AI voice agent — nayi leads ko call karke requirement samjhe aur site visit book kare." action={<span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700 dark:bg-ink-800 dark:text-ink-200">Is mahine: {v.minutesThisMonth} min</span>} />
      <Notice msg={msg} />
      <section className="card min-w-0 space-y-4">
        <Toggle checked={v.enabled} label="AI calling chalu" help="Chat panel mein 'AI se call karein' button dikhega." onChange={(x) => save({ enabled: x })} />
        <Toggle checked={v.autoCallNewLeads} disabled={!v.enabled} label="Nayi lead WhatsApp par reply na kare to AI call kare" help={`Form / ads / portal / partner leads ko ${v.autoCallAfterMinutes} minute baad (subah 10 se shaam 7 ke beech).`} onChange={(x) => save({ autoCallNewLeads: x })} />
      </section>
      <form className="card min-w-0 space-y-3" onSubmit={(e) => { e.preventDefault(); save({ ...(form.apiKey ? { apiKey: form.apiKey } : {}), agentId: form.agentId, fromNumber: form.fromNumber, autoCallAfterMinutes: Number(form.autoCallAfterMinutes) || 30 }, 'Settings saved'); setForm({ ...form, apiKey: '' }); }}>
        <h2 className="font-semibold text-ink-900 dark:text-white">Bolna voice agent</h2>
        <p className="text-sm text-ink-500">bolna.ai par agent banaiye (Hindi voice, apna Indian number), phir yahan details daaliye. Prompt mein ye variables use karein: <code>{'{lead_name}'}</code>, <code>{'{company_name}'}</code>, <code>{'{project}'}</code>, <code>{'{budget}'}</code>. Extraction mein <code>interested</code>, <code>visit_date</code> (YYYY-MM-DD), <code>visit_time</code> (HH:mm) rakhiye — visit apne aap book ho jayegi.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input-field" type="password" autoComplete="off" placeholder={v.apiKeySet ? 'API key saved — badalne ke liye nayi daaliye' : 'Bolna API key'} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value.trim() })} />
          <input className="input-field font-mono" placeholder="Agent ID" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value.trim() })} />
          <input className="input-field" placeholder="Caller number (optional, +91…)" value={form.fromNumber} onChange={(e) => setForm({ ...form, fromNumber: e.target.value.trim() })} />
          <label className="text-xs text-ink-500">Auto-call kitne minute baad<input className="input-field mt-1" inputMode="numeric" value={form.autoCallAfterMinutes} onChange={(e) => setForm({ ...form, autoCallAfterMinutes: e.target.value.replace(/\D/g, '') })} /></label>
        </div>
        <CopyBox label="Bolna agent ka webhook URL (call result yahan aayega)" value={v.webhookUrl} />
        <button className="btn-primary">Save</button>
      </form>
      <section className="card min-w-0 !p-0">
        <h2 className="flex items-center gap-2 px-5 pt-5 font-semibold text-ink-900 dark:text-white"><PhoneCall size={17} /> Recent calls</h2>
        <ul className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
          {items.map((c) => (
            <li key={c._id} className="px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><span className="font-medium text-ink-900 dark:text-white">{c.leadId?.name || 'Lead'}</span> <span className="text-ink-400">{c.leadId?.phone}</span></span>
                <span className="flex items-center gap-3 text-xs"><span className={STATUS_TONE[c.status] || 'text-ink-500'}>{c.status}</span><span className="text-ink-400">{c.durationSec ? `${Math.round(c.durationSec / 6) / 10} min` : ''}</span><span className="text-ink-400">{fmtDate(c.createdAt)}</span>{c.visitBooked && <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">Visit booked</span>}</span>
              </div>
              {c.summary && <p className="mt-1 text-ink-600 dark:text-ink-300">{c.summary}</p>}
              {c.error && <p className="mt-1 text-xs text-red-600">{c.error}</p>}
              <div className="mt-1 flex gap-3 text-xs">
                {c.recordingUrl && <a className="inline-flex items-center gap-1 font-semibold text-brand-700" href={c.recordingUrl} target="_blank" rel="noreferrer"><Play size={12} /> Recording</a>}
                {c.transcript && <button className="font-semibold text-brand-700" onClick={() => setOpen(open === c._id ? null : c._id)}>{open === c._id ? 'Transcript band' : 'Transcript'}</button>}
              </div>
              {open === c._id && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-xs dark:bg-ink-800">{c.transcript}</pre>}
            </li>
          ))}
          {!items.length && <li className="px-5 py-8 text-center text-sm text-ink-500">Abhi koi call nahi hui.</li>}
        </ul>
      </section>
      <p className="text-xs text-ink-500">AI calling ₹7/minute add-on hai (Bolna/telephony ka kharcha alag aapke Bolna account par). <button className="font-semibold text-brand-700 underline" onClick={() => growthApi.request({ type: 'voice', message: 'AI calling setup mein madad chahiye' }).then(() => setMsg({ ok: true, text: 'Visitsly team aapse contact karegi' })).catch((err) => setMsg({ ok: false, text: errText(err) }))}>Setup mein madad chahiye?</button></p>
    </div>
  );
}
