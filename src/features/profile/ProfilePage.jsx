import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';

import { authApi } from '../../api/authApi.js';
import { settingsApi } from '../../api/settingsApi.js';
import { useAuthStore } from '../../store/authStore.js';

/** Bilkul basic profile: company, phone, password. Baaki sab Settings me. */
export default function ProfilePage() {
  const { setSession, accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    Promise.all([authApi.me(), settingsApi.get()])
      .then(([me, st]) => {
        setEmail(me.data.user.email || '');
        setPhone(me.data.user.phone || '');
        setCompanyName(st.data.settings.companyName || '');
      })
      .catch((err) => setMsg({ ok: false, text: err?.response?.data?.message || 'Profile load nahi ho paayi' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const [profileRes] = await Promise.all([authApi.updateProfile({ phone }), settingsApi.update({ companyName })]);
      setSession(profileRes.data.user, accessToken);
      setMsg({ ok: true, text: 'Save ho gaya' });
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Save nahi hua' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-ink-400" size={28} /></div>;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">My profile</h1>
      {msg && <p className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>{msg.text}</p>}

      <form onSubmit={handleSave} className="card space-y-4">
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Company
          <input className="input-field mt-1" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Email
          <input readOnly className="input-field mt-1 cursor-not-allowed opacity-70" value={email} />
        </label>
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Phone
          <input className="input-field mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
        </label>
        <button type="submit" disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save
        </button>
      </form>

      <ChangePasswordForm />
    </div>
  );
}

function ChangePasswordForm() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [state, setState] = useState({ busy: false, msg: null });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, msg: null });
    try {
      await authApi.changePassword(form);
      setForm({ currentPassword: '', newPassword: '' });
      if (user) setUser({ ...user, mustChangePassword: false });
      setState({ busy: false, msg: { ok: true, text: 'Password badal gaya' } });
    } catch (err) {
      const d = err?.response?.data;
      setState({ busy: false, msg: { ok: false, text: d?.details?.[0]?.message || d?.message || 'Password nahi badla' } });
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Password badlein</h2>
      {user?.mustChangePassword && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">Aap temporary password se login hain, naya password set kar lijiye.</p>}
      <input type="password" autoComplete="current-password" className="input-field" placeholder="Purana password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
      <input type="password" autoComplete="new-password" className="input-field" placeholder="Naya password (8+, 1 capital, 1 number)" required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={state.busy}>Change password</button>
        {state.msg && <span className={`text-sm ${state.msg.ok ? 'text-green-700' : 'text-red-600'}`}>{state.msg.text}</span>}
      </div>
    </form>
  );
}
