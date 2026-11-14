import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Timer,
  UserCog,
  Smartphone,
  BellRing,
  CheckCircle2,
  XCircle,
  Loader2,
  PowerOff,
  Power,
  Mail,
  AlertTriangle,
} from 'lucide-react';

import { settingsApi } from '../../api/settingsApi.js';
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
    try { const r = await settingsApi.testAlert(); setTestMsg(r.message); } catch (e) { setTestMsg(e?.response?.data?.message || 'Test alert nahi gaya'); } finally { setTesting(false); }
  };
  return (
    <div className="card mt-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><BellRing size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">Aapke WhatsApp par turant alert</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Lead HOT hote hi, site visit book / confirm hote hi aapke number par WhatsApp aayega — customer ka naam, number aur requirement ke saath.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-600 dark:text-ink-300">Aapka WhatsApp number (ek se zyada ho to comma lagayein)</label>
              <input className="input-field" inputMode="tel" placeholder="9876543210, 9123456780" value={settings?.leadAlertPhone || ''} onChange={(e) => setSettings((prev) => ({ ...prev, leadAlertPhone: e.target.value }))} />
              <p className="mt-1 text-[11px] text-ink-400">Khali chhodenge to company ka phone number use hoga.</p>
            </div>
            <div><label className="mb-1 block text-xs font-semibold text-ink-600 dark:text-ink-300">Lead alert kab</label><select className="input-field" value={settings?.leadAlertLevel || 'hot'} onChange={(e) => setSettings((prev) => ({ ...prev, leadAlertLevel: e.target.value }))}><option value="hot">Sirf Hot lead par</option><option value="hot_warm">Hot ya Warm lead par</option></select></div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[['hotLead', '🔥 Hot lead'], ['visitBooked', '📅 Visit book hui'], ['visitConfirmed', '✅ Visit confirm / cancel']].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-700"><input type="checkbox" checked={alertOn[k] !== false} onChange={(e) => setSettings((prev) => ({ ...prev, alertOn: { ...alertOn, [k]: e.target.checked } }))} />{label}</label>
            ))}
          </div>
          <label className="mt-3 block text-xs font-semibold text-ink-600 dark:text-ink-300">Alert template (jab aapke number ka 24 ghante wala window band ho)
            <select className="input-field mt-1" value={tpl.name ? `${tpl.name}::${tpl.language}` : ''} onChange={(e) => { const t = templates.find((x) => `${x.name}::${x.language}` === e.target.value); setSettings((prev) => ({ ...prev, alertTemplate: t ? { name: t.name, language: t.language, variableCount: Math.min(5, vars(t)) } : { name: '', language: '', variableCount: 0 } })); }}>
              <option value="">Koi nahi (sirf free message + email backup)</option>
              {templates.map((t) => <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>{t.name} · {t.language}</option>)}
            </select>
            <span className="mt-1 block font-normal text-ink-400">Tip: Apne personal number se business WhatsApp par ek baar "Hi" bhej dijiye — 24 ghante tak alerts free mein aayenge. Template se alerts kabhi bhi aate hain. Variables: {'{{1}}'} naam · {'{{2}}'} phone · {'{{3}}'} email · {'{{4}}'} score · {'{{5}}'} summary.</span>
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" disabled={saving} onClick={() => patchSettings({ leadAlertPhone: String(settings?.leadAlertPhone || '').trim(), leadAlertLevel: settings?.leadAlertLevel === 'hot_warm' ? 'hot_warm' : 'hot', alertOn, alertTemplate: { name: settings?.alertTemplate?.name || '', language: settings?.alertTemplate?.language || '', variableCount: settings?.alertTemplate?.variableCount || 0 } })} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" disabled={testing} onClick={test} className="btn-secondary">{testing ? 'Bhej rahe hain…' : 'Test alert bhejein'}</button>
          </div>
          {testMsg && <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700 dark:bg-ink-800 dark:text-ink-200">{testMsg}</p>}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(true);
  const [waBusy, setWaBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailStatusLoading, setEmailStatusLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await settingsApi.get();
      setSettings(res.data.settings);
    } catch (err) {
      setError(err?.response?.data?.message || 'Settings load nahi ho paayi');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmailStatus = useCallback(async () => {
    setEmailStatusLoading(true);
    try {
      const res = await emailApi.account();
      setEmailStatus(res.data.account);
    } catch {
      setEmailStatus(null);
    } finally {
      setEmailStatusLoading(false);
    }
  }, []);

  const fetchWaStatus = useCallback(async () => {
    setWaLoading(true);
    try {
      const res = await whatsappApi.status();
      setWaStatus(res.data);
    } catch {
      setWaStatus(null);
    } finally {
      setWaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchWaStatus();
    fetchEmailStatus();
  }, [fetchSettings, fetchWaStatus, fetchEmailStatus]);

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
      setError(err?.response?.data?.message || 'Update fail ho gaya');
      fetchSettings(); // roll back to server truth
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('WhatsApp disconnect karein? AI aur manual dono replies rukk jaayenge jab tak reconnect nahi karte.')) return;
    setWaBusy(true);
    try {
      await whatsappApi.disconnect();
      await fetchWaStatus();
      showToast('WhatsApp disconnected');
    } catch (err) {
      alert(err?.response?.data?.message || 'Disconnect fail ho gaya');
    } finally {
      setWaBusy(false);
    }
  };

  const handleReconnect = async () => {
    setWaBusy(true);
    try {
      await whatsappApi.reconnect();
      await fetchWaStatus();
      showToast('WhatsApp reconnected');
    } catch (err) {
      alert(err?.response?.data?.message || 'Reconnect fail ho gaya');
    } finally {
      setWaBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-ink-400" size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            AI automation aur official Meta WhatsApp Cloud API yahan se control karein.
          </p>
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

      {/* AI Auto Reply */}
      <div className="card mt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
              <Bot size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-900 dark:text-white">AI Auto Reply</h2>
              <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                Jab ON ho, AI naye WhatsApp messages ka jawab khud-ba-khud deta hai.
              </p>
            </div>
          </div>
          <Toggle
            checked={!!settings?.autoReplyEnabled}
            disabled={saving}
            onChange={(val) => patchSettings({ autoReplyEnabled: val })}
          />
        </div>
      </div>

      {/* Human Takeover */}
      <div className="card mt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
              <UserCog size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-900 dark:text-white">Human Takeover</h2>
              <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                ON karne par AI turant pura pause ho jaata hai — saari conversations aap khud manually
                handle karenge, jab tak wapas OFF na karein.
              </p>
            </div>
          </div>
          <Toggle
            checked={!!settings?.aiPaused}
            disabled={saving}
            onChange={(val) => patchSettings({ aiPaused: val })}
          />
        </div>
        {settings?.aiPaused && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            AI abhi paused hai — koi bhi lead ko auto-reply nahi jaa raha.
          </p>
        )}
      </div>

      {/* Owner WhatsApp alerts */}
      <OwnerAlerts settings={settings} setSettings={setSettings} patchSettings={patchSettings} saving={saving} />

      {/* Email sending: client ka apna official email */}
      <div className="card mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"><Mail size={20} /></span>
            <div>
              <h2 className="text-base font-semibold text-ink-900 dark:text-white">Email</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">{emailStatusLoading ? 'Checking…' : emailStatus?.fromEmail ? `${emailStatus.fromEmail} se campaign jati hai` : 'Official email abhi connect nahi hai'}</p>
            </div>
          </div>
          <Link to="/email/setup" className="btn-secondary">{emailStatus?.fromEmail ? 'Manage' : 'Connect email'}</Link>
        </div>
      </div>

      {/* WhatsApp Settings */}
      <div className="card mt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300">
            <Smartphone size={20} />
          </span>
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">WhatsApp Settings</h2>
        </div>

        {waLoading ? (
          <div className="mt-4 flex justify-center py-6">
            <Loader2 className="animate-spin text-ink-400" size={24} />
          </div>
        ) : !waStatus?.configured ? (
          <p className="mt-4 text-sm text-ink-500 dark:text-ink-400">
            Meta WhatsApp Cloud API abhi configured nahi hai. Backend par META_WHATSAPP_ACCESS_TOKEN aur META_WHATSAPP_PHONE_NUMBER_ID set karein.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between border-b border-ink-50 pb-3 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Connected Number</span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">
                {waStatus.phoneNumber ? `+${waStatus.phoneNumber}` : 'Not available'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-ink-50 pb-3 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Provider</span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">Meta WhatsApp Cloud API</span>
            </div>

            <div className="flex items-center justify-between border-b border-ink-50 pb-3 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Verified Name</span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">
                {waStatus.verifiedName || 'Not available'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-ink-50 pb-3 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Connection Status</span>
              {waStatus.disconnected ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
                  <XCircle size={16} /> Disconnected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400">
                  <CheckCircle2 size={16} /> Connected
                </span>
              )}
            </div>

            <div className="flex justify-end pt-1">
              {waStatus.disconnected ? (
                <button
                  onClick={handleReconnect}
                  disabled={waBusy}
                  className="btn-primary flex items-center gap-2"
                >
                  {waBusy ? <Loader2 className="animate-spin" size={16} /> : <Power size={16} />}
                  Reconnect
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  disabled={waBusy}
                  className="btn-secondary flex items-center gap-2 !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                >
                  {waBusy ? <Loader2 className="animate-spin" size={16} /> : <PowerOff size={16} />}
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
