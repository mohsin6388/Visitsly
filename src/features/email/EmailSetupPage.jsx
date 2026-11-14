import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, Mail, Send, Trash2 } from 'lucide-react';
import { emailApi } from '../../api/emailApi.js';
import { useOrgRole } from '../../store/authStore.js';
import { PageTitle, Notice, errText } from '../../lib/saas.jsx';

const PRESETS = {
  gmail: { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false },
  zoho: { label: 'Zoho Mail', host: 'smtp.zoho.in', port: 587, secure: false },
  other: { label: 'Other (Hostinger, GoDaddy, etc.)', host: '', port: 587, secure: false },
};

const EMPTY = { preset: 'gmail', fromName: '', fromEmail: '', password: '', host: '', port: 587, secure: false };

export default function EmailSetupPage() {
  const role = useOrgRole();
  const canManage = role === 'owner' || role === 'manager';
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [testTo, setTestTo] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await emailApi.account();
      setAccount(res.data.account);
      setEditing(!res.data.account?.fromEmail);
    } catch (err) {
      setMsg({ ok: false, text: errText(err, 'Email status load nahi hua') });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const pickPreset = (key) => setForm((f) => ({ ...f, preset: key, host: PRESETS[key].host, port: PRESETS[key].port, secure: PRESETS[key].secure }));

  const startEdit = () => {
    const preset = Object.entries(PRESETS).find(([, p]) => p.host && p.host === account?.host)?.[0] || 'other';
    setForm({ preset, fromName: account?.fromName || '', fromEmail: account?.fromEmail || '', password: '', host: account?.host || '', port: account?.port || 587, secure: Boolean(account?.secure) });
    setEditing(true);
    setMsg(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy('save'); setMsg(null);
    try {
      const preset = PRESETS[form.preset];
      const res = await emailApi.saveAccount({
        fromName: form.fromName,
        fromEmail: form.fromEmail,
        password: form.password,
        host: form.host || preset.host,
        port: Number(form.port) || preset.port,
        secure: Number(form.port) === 465 ? true : form.secure,
      });
      setAccount(res.data.account);
      setEditing(false);
      setMsg({ ok: true, text: 'Email connect ho gaya. Ab campaign bana sakte hain.' });
    } catch (err) {
      setMsg({ ok: false, text: errText(err, 'Email connect nahi ho paaya') });
    } finally { setBusy(''); }
  };

  const sendTest = async () => {
    setBusy('test'); setMsg(null);
    try {
      const res = await emailApi.testAccount(testTo.trim() || undefined);
      setMsg({ ok: true, text: res.message || 'Test email bhej di' });
    } catch (err) {
      setMsg({ ok: false, text: errText(err, 'Test email nahi gayi') });
      load();
    } finally { setBusy(''); }
  };

  const remove = async () => {
    if (!window.confirm('Email account hata dein? Campaigns tab tak band rahenge jab tak naya connect na karein.')) return;
    setBusy('remove');
    try {
      await emailApi.removeAccount();
      setAccount({ connected: false });
      setForm(EMPTY);
      setEditing(true);
      setMsg({ ok: true, text: 'Email account hata diya.' });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    } finally { setBusy(''); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;

  const showAdvanced = form.preset === 'other';

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      <PageTitle title="Email setup" />
      <Notice msg={msg} />

      {account?.fromEmail && !editing ? (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Mail size={20} /></span>
              <div>
                <p className="font-semibold text-ink-900 dark:text-white">{account.fromEmail}</p>
                <p className="text-xs text-ink-500">{account.fromName || 'Name set nahi'} · {account.host}</p>
              </div>
            </div>
            {account.connected
              ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={14} /> Connected</span>
              : <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={14} /> Problem</span>}
          </div>
          {!account.connected && account.lastError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{account.lastError}</p>}

          {canManage && (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className="input-field flex-1" type="email" placeholder={`Test email kahan bhejein? (default: ${account.fromEmail})`} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                <button type="button" onClick={sendTest} disabled={busy === 'test'} className="btn-secondary inline-flex items-center justify-center gap-2">
                  {busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Test email
                </button>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
                <button type="button" onClick={startEdit} className="btn-secondary">Badlein</button>
                <button type="button" onClick={remove} disabled={busy === 'remove'} className="btn-secondary inline-flex items-center gap-2 text-red-600"><Trash2 size={15} /> Hatayein</button>
              </div>
            </>
          )}
        </section>
      ) : canManage ? (
        <form onSubmit={save} className="card space-y-4">
          <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Email provider
            <select className="input-field mt-1.5" value={form.preset} onChange={(e) => pickPreset(e.target.value)}>
              {Object.entries(PRESETS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Sender name
              <input className="input-field mt-1.5" placeholder="Agarwaal Homes" value={form.fromName} onChange={set('fromName')} maxLength={100} />
            </label>
            <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Official email
              <input className="input-field mt-1.5" type="email" required placeholder="info@yourcompany.com" value={form.fromEmail} onChange={set('fromEmail')} />
            </label>
          </div>
          <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">{form.preset === 'other' ? 'Email password' : 'App Password'}
            <input className="input-field mt-1.5" type="password" autoComplete="new-password" required={!account?.fromEmail} placeholder={account?.fromEmail ? 'Wahi rakhne ke liye khali chhodein' : ''} value={form.password} onChange={set('password')} />
          </label>
          {form.preset === 'gmail' && <p className="text-xs text-ink-500">Gmail me <b>App Password</b> chahiye (Google Account → Security → App Passwords).</p>}
          {showAdvanced && (
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">SMTP host
                <input className="input-field mt-1.5" required placeholder="smtp.hostinger.com" value={form.host} onChange={set('host')} />
              </label>
              <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Port
                <select className="input-field mt-1.5" value={form.port} onChange={set('port')}>
                  <option value={587}>587</option><option value={465}>465 (SSL)</option><option value={25}>25</option><option value={2525}>2525</option>
                </select>
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary inline-flex items-center gap-2" disabled={busy === 'save'}>
              {busy === 'save' && <Loader2 size={15} className="animate-spin" />}{busy === 'save' ? 'Check ho raha hai…' : 'Connect email'}
            </button>
            {account?.fromEmail && <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setMsg(null); }}>Cancel</button>}
          </div>
        </form>
      ) : (
        <p className="card text-sm text-ink-500">Email connect karna owner ya manager ka kaam hai.</p>
      )}
    </div>
  );
}
