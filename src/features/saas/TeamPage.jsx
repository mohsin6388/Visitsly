import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus, Copy, KeyRound, X, Building, Users } from 'lucide-react';
import { orgApi } from '../../api/saasApi.js';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';
import { ROLE_LABEL, ROLE_HELP, fmtDate } from '../../lib/saas.jsx';

function CompanyProfile() {
  const org = useAuthStore((s) => s.org);
  const setOrg = useAuthStore((s) => s.setOrg);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (org && !form) setForm({ name: org.name || '', city: org.city || '', businessType: org.businessType || 'broker', gstin: org.gstin || '', billingEmail: org.billingEmail || '', phone: org.phone || '' });
  }, [org, form]);
  if (!form) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await orgApi.update(form);
      setOrg(res.data.org);
      setMsg({ ok: true, text: 'Company details save ho gaye' });
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Save nahi hua' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="card min-w-0">
      <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><Building size={18} /> Company details</h2>
      <p className="mt-1 text-sm text-ink-500">Ye naam AI chats, emails aur invoices par dikhta hai.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Company name</span><input className="input-field" required value={form.name} onChange={set('name')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">City</span><input className="input-field" value={form.city} onChange={set('city')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Business type</span>
          <select className="input-field" value={form.businessType} onChange={set('businessType')}><option value="broker">Broker</option><option value="agency">Agency</option><option value="builder">Builder</option><option value="other">Other</option></select>
        </label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">GSTIN (invoice ke liye)</span><input className="input-field font-mono uppercase" maxLength={15} value={form.gstin} onChange={set('gstin')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Billing email</span><input type="email" className="input-field" value={form.billingEmail} onChange={set('billingEmail')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Phone</span><input className="input-field" value={form.phone} onChange={set('phone')} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary gap-2" disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />}Save</button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

