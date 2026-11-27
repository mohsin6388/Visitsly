import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bot, UserCog, BellRing, Loader2, Mail, ChevronDown } from 'lucide-react';

import { settingsApi } from '../../api/settingsApi.js';
import { AssistantSettings } from '../assistant/AssistantScriptEditor.jsx';
import { whatsappApi } from '../../api/whatsappApi.js';
import { emailApi } from '../../api/emailApi.js';

/** Small reusable ON/OFF switch — no design-system toggle exists yet in this app. */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'bg-brand-600' : 'bg-ink-200 dark:bg-ink-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

const DELAY_OPTIONS = [2, 5, 10];

function OwnerAlerts({ settings, setSettings, patchSettings, saving }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  useEffect(() => { whatsappApi.templates().then((r) => setTemplates(r.data?.templates || [])).catch(() => {}); }, []);
  const alertOn = { hotLead: true, visitBooked: true, visitConfirmed: true, ...(settings?.alertOn || {}) };
  const tpl = settings?.alertTemplate || {};
  const bodyText = (t) => (t?.components || []).find((c) => String(c.type).toUpperCase() === 'BODY')?.text || '';
  const vars = (t) => Math.max(0, ...[...String(bodyText(t)).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
  const test = async () => {
    setTesting(true); setTestMsg('');
    try { const r = await settingsApi.testAlert(); setTestMsg(r.message); } catch (e) { setTestMsg(e?.response?.data?.message || 'Test alert failed'); } finally { setTesting(false); }
  };
  const active = ['hotLead', 'visitBooked', 'visitConfirmed'].filter((k) => alertOn[k] !== false).length;
  return (
    <section className="border-t border-ink-100 dark:border-ink-800">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><BellRing size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-900 dark:text-white">Instant WhatsApp alerts</span>
          <span className="block truncate text-xs text-ink-500 dark:text-ink-400">{active} of 3 alerts on · to {String(settings?.leadAlertPhone || '').trim() || 'company phone'}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
      <div className="px-4 pb-4">
        <div className="min-w-0">
          <p className="text-xs text-ink-500 dark:text-ink-400">Get a WhatsApp with the customer’s name, number and requirement when a lead turns hot or a visit is booked or confirmed.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-600 dark:text-ink-300">Your WhatsApp number (comma-separate multiple)</label>
              <input className="input-field" inputMode="tel" placeholder="9876543210, 9123456780" value={settings?.leadAlertPhone || ''} onChange={(e) => setSettings((prev) => ({ ...prev, leadAlertPhone: e.target.value }))} />
              <p className="mt-1 text-[11px] text-ink-400">Blank = company phone number.</p>
            </div>
            <div><label className="mb-1 block text-xs font-semibold text-ink-600 dark:text-ink-300">Lead alert for</label><select className="input-field" value={settings?.leadAlertLevel || 'hot'} onChange={(e) => setSettings((prev) => ({ ...prev, leadAlertLevel: e.target.value }))}><option value="hot">Hot leads only</option><option value="hot_warm">Hot or warm leads</option></select></div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[['hotLead', '🔥 Hot lead'], ['visitBooked', '📅 Visit booked'], ['visitConfirmed', '✅ Visit confirmed / cancelled']].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700"><input type="checkbox" checked={alertOn[k] !== false} onChange={(e) => setSettings((prev) => ({ ...prev, alertOn: { ...alertOn, [k]: e.target.checked } }))} />{label}</label>
            ))}
          </div>
          <label className="mt-3 block text-xs font-semibold text-ink-600 dark:text-ink-300">Alert template (when your 24-hour window is closed)
            <select className="input-field mt-1" value={tpl.name ? `${tpl.name}::${tpl.language}` : ''} onChange={(e) => { const t = templates.find((x) => `${x.name}::${x.language}` === e.target.value); setSettings((prev) => ({ ...prev, alertTemplate: t ? { name: t.name, language: t.language, variableCount: Math.min(5, vars(t)) } : { name: '', language: '', variableCount: 0 } })); }}>
              <option value="">None (free message + email backup only)</option>
              {templates.map((t) => <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>{t.name} · {t.language}</option>)}
            </select>
            <span className="mt-1 block font-normal text-ink-400">Tip: send "Hi" from your personal number to the business WhatsApp — alerts are free for 24 hours. Templates work anytime. Variables: {'{{1}}'} name · {'{{2}}'} phone · {'{{3}}'} email · {'{{4}}'} score · {'{{5}}'} summary.</span>
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" disabled={saving} onClick={() => patchSettings({ leadAlertPhone: String(settings?.leadAlertPhone || '').trim(), leadAlertLevel: settings?.leadAlertLevel === 'hot_warm' ? 'hot_warm' : 'hot', alertOn, alertTemplate: { name: settings?.alertTemplate?.name || '', language: settings?.alertTemplate?.language || '', variableCount: settings?.alertTemplate?.variableCount || 0 } })} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" disabled={testing} onClick={test} className="btn-secondary">{testing ? 'Sending…' : 'Send test alert'}</button>
          </div>
          {testMsg && <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700 [overflow-wrap:anywhere] dark:bg-ink-800 dark:text-ink-200">{testMsg}</p>}
        </div>
      </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [emailStatus, setEmailStatus] = useState(null);
  const [emailStatusLoading, setEmailStatusLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await settingsApi.get();
      setSettings(res.data.settings);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmailStatus = useCallback(async () => {
    setEmailStatusLoading(true);
    try {
      const res = await emailApi.status();
      setEmailStatus(res.data.sender);
    } catch {
      setEmailStatus(null);
    } finally {
      setEmailStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchEmailStatus();
  }, [fetchSettings, fetchEmailStatus]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const patchSettings = async (updates) => {
    setSaving(true);
    setError('');
    // Optimistic update so toggles feel instant.
    setSettings((prev) => ({ ...prev, ...updates }));
    try {
      const res = await settingsApi.update(updates);
      setSettings(res.data.settings);
      showToast('Saved');
    } catch (err) {
      setError(err?.response?.data?.message || 'Update failed');
      fetchSettings(); // roll back to server truth
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-ink-400" size={28} />
      </div>
    );
  }

  const Row = ({ icon: Icon, tone, title, help, children }) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900 dark:text-white">{title}</p>
        <p className="text-xs text-ink-500 dark:text-ink-400">{help}</p>
      </div>
      {children}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">AI replies, alerts and email.</p>
        </div>
        {toast && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
            {toast}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-5 divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900">
        <Row icon={Bot} tone="bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300" title="AI auto reply" help="AI replies to new WhatsApp messages automatically.">
          <Toggle checked={!!settings?.autoReplyEnabled} disabled={saving} onChange={(val) => patchSettings({ autoReplyEnabled: val })} />
        </Row>
        <div>
          <Row icon={UserCog} tone="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300" title="Human takeover" help="Pause the AI and handle every chat yourself until you turn it off.">
            <Toggle checked={!!settings?.aiPaused} disabled={saving} onChange={(val) => patchSettings({ aiPaused: val })} />
          </Row>
          {settings?.aiPaused && <p className="mx-4 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">AI is paused — no auto-replies are being sent.</p>}
        </div>
        <Row icon={Mail} tone="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" title="Email" help={emailStatusLoading ? 'Checking…' : emailStatus?.email ? `Campaigns send from ${emailStatus.email}${emailStatus.ready ? '' : ' (setup not finished)'}` : 'No sender email set up'}>
          <Link to="/email/setup" className="btn-secondary !py-1.5 text-xs">{emailStatus?.email ? 'Manage' : 'Set up'}</Link>
        </Row>
        <AssistantSettings settings={settings} patchSettings={patchSettings} saving={saving} />
        <OwnerAlerts settings={settings} setSettings={setSettings} patchSettings={patchSettings} saving={saving} />
      </div>
    </div>
  );
}
