import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, Mail, Send, Trash2 } from 'lucide-react';
import { emailApi } from '../../api/emailApi.js';
import { useOrgRole } from '../../store/authStore.js';
import { PageTitle, Notice, errText } from '../../lib/saas.jsx';
import { confirmDialog } from '../../components/ui/index.jsx';

// dailyLimit = safe default emails/day (0 = no built-in cap). Same numbers as the backend presets.
const PRESETS = {
  gmail: { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, secure: false, dailyLimit: 450, hint: 'Use an App Password, not your normal password (Google Account → Security → App Passwords). Free Gmail ~500 emails/day, Workspace ~2000.' },
  outlook: { label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false, dailyLimit: 250, hint: 'Your admin must enable "Authenticated SMTP" in Microsoft 365. Use an App Password or normal password, as your account requires.' },
  zoho: { label: 'Zoho Mail (India .in)', host: 'smtp.zoho.in', port: 587, secure: false, dailyLimit: 200, hint: 'Create an app-specific password in Zoho (Accounts → Security).' },
  zoho_com: { label: 'Zoho Mail (.com)', host: 'smtp.zoho.com', port: 587, secure: false, dailyLimit: 200, hint: 'Create an app-specific password in Zoho (Accounts → Security).' },
  yahoo: { label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: 587, secure: false, dailyLimit: 400, hint: 'Yahoo needs an App Password (Account Security).' },
  hostinger: { label: 'Hostinger Email', host: 'smtp.hostinger.com', port: 465, secure: true, dailyLimit: 0, hint: 'Your domain email’s normal password.' },
  godaddy: { label: 'GoDaddy Email', host: 'smtpout.secureserver.net', port: 465, secure: true, dailyLimit: 0, hint: 'Your domain email’s normal password.' },
  brevo: { label: 'Brevo (SMTP relay)', host: 'smtp-relay.brevo.com', port: 587, secure: false, dailyLimit: 0, userRequired: true, hint: 'Brevo → SMTP & API → SMTP: enter the login and SMTP key. The official email must be a verified sender in Brevo.' },
  sendgrid: { label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false, dailyLimit: 0, username: 'apikey', hint: 'Use your SendGrid API key as the password. The official email must be a verified sender.' },
  mailgun: { label: 'Mailgun', host: 'smtp.mailgun.org', port: 587, secure: false, dailyLimit: 0, userRequired: true, hint: 'Enter your Mailgun domain SMTP login and password.' },
  ses: { label: 'Amazon SES', host: '', port: 587, secure: false, dailyLimit: 0, userRequired: true, hint: 'SES SMTP credentials. Use your region’s host, e.g. email-smtp.ap-south-1.amazonaws.com' },
  other: { label: 'Other (any SMTP)', host: '', port: 587, secure: false, dailyLimit: 0, hint: 'Get the SMTP host, port and login from your provider.' },
};

