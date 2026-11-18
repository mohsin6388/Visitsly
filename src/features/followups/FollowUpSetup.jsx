import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X, Save } from 'lucide-react';
import { settingsApi } from '../../api/settingsApi.js';
import { whatsappApi } from '../../api/whatsappApi.js';
import { Notice, errText } from '../../lib/saas.jsx';
import { useFeature } from '../saas/UpgradeCard.jsx';
import { showUpgrade } from '../../lib/saas.jsx';

const MODES = [
  ['auto', 'Send automatically (recommended)', 'If there is no reply, a WhatsApp follow-up is sent during working hours.'],
  ['remind', 'Remind me', 'If there is no reply, a message is drafted and you get a reminder to send it.'],
  ['manual', 'Manual', 'AI only suggests. You send by clicking "Send".'],
];

const PRESETS = [
  ['india', 'India', { timezone: 'Asia/Kolkata', startHour: 10, endHour: 19, gapsDays: [1, 3, 7] }],
  ['dubai', 'Dubai', { timezone: 'Asia/Dubai', startHour: 10, endHour: 20, gapsDays: [1, 3, 7] }],
  ['usa', 'USA (Eastern)', { timezone: 'America/New_York', startHour: 9, endHour: 20, gapsDays: [2, 5, 10] }],
];

const DEFAULT_HINT = [
  'Hi {name}! Following up on your property requirement. Are you still looking?',
  'Hi {name}, we have a few good options ready for you. Would you like to book a site visit?',
  'Hi {name}, just checking one last time. Message us here whenever you need help.',
  'Hi {name}, let us know if you are still looking for a property.',
];

const bodyOf = (t) => (t?.components || []).find((c) => String(c.type).toUpperCase() === 'BODY')?.text || t?.bodyText || '';
const varCount = (text) => Math.max(0, ...[...String(text).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));

