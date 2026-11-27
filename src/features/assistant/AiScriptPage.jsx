import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RotateCcw, Info } from 'lucide-react';

import { settingsApi } from '../../api/settingsApi.js';
import { useOrgRole } from '../../store/authStore.js';
import { confirmDialog, toast } from '../../components/ui/index.jsx';
import { AssistantSettings, INSTRUCTIONS_MAX } from './AssistantScriptEditor.jsx';

// Short starter examples (placeholders only — the user edits them; nothing is saved until they press Save).
const EXAMPLES = {
  Broker: [
    'Be polite and friendly, like a trusted local property advisor. Ask budget, preferred area (City X) and BHK first. Suggest 2-3 matching options from my listings, then invite the customer for a site visit.',
    'Keep replies short (2-3 lines). Mention that I handle resale and new projects across City X. Never pressure; offer a visit on weekends.',
    'Speak simply and warmly. If the customer is only exploring, share one good option and ask when they are free to visit. Offer to arrange a call with me.',
  ],
  Builder: [
    'We are the builder of Project A in City X. Highlight RERA approval, possession date and amenities. Always invite the customer to visit the sample flat.',
    'Be professional and confident. Share only price ranges from the project data, and offer a site visit with our sales team for exact quotes and offers.',
    'Ask the customer for their budget and BHK need. Explain payment plans in simple words and mention the connectivity of Project A. Close by booking a visit slot.',
  ],
  Agency: [
    'We are a real estate agency with many projects in City X. Understand the customer needs first (budget, area, purpose), then recommend the best 2 matching projects.',
    'Sound like a helpful consultant, not a salesperson. Compare options honestly using our data and suggest a combined site visit to see more than one project.',
    'Keep the tone friendly and quick. Reply in the customer\'s language. Collect name, budget and visit day, and tell them our executive will confirm.',
  ],
};

export default function AiScriptPage() {
  const role = useOrgRole();
  const allowed = role === 'owner';
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [kind, setKind] = useState('Broker');
  const [draft, setDraft] = useState(null); // {text, n} fills the editor textarea without saving

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSettings((await settingsApi.get()).data.settings); }
    catch (e) { setError(e?.response?.data?.message || 'Could not load your AI script.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed, load]);

  const patch = async (updates, successMessage = 'Saved! Your AI script has been updated.') => {
    setSaving(true); setError('');
    try {
      const res = await settingsApi.update(updates);
      setSettings(res.data.settings);
      setToastMsg('Saved'); setTimeout(() => setToastMsg(''), 2500);
      toast.success(successMessage);
    } catch (e) {
      setError(e?.response?.data?.message || 'Update failed');
      toast.error(e?.response?.data?.message || 'Could not save. Please try again.');
    }
    finally { setSaving(false); }
  };

  if (!allowed) return <div className="mx-auto max-w-2xl rounded-xl border border-ink-100 bg-white p-6 text-sm text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300">Only the company owner can change the AI chat script.</div>;
  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-ink-400" size={28} /></div>;

  const a = settings?.assistant || {};
  const custom = Boolean(String(a.instructions || '').trim());
  const reset = async () => {
    if (!(await confirmDialog({ title: 'Reset to Visitsly default?', message: 'Your custom instructions will be removed. The bot name, gender and language stay as they are.', confirmLabel: 'Reset', danger: true }))) return;
    patch({ assistant: { name: a.name || '', gender: a.gender || 'female', defaultLanguage: a.defaultLanguage || '', instructions: '' } }, 'Reset to Visitsly default.');
  };
  // Shown in the editor via a merged settings object: examples only fill the box, never save.
  const view = draft ? { ...settings, assistant: { ...a, instructions: draft.text } } : settings;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">AI chat script</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Tell the WhatsApp AI how to talk to your customers.</p>
        </div>
        <div className="flex items-center gap-2">
          {toastMsg && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{toastMsg}</span>}
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${custom ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>{custom ? 'Custom script ON' : 'Using Visitsly default'}</span>
        </div>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      <section className="rounded-xl border border-ink-100 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900">
        <p className="text-sm font-semibold text-ink-900 dark:text-white">Start from an example</p>
        <p className="text-xs text-ink-500 dark:text-ink-400">Click one to fill the box below. Nothing is saved until you press Save.</p>
        <div className="mt-2 flex gap-2">
          {Object.keys(EXAMPLES).map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === k ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'}`}>{k}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES[kind].map((t, i) => <button key={i} type="button" title={t} onClick={() => setDraft({ text: t.slice(0, INSTRUCTIONS_MAX), n: Date.now() })} className="rounded-lg border border-ink-200 px-3 py-1.5 text-left text-xs text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">{kind} example {i + 1}</button>)}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-ink-100 bg-white pt-4 shadow-card dark:border-ink-800 dark:bg-ink-900">
        <AssistantSettings key={draft?.n || 'saved'} settings={view} patchSettings={(u) => { setDraft(null); return patch(u); }} saving={saving} alwaysOpen />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 text-xs text-ink-500 dark:text-ink-400"><Info size={14} className="mt-0.5 shrink-0" />Your script is added on top of Visitsly's built-in rules. The AI still uses only your real property data, never lies, and keeps the customer's language.</p>
        <button type="button" disabled={saving || !custom} onClick={reset} className="btn-secondary gap-1.5 !py-1.5 text-xs"><RotateCcw size={13} /> Reset to default</button>
      </div>
      <p className="text-xs text-ink-400">Bot name, gender and language are also in <Link className="underline" to="/settings">Settings</Link>.</p>
    </div>
  );
}
