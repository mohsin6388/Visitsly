import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus, Copy, KeyRound, X, Building, Users, ShieldCheck, Info } from 'lucide-react';
import { orgApi } from '../../api/saasApi.js';
import { useAuthStore, useOrgRole, teamAvailable } from '../../store/authStore.js';
import { PERMISSION_GROUPS, DEFAULT_AGENT_PERMISSIONS } from '../../lib/permissions.js';
import { ROLE_LABEL, ROLE_HELP, fmtDate } from '../../lib/saas.jsx';
import { COUNTRY_OPTIONS } from '../../lib/country.js';
import { confirmDialog, Modal } from '../../components/ui/index.jsx';

function CompanyProfile() {
  const org = useAuthStore((s) => s.org);
  const setOrg = useAuthStore((s) => s.setOrg);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (org && !form) setForm({ name: org.name || '', city: org.city || '', businessType: org.businessType || 'broker', gstin: org.gstin || '', billingEmail: org.billingEmail || '', phone: org.phone || '', country: org.country || 'IN' });
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
      setMsg({ ok: true, text: 'Company details saved' });
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="card min-w-0">
      <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><Building size={18} /> Company details</h2>
      <p className="mt-1 text-sm text-ink-500">Shown on AI chats, emails and invoices.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Company name</span><input className="input-field" required value={form.name} onChange={set('name')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">City</span><input className="input-field" value={form.city} onChange={set('city')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Business type</span>
          <select className="input-field" value={form.businessType} onChange={set('businessType')}><option value="broker">Broker</option><option value="agency">Agency</option><option value="builder">Builder</option><option value="other">Other</option></select>
        </label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">GSTIN (for invoices)</span><input className="input-field font-mono uppercase" maxLength={15} value={form.gstin} onChange={set('gstin')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Billing email</span><input type="email" className="input-field" value={form.billingEmail} onChange={set('billingEmail')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Phone (alerts go here)</span><input className="input-field" value={form.phone} onChange={set('phone')} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-ink-700 dark:text-ink-200">Billing country / currency</span>
          <select className="input-field" value={form.country} onChange={set('country')} disabled={org?.countryLocked !== false || org?.status === 'active'}>{COUNTRY_OPTIONS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
          {org?.countryLocked !== false && <span className="mt-1 block text-xs text-ink-400">Fixed after setup (it decides your billing currency). Contact support to change it.</span>}
        </label>
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
  const url = cred.loginUrl || `${window.location.origin}/login`;
  const list = cred.list || [{ name: cred.name, email: cred.email, password: cred.password }];
  const text = `Visitsly login: ${url}\n\n${list.map((c) => `${c.name ? `${c.name}\n` : ''}Email: ${c.email}\nPassword: ${c.password}`).join('\n\n')}`;
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900 dark:bg-green-900/20 dark:text-green-100">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{cred.title}</p>
        <button onClick={onClose} aria-label="Close" className="text-green-800"><X size={16} /></button>
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-white/70 p-3 font-mono text-xs dark:bg-ink-900">{text}</pre>
      <p className="mt-2 text-xs">This password is shown only once — copy it and share with your teammate.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={copy} className="btn-secondary gap-2 !py-1.5"><Copy size={14} />{copied ? 'Copied' : 'Copy'}</button>
        <a className="btn-primary !py-1.5" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>Share on WhatsApp</a>
      </div>
    </div>
  );
}

/** Toggles for what an agent may open and do. Grouped: Pages, Actions, Phone number. */
function PermissionsPanel({ value, onChange }) {
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-900/20 dark:text-sky-200"><Info size={14} className="mt-0.5 shrink-0" />Agents only see leads assigned to them (and their chats, visits and follow-ups).</p>
      {PERMISSION_GROUPS.map((g) => (
        <fieldset key={g.key}>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{g.title}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {g.items.map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800/50">
                <input type="checkbox" className="h-4 w-4" checked={Boolean(value?.[key])} onChange={(e) => onChange({ ...value, [key]: e.target.checked })} />
                <span className="text-ink-700 dark:text-ink-200">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Edit one agent's permissions after they were added. */
function PermissionsModal({ member, onClose, onSave }) {
  const [perms, setPerms] = useState({ ...DEFAULT_AGENT_PERMISSIONS, ...(member.permissions || {}) });
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={`Permissions — ${member.name}`} size="max-w-lg">
      <PermissionsPanel value={perms} onChange={setPerms} />
      <div className="mt-4 flex gap-2">
        <button className="btn-primary gap-2" disabled={busy} onClick={async () => { setBusy(true); try { await onSave(perms); onClose(); } finally { setBusy(false); } }}>{busy && <Loader2 size={15} className="animate-spin" />}Save permissions</button>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

const emptyRow = () => ({ name: '', email: '', phone: '', orgRole: 'agent', password: '', permissions: { ...DEFAULT_AGENT_PERMISSIONS } });

/** Add one or many teammates at once, each with an optional password. */
function BulkAdd({ onDone, onCancel, remaining }) {
  const [rows, setRows] = useState([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const [paste, setPaste] = useState('');
  const update = (i, k, v) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const fromPaste = () => {
    const parsed = paste.split(/\n+/).map((line) => line.split(/[,\t;]+/).map((x) => x.trim())).filter((p) => p.length >= 2 && /@/.test(p[1]))
      .map(([name, email, phone = '', password = '']) => ({ ...emptyRow(), name, email, phone, password }));
    if (parsed.length) { setRows(parsed); setPaste(''); }
  };
  const submit = async (e) => {
    e.preventDefault();
    const members = rows.filter((r) => r.name.trim() || r.email.trim()).map((r) => ({ ...r, orgRole: 'agent', name: r.name.trim(), email: r.email.trim().toLowerCase(), phone: r.phone.trim(), password: r.password.trim() || undefined }));
    if (!members.length) return;
    setBusy(true); setErrors([]);
    try {
      const res = await orgApi.bulkInvite(members);
      const results = res.data.results || [];
      const failed = results.filter((x) => !x.ok);
      setErrors(failed.map((f) => `${f.email || f.name}: ${f.error}`));
      onDone(results.filter((x) => x.ok), res.data.loginUrl, res.message);
      if (!failed.length) setRows([emptyRow()]);
      else setRows(members.filter((m) => failed.some((f) => f.email === m.email)).map((m) => ({ ...emptyRow(), ...m, password: m.password || '' })));
    } catch (err) {
      const d = err?.response?.data;
      setErrors([d?.details?.[0]?.message || d?.message || 'Could not add']);
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-ink-100 p-4 dark:border-ink-800">
      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Add teammates {remaining != null && <span className="font-normal text-ink-500">({remaining} more allowed)</span>}</p>
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg bg-ink-50/60 p-2 dark:bg-ink-800/40">
        <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_0.9fr_1fr_auto]">
          <input className="input-field" placeholder="Name" required value={row.name} onChange={(e) => update(i, 'name', e.target.value)} />
          <input className="input-field" type="email" placeholder="Email (login ID)" required value={row.email} onChange={(e) => update(i, 'email', e.target.value)} />
          <input className="input-field" placeholder="Mobile" value={row.phone} onChange={(e) => update(i, 'phone', e.target.value)} />
          <input className="input-field" type="text" autoComplete="new-password" placeholder="Password (khali = auto)" value={row.password} onChange={(e) => update(i, 'password', e.target.value)} />
          <button type="button" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 disabled:opacity-30 dark:hover:bg-ink-800" disabled={rows.length === 1} onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))} aria-label="Remove row"><X size={15} /></button>
        </div>
        <details className="mt-1.5">
          <summary className="flex cursor-pointer items-center gap-1.5 py-1 text-xs font-semibold text-brand-600"><ShieldCheck size={13} /> Permissions</summary>
          <div className="mt-2 rounded-lg bg-white p-3 dark:bg-ink-900"><PermissionsPanel value={row.permissions} onChange={(p) => update(i, 'permissions', p)} /></div>
        </details>
        </div>
      ))}
      <p className="text-[11px] text-ink-500">Password: 8+ characters with 1 capital letter and 1 number (e.g. <code>Sales@2026</code>). Leave blank to auto-generate.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary gap-1.5 !py-1.5 text-xs" onClick={() => setRows((r) => [...r, emptyRow()])}><UserPlus size={14} /> Add row</button>
        <details className="text-xs">
          <summary className="cursor-pointer py-1.5 font-semibold text-brand-600">Paste from Excel</summary>
          <textarea rows={4} className="input-field mt-2 font-mono text-xs" placeholder={'Name, email, mobile, password\nRahul, rahul@abc.com, 9876543210, Rahul@123'} value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button type="button" className="btn-secondary mt-1 !py-1 text-xs" onClick={fromPaste}>Create rows</button>
        </details>
      </div>
      {errors.length > 0 && <ul className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="flex gap-2">
        <button className="btn-primary gap-2" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Add</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function TeamPage() {
  const qc = useQueryClient();
    const org = useAuthStore((s) => s.org);
  const me = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({ queryKey: ['team'], queryFn: orgApi.team, enabled: teamAvailable(org) });
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cred, setCred] = useState(null);
  const [permsFor, setPermsFor] = useState(null);
  const teamOn = teamAvailable(org); // Starter / Trial: owner only, no team section

  const members = data?.data?.items || [];
  const active = members.filter((m) => m.isActive).length;
  const limit = org?.limits?.users;

  const submitInvite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await orgApi.invite(invite);
      setCred({ title: `${res.data.member.name} added`, email: res.data.member.email, password: res.data.tempPassword, loginUrl: res.data.loginUrl });
      setInvite(null);
      qc.invalidateQueries({ queryKey: ['team'] });
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not add');
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
      setError(err?.response?.data?.message || 'Could not update');
    }
  };

  const setPw = async (m) => {
    const pw = window.prompt(`New password for ${m.name} (8+ characters, 1 capital, 1 number):`, '');
    if (!pw) return;
    try {
      await orgApi.setMemberPassword(m.id, pw);
      setCred({ title: `Password set for ${m.name}`, email: m.email, password: pw, name: m.name });
    } catch (err) {
      const d = err?.response?.data;
      setError(d?.details?.[0]?.message || d?.message || 'Could not set password');
    }
  };

  const resetPw = async (m) => {
    if (!(await confirmDialog({ title: `Reset password for ${m.name}?`, message: 'A new temporary password is created and the old one stops working.', confirmLabel: 'Reset' }))) return;
    try {
      const res = await orgApi.resetMemberPassword(m.id);
      setCred({ title: `New password for ${m.name}`, email: m.email, password: res.data.tempPassword });
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not reset');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">{teamOn ? 'Company & Team' : 'Company details'}</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{teamOn ? 'Company details and who can use Visitsly.' : 'Your company details. Team members are available on Growth and above.'}</p>
      </div>

      <CompanyProfile />

      {teamOn && <section className="card min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><Users size={18} /> Team</h2>
            <p className="mt-1 text-sm text-ink-500">{active} / {limit ?? 'Unlimited'} users on this plan</p>
          </div>
          <button className="btn-primary gap-2" onClick={() => { setInvite({ name: '', email: '', phone: '', orgRole: 'agent' }); setCred(null); }} disabled={limit != null && active >= limit} title={limit != null && active >= limit ? 'User limit reached — upgrade your plan' : undefined}>
            <UserPlus size={16} /> Add teammates
          </button>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {cred && <div className="mt-4"><CredentialBox cred={cred} onClose={() => setCred(null)} /></div>}

        {invite && (
          <BulkAdd
            remaining={limit != null ? Math.max(0, limit - active) : null}
            onCancel={() => setInvite(null)}
            onDone={(ok, loginUrl, message) => {
              if (ok.length) {
                setCred({ title: message, loginUrl, list: ok.map((x) => ({ name: x.name, email: x.email, password: x.password })) });
                qc.invalidateQueries({ queryKey: ['team'] });
              }
            }}
          />
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
                      <td className="py-2.5 pr-3"><p className="font-medium text-ink-900 dark:text-white">{m.name}{isMe && <span className="ml-1 text-xs text-ink-400">(you)</span>}</p><p className="text-xs text-ink-500">{m.email}</p></td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">{ROLE_LABEL[m.orgRole] || 'Agent'}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-ink-500">{m.lastLoginAt ? fmtDate(m.lastLoginAt) : 'Never'}</td>
                      <td className="py-2.5 pr-3">{m.isActive ? <span className="text-green-700 dark:text-green-400">Active</span> : <span className="text-ink-500">Removed</span>}</td>
                      <td className="py-2.5 text-right">
                        {!isOwner && (
                          <div className="flex justify-end gap-2">
                            <button className="btn-secondary gap-1 !px-2.5 !py-1.5 text-xs" onClick={() => setPermsFor(m)} title="Choose what this agent can open and do"><ShieldCheck size={13} />Permissions</button>
                            <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setPw(m)} title="Set a password">Password set</button>
                            <button className="btn-secondary !px-2.5 !py-1.5" onClick={() => resetPw(m)} title="Generate password"><KeyRound size={14} /></button>
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
      </section>}
      {permsFor && <PermissionsModal member={permsFor} onClose={() => setPermsFor(null)} onSave={(permissions) => update(permsFor, { permissions })} />}
    </div>
  );
}