const EMPTY = { preset: 'gmail', fromName: '', fromEmail: '', username: '', password: '', host: 'smtp.gmail.com', port: 587, secure: false, dailyLimit: '' };

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
      setMsg({ ok: false, text: errText(err, 'Could not load email status') });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const pickPreset = (key) => setForm((f) => ({ ...f, preset: key, host: PRESETS[key].host, port: PRESETS[key].port, secure: PRESETS[key].secure, username: PRESETS[key].username || '' }));

  const startEdit = () => {
    const preset = Object.entries(PRESETS).find(([, p]) => p.host && p.host === account?.host)?.[0] || 'other';
    setForm({ preset, fromName: account?.fromName || '', fromEmail: account?.fromEmail || '', username: account?.username && account.username !== account.fromEmail ? account.username : (PRESETS[preset].username || ''), password: '', host: account?.host || '', port: account?.port || 587, secure: Boolean(account?.secure), dailyLimit: account?.dailyLimit || '' });
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
        preset: form.preset,
        username: form.username || undefined,
        dailyLimit: Number(form.dailyLimit) || 0,
        password: form.password,
        host: form.host || preset.host,
        port: Number(form.port) || preset.port,
        secure: Number(form.port) === 465 ? true : form.secure,
      });
      setAccount(res.data.account);
      setEditing(false);
      setMsg({ ok: true, text: 'Email connected. You can now create campaigns.' });
    } catch (err) {
      setMsg({ ok: false, text: errText(err, 'Could not connect email') });
    } finally { setBusy(''); }
  };

  const sendTest = async () => {
    setBusy('test'); setMsg(null);
    try {
      const res = await emailApi.testAccount(testTo.trim() || undefined);
      setMsg({ ok: true, text: res.message || 'Test email sent' });
    } catch (err) {
      setMsg({ ok: false, text: errText(err, 'Test email failed') });
      load();
    } finally { setBusy(''); }
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Remove email account?', message: 'Email campaigns stop until you connect another account.', confirmLabel: 'Remove', danger: true }))) return;
    setBusy('remove');
    try {
      await emailApi.removeAccount();
      setAccount({ connected: false });
      setForm(EMPTY);
      setEditing(true);
      setMsg({ ok: true, text: 'Email account removed.' });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    } finally { setBusy(''); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;

  const preset = PRESETS[form.preset] || PRESETS.other;
  const showHost = !preset.host; // Other / SES: the customer enters the host
  const showUsername = Boolean(preset.userRequired) || form.preset === 'other';

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
                <p className="text-xs text-ink-500">{account.fromName || 'No name set'} · {account.host}</p>
              </div>
            </div>
            {account.connected
              ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={14} /> Connected</span>
              : <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={14} /> Problem</span>}
          </div>
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            Campaign emails sent today: <b>{account.sentToday ?? 0}</b>{account.effectiveDailyLimit ? <> / <b>{account.effectiveDailyLimit}</b> daily limit</> : ' (no daily limit)'}. Remaining emails continue tomorrow morning.
          </div>
          {!account.connected && account.lastError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{account.lastError}</p>}

          {canManage && (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className="input-field flex-1" type="email" placeholder={`Send test to (default: ${account.fromEmail})`} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                <button type="button" onClick={sendTest} disabled={busy === 'test'} className="btn-secondary inline-flex items-center justify-center gap-2">
                  {busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Test email
                </button>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
                <button type="button" onClick={startEdit} className="btn-secondary">Change</button>
                <button type="button" onClick={remove} disabled={busy === 'remove'} className="btn-secondary inline-flex items-center gap-2 text-red-600"><Trash2 size={15} /> Remove</button>
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
          <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">{['gmail', 'outlook', 'zoho', 'zoho_com', 'yahoo'].includes(form.preset) ? 'App Password' : ['sendgrid'].includes(form.preset) ? 'API key' : ['brevo'].includes(form.preset) ? 'SMTP key' : 'Email password'}
            <input className="input-field mt-1.5" type="password" autoComplete="new-password" required={!account?.fromEmail} placeholder={account?.fromEmail ? 'Leave blank to keep current' : ''} value={form.password} onChange={set('password')} />
          </label>
          {preset.hint && <p className="text-xs text-ink-500">{preset.hint}</p>}
          {showUsername && (
            <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">SMTP login / username {form.preset === 'other' && <span className="font-normal text-ink-400">(blank = use email as login)</span>}
              <input className="input-field mt-1.5" required={Boolean(preset.userRequired)} value={form.username} onChange={set('username')} />
            </label>
          )}
          {showHost && (
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">SMTP host
                <input className="input-field mt-1.5" required placeholder="mail.yourcompany.com" value={form.host} onChange={set('host')} />
              </label>
              <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Port
                <select className="input-field mt-1.5" value={form.port} onChange={set('port')}>
                  <option value={587}>587</option><option value={465}>465 (SSL)</option><option value={25}>25</option><option value={2525}>2525</option>
                </select>
              </label>
            </div>
          )}
          <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Max campaign emails per day <span className="font-normal text-ink-400">(blank = {preset.dailyLimit ? `${preset.dailyLimit}, safe default` : 'no limit'})</span>
            <input className="input-field mt-1.5 sm:max-w-[200px]" type="number" min="0" max="100000" placeholder={preset.dailyLimit ? String(preset.dailyLimit) : 'Unlimited'} value={form.dailyLimit} onChange={set('dailyLimit')} />
            <span className="mt-1 block text-xs font-normal text-ink-500">Keep this a little below your provider’s limit to avoid blocks. Remaining emails continue the next day.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary inline-flex items-center gap-2" disabled={busy === 'save'}>
              {busy === 'save' && <Loader2 size={15} className="animate-spin" />}{busy === 'save' ? 'Checking…' : 'Connect email'}
            </button>
            {account?.fromEmail && <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setMsg(null); }}>Cancel</button>}
          </div>
        </form>
      ) : (
        <p className="card text-sm text-ink-500">Only an owner or manager can connect email.</p>
      )}
    </div>
  );
}