function CredentialBox({ cred, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = `Visitsly login\n${cred.loginUrl || `${window.location.origin}/login`}\nEmail: ${cred.email}\nPassword: ${cred.password}\n(Pehli baar login ke baad password badal lijiye)`;
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900 dark:bg-green-900/20 dark:text-green-100">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{cred.title}</p>
        <button onClick={onClose} aria-label="Close" className="text-green-800"><X size={16} /></button>
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-white/70 p-3 font-mono text-xs dark:bg-ink-900">{text}</pre>
      <p className="mt-2 text-xs">Ye password sirf abhi dikhega — copy karke teammate ko bhej dijiye.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={copy} className="btn-secondary gap-2 !py-1.5"><Copy size={14} />{copied ? 'Copied' : 'Copy'}</button>
        <a className="btn-primary !py-1.5" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>WhatsApp par bhejein</a>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const qc = useQueryClient();
  const myRole = useOrgRole();
  const org = useAuthStore((s) => s.org);
  const me = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({ queryKey: ['team'], queryFn: orgApi.team });
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cred, setCred] = useState(null);

  const members = data?.data?.items || [];
  const active = members.filter((m) => m.isActive).length;
  const limit = org?.limits?.users;

  const submitInvite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await orgApi.invite(invite);
      setCred({ title: `${res.data.member.name} add ho gaye`, email: res.data.member.email, password: res.data.tempPassword, loginUrl: res.data.loginUrl });
      setInvite(null);
      qc.invalidateQueries({ queryKey: ['team'] });
    } catch (err) {
      setError(err?.response?.data?.message || 'Add nahi hua');
    } finally {
      setBusy(false);
    }
  };

  const update = async (m, payload) => {
    setError('');
    try {
      await orgApi.updateMember(m.id, payload);
      qc.invalidateQueries({ queryKey: ['team'] });
    } catch (err) {
      setError(err?.response?.data?.message || 'Update nahi hua');
    }
  };

  const resetPw = async (m) => {
    if (!window.confirm(`${m.name} ka naya temporary password banayein? Purana password kaam nahi karega.`)) return;
    try {
      const res = await orgApi.resetMemberPassword(m.id);
      setCred({ title: `${m.name} ka naya password`, email: m.email, password: res.data.tempPassword });
    } catch (err) {
      setError(err?.response?.data?.message || 'Reset nahi hua');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Company & Team</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Company details aur kaun-kaun Visitsly use kar sakta hai.</p>
      </div>

      <CompanyProfile />

      <section className="card min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><Users size={18} /> Team</h2>
            <p className="mt-1 text-sm text-ink-500">{active} / {limit ?? 'Unlimited'} users is plan mein</p>
          </div>
          <button className="btn-primary gap-2" onClick={() => { setInvite({ name: '', email: '', phone: '', orgRole: 'agent' }); setCred(null); }} disabled={limit != null && active >= limit} title={limit != null && active >= limit ? 'User limit poori — plan upgrade karein' : undefined}>
            <UserPlus size={16} /> Add teammate
          </button>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {cred && <div className="mt-4"><CredentialBox cred={cred} onClose={() => setCred(null)} /></div>}

        {invite && (
          <form onSubmit={submitInvite} className="mt-4 grid gap-3 rounded-xl border border-ink-100 p-4 dark:border-ink-800 sm:grid-cols-2">
            <input className="input-field" placeholder="Naam" required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
            <input className="input-field" type="email" placeholder="Email (login ke liye)" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <input className="input-field" placeholder="Mobile (optional)" value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} />
            <select className="input-field" value={invite.orgRole} onChange={(e) => setInvite({ ...invite, orgRole: e.target.value })}>
              <option value="agent">Agent — {ROLE_HELP.agent}</option>
              {myRole === 'owner' && <option value="manager">Manager — {ROLE_HELP.manager}</option>}
            </select>
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn-primary gap-2" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Add</button>
              <button type="button" className="btn-secondary" onClick={() => setInvite(null)}>Cancel</button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ink-400" /></div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-ink-400"><tr><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Last login</th><th className="py-2 pr-3">Status</th><th className="py-2" /></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {members.map((m) => {
                  const isOwner = m.orgRole === 'owner';
                  const isMe = me?._id === m.id;
                  return (
                    <tr key={m.id} className={m.isActive ? '' : 'opacity-60'}>
                      <td className="py-2.5 pr-3"><p className="font-medium text-ink-900 dark:text-white">{m.name}{isMe && <span className="ml-1 text-xs text-ink-400">(aap)</span>}</p><p className="text-xs text-ink-500">{m.email}</p></td>
                      <td className="py-2.5 pr-3">
                        {isOwner || myRole !== 'owner' ? <span className="font-medium">{ROLE_LABEL[m.orgRole]}</span> : (
                          <select aria-label={`Role for ${m.name}`} className="input-field !w-auto !py-1.5" value={m.orgRole} onChange={(e) => update(m, { orgRole: e.target.value })}>
                            <option value="manager">Manager</option><option value="agent">Agent</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-500">{m.lastLoginAt ? fmtDate(m.lastLoginAt) : 'Kabhi nahi'}</td>
                      <td className="py-2.5 pr-3">{m.isActive ? <span className="text-green-700 dark:text-green-400">Active</span> : <span className="text-ink-500">Removed</span>}</td>
                      <td className="py-2.5 text-right">
                        {!isOwner && (
                          <div className="flex justify-end gap-2">
                            <button className="btn-secondary !px-2.5 !py-1.5" onClick={() => resetPw(m)} title="Naya password"><KeyRound size={14} /></button>
                            <button className="btn-secondary !py-1.5 text-xs" onClick={() => update(m, { isActive: !m.isActive })}>{m.isActive ? 'Remove' : 'Restore'}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ul className="mt-4 grid gap-2 text-xs text-ink-500 sm:grid-cols-3">
          {Object.entries(ROLE_HELP).map(([k, v]) => <li key={k}><strong className="text-ink-700 dark:text-ink-200">{ROLE_LABEL[k]}:</strong> {v}</li>)}
        </ul>
      </section>
    </div>
  );
}