export default function FollowUpSetup({ onSaved }) {
  const autoAllowed = useFeature('autoFollowUps');
  const [cfg, setCfg] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.get().then((r) => {
      const f = r.data.settings.followUp || {};
      setCfg({ mode: 'auto', messages: [], startHour: 10, endHour: 19, timezone: 'Asia/Kolkata', templateName: '', templateLanguage: '', templateVariableCount: 0, useAiDate: true, ...f, gapsDays: f.gapsDays?.length ? f.gapsDays : [1, 3, 7], reengage: { enabled: true, gapsDays: [7, 30], message: '', ...(f.reengage || {}) } });
    }).catch((e) => setMsg({ ok: false, text: errText(e) }));
    whatsappApi.templates().then((r) => setTemplates(r.data?.templates || [])).catch(() => {});
  }, []);

  const usable = useMemo(() => templates.filter((t) => varCount(bodyOf(t)) <= 2 && !(t.components || []).some((c) => String(c.type).toUpperCase() === 'HEADER' && c.format && String(c.format).toUpperCase() !== 'TEXT')), [templates]);

  if (!cfg) return <div className="card flex justify-center py-8"><Loader2 className="animate-spin text-ink-400" /></div>;
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const setGap = (i, v) => set({ gapsDays: cfg.gapsDays.map((d, j) => (j === i ? v : d)) });
  const setText = (i, v) => { const m = [...cfg.messages]; while (m.length < cfg.gapsDays.length) m.push(''); m[i] = v; set({ messages: m }); };
  const removeStep = (i) => set({ gapsDays: cfg.gapsDays.filter((_, j) => j !== i), messages: cfg.messages.filter((_, j) => j !== i) });
  const pickTemplate = (key) => {
    const t = usable.find((x) => `${x.name}::${x.language}` === key);
    set({ templateName: t?.name || '', templateLanguage: t?.language || '', templateVariableCount: t ? varCount(bodyOf(t)) : 0 });
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const gaps = cfg.gapsDays.map((d) => Math.min(60, Math.max(1, Math.round(Number(d) || 1))));
      await settingsApi.update({ followUp: {
        mode: cfg.mode, gapsDays: gaps, messages: gaps.map((_, i) => String(cfg.messages[i] || '').trim()),
        startHour: Number(cfg.startHour), endHour: Number(cfg.endHour), timezone: cfg.timezone,
        templateName: cfg.templateName || '', templateLanguage: cfg.templateLanguage || '', templateVariableCount: cfg.templateVariableCount || 0, useAiDate: cfg.useAiDate,
        reengage: { enabled: cfg.reengage?.enabled !== false, gapsDays: (cfg.reengage?.gapsDays || [7, 30]).map((n) => Math.min(120, Math.max(1, Number(n) || 7))), message: String(cfg.reengage?.message || '').trim() },
      } });
      setMsg({ ok: true, text: 'Saved' });
      onSaved?.(cfg.mode);
    } catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setSaving(false); }
  };

  const label = 'block text-xs font-semibold text-ink-600 dark:text-ink-300';

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="font-semibold text-ink-900 dark:text-white">Follow-up setup</h2>
        <p className="text-xs text-ink-500">Choose when and how to follow up when a lead doesn’t reply.</p>
      </div>
      <Notice msg={msg} />

      <div className="space-y-2">
        <p className={label}>1. How to follow up?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map(([key, title, help]) => (
            <button key={key} type="button" onClick={() => set({ mode: key })} className={`rounded-xl border p-3 text-left ${cfg.mode === key ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-ink-200 dark:border-ink-700'}`}>
              <p className="text-sm font-semibold text-ink-900 dark:text-white">{title}{key === 'auto' && !autoAllowed && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Growth</span>}</p>
              <p className="mt-1 text-xs text-ink-500">{help}</p>
            </button>
          ))}
        </div>
        {cfg.mode === 'auto' && !autoAllowed && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            Automatic Follow-ups are on the Growth plan. On your plan, follow-ups are created and you get a reminder to send them.
            <button type="button" className="font-semibold underline" onClick={() => showUpgrade('Automatic Follow-ups are included in the Growth plan. Upgrade to send follow-ups automatically.')}>Upgrade</button>
          </p>
        )}
      </div>

      {cfg.mode !== 'manual' && (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={label}>2. If no reply — after how many days, and what message?</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(([k, name, p]) => <button key={k} type="button" onClick={() => set(p)} className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200">{name}</button>)}
              </div>
            </div>
            {cfg.gapsDays.map((d, i) => (
              <div key={i} className="rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink-800 dark:text-ink-100">Follow-up {i + 1}: <input type="number" min={1} max={60} value={d} onChange={(e) => setGap(i, e.target.value)} className="mx-1 w-16 rounded-lg border border-ink-200 px-2 py-1 text-center text-sm dark:border-ink-700 dark:bg-ink-800" /> days after the last message</p>
                  {cfg.gapsDays.length > 1 && <button type="button" onClick={() => removeStep(i)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Remove"><X size={15} /></button>}
                </div>
                <textarea rows={2} value={cfg.messages[i] || ''} onChange={(e) => setText(i, e.target.value)} placeholder={DEFAULT_HINT[Math.min(i, DEFAULT_HINT.length - 1)]} className="mt-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white" />
              </div>
            ))}
            {cfg.gapsDays.length < 5 && <button type="button" onClick={() => set({ gapsDays: [...cfg.gapsDays, Math.max(...cfg.gapsDays) + 3] })} className="btn-secondary flex items-center gap-1.5 !py-1.5 text-xs"><Plus size={13} /> Add follow-up</button>}
            <p className="text-[11px] text-ink-500">Leave blank to use the default message. <code>{'{name}'}</code> becomes the lead’s name. Follow-ups stop when the lead replies or books a visit.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>3. Sending hours
              <div className="mt-1 flex items-center gap-2">
                <select value={cfg.startHour} onChange={(e) => set({ startHour: Number(e.target.value) })} className="input-field !py-1.5 text-sm">{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>
                <span className="text-xs">se</span>
                <select value={cfg.endHour} onChange={(e) => set({ endHour: Number(e.target.value) })} className="input-field !py-1.5 text-sm">{Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>
              </div>
            </label>
            <label className={label}>Time zone
              <select value={cfg.timezone} onChange={(e) => set({ timezone: e.target.value })} className="input-field mt-1 !py-1.5 text-sm">
                {['Asia/Kolkata', 'Asia/Dubai', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London'].map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
            {cfg.mode === 'auto' && (
              <label className={label}>Template (after 24 hours)
                <select value={cfg.templateName ? `${cfg.templateName}::${cfg.templateLanguage}` : ''} onChange={(e) => pickTemplate(e.target.value)} className="input-field mt-1 !py-1.5 text-sm">
                  <option value="">None (reminder only)</option>
                  {usable.map((t) => <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>{t.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="space-y-2 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
              <input type="checkbox" checked={cfg.reengage?.enabled !== false} onChange={(e) => set({ reengage: { ...cfg.reengage, enabled: e.target.checked } })} />
              4. Re-engage leads who said "not now"
            </label>
            {cfg.reengage?.enabled !== false && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
                  {(cfg.reengage?.gapsDays || [7, 30]).map((d, i) => (
                    <span key={i} className="flex items-center gap-1">{i === 0 ? 'First' : 'Second'} <input type="number" min={1} max={120} value={d} onChange={(e) => { const g = [...(cfg.reengage?.gapsDays || [7, 30])]; g[i] = Number(e.target.value); set({ reengage: { ...cfg.reengage, gapsDays: g } }); }} className="w-16 rounded-lg border border-ink-200 px-2 py-1 text-center text-sm dark:border-ink-700 dark:bg-ink-800" /> days later</span>
                  ))}
                </div>
                <textarea rows={2} value={cfg.reengage?.message || ''} onChange={(e) => set({ reengage: { ...cfg.reengage, message: e.target.value } })} placeholder={'Hi {name}! Last time you mentioned it wasn’t the right time. We have some new options — would you like to see them?'} className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white" />
                <p className="text-[11px] text-ink-500">Customers who reply <b>STOP</b> are never messaged again (WhatsApp rule).</p>
              </>
            )}
          </div>
          {cfg.mode === 'auto' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">WhatsApp rule: after 24 hours without a reply, only approved templates can be sent. Without a template, you’ll get a notification instead.</p>}
        </>
      )}

      <button type="button" onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save setup</button>
    </section>
  );
}
