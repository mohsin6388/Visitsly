import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, Sparkles, UserRound } from 'lucide-react';

import { settingsApi } from '../../api/settingsApi.js';
import { LANGUAGES, languageLabel } from '../../lib/languages.js';

const LANGUAGE_OPTIONS = ['', ...LANGUAGES.map((l) => l.name)];
export const INSTRUCTIONS_MAX = 1500;

/** The company's own WhatsApp AI assistant: name, voice (Hindi verbs) and its own instructions. */
export function AssistantSettings({ settings, patchSettings, saving, alwaysOpen = false }) {
  const saved = settings?.assistant || {};
  const [openState, setOpen] = useState(false);
  const open = alwaysOpen || openState; // alwaysOpen: the dedicated AI chat script page shows the editor without the collapsible header
  const [form, setForm] = useState({ name: saved.name || '', gender: saved.gender || 'female', defaultLanguage: saved.defaultLanguage || '', instructions: saved.instructions || '' });
  const [improving, setImproving] = useState(false);
  const [preview, setPreview] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setForm({ name: saved.name || '', gender: saved.gender || 'female', defaultLanguage: saved.defaultLanguage || '', instructions: saved.instructions || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.name, saved.gender, saved.defaultLanguage, saved.instructions]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = form.name !== (saved.name || '') || form.gender !== (saved.gender || 'female') || form.defaultLanguage !== (saved.defaultLanguage || '') || form.instructions !== (saved.instructions || '');

  const improve = async () => {
    setMsg('');
    setPreview('');
    const text = [form.defaultLanguage && `Default language: ${form.defaultLanguage}`, form.instructions].filter(Boolean).join('\n');
    if (text.trim().length < 5) { setMsg('Write a few lines first (tone, language, what to highlight, offers).'); return; }
    setImproving(true);
    try {
      const r = await settingsApi.improveAssistant(text);
      setPreview(r.data?.improved || '');
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Could not improve the text right now.');
    } finally {
      setImproving(false);
    }
  };

  const save = () => patchSettings({ assistant: { name: form.name.trim(), gender: form.gender, defaultLanguage: form.defaultLanguage, instructions: form.instructions.slice(0, INSTRUCTIONS_MAX) } });

  return (
    <div>
      {!alwaysOpen && <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"><UserRound size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900 dark:text-white">AI assistant</p>
          <p className="text-xs text-ink-500 dark:text-ink-400">Name: {saved.name || 'Monica'} · {saved.gender === 'male' ? 'Male' : 'Female'}{saved.instructions ? ' · custom instructions on' : ''}</p>
        </div>
        <ChevronDown size={16} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>}
      {open && (
        <div className="space-y-4 px-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300">Bot name
              <input className="input-field mt-1 w-full" maxLength={40} placeholder="Monica" value={form.name} onChange={set('name')} />
            </label>
            <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300">Male / Female
              <select className="input-field mt-1 w-full" value={form.gender} onChange={set('gender')}>
                <option value="female">Female (kar rahi hoon)</option>
                <option value="male">Male (kar raha hoon)</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300">Default language
              <select className="input-field mt-1 w-full" value={form.defaultLanguage} onChange={set('defaultLanguage')}>
                {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l ? languageLabel(l) : 'None (region default)'}</option>)}
              </select>
            </label>
          </div>
          <p className="-mt-2 text-[11px] text-ink-400">Used only before a customer has written (opening messages, calls to uploaded contacts). Once they write, the AI replies in their language — if their first message is in English it asks once which language they prefer — and saves it for every message, reminder and call.</p>
          <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300">Your instructions for the AI <span className="font-normal text-ink-400">({form.instructions.length}/{INSTRUCTIONS_MAX})</span>
            <textarea className="input-field mt-1 min-h-[130px] w-full" maxLength={INSTRUCTIONS_MAX} value={form.instructions} onChange={set('instructions')}
              placeholder={'Example: Polite and friendly. We sell 2 & 3 BHK flats in Noida Sector 150. Highlight metro nearby and RERA approval. Always invite for a site visit on weekends.'} />
          </label>
          <p className="-mt-2 text-[11px] text-ink-400">Your text is added on top of Visitsly's built-in rules. The AI still uses only your real property data, never lies and keeps the customer's chosen language.</p>
          {msg && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{msg}</p>}
          {preview && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="mb-1 text-xs font-semibold text-emerald-800">Improved version — check it, then use it</p>
              <pre className="whitespace-pre-wrap font-sans text-xs text-ink-700">{preview}</pre>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-primary !py-1.5 text-xs" onClick={() => { setForm((f) => ({ ...f, instructions: preview.slice(0, INSTRUCTIONS_MAX) })); setPreview(''); }}>Use this</button>
                <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setPreview('')}>Keep mine</button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary gap-1.5 !py-1.5 text-xs" disabled={improving} onClick={improve}>
              {improving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Improve my prompt
            </button>
            <button type="button" className="btn-primary !py-1.5 text-xs" disabled={saving || !dirty} onClick={save}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssistantSettings;
