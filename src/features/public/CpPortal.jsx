import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Building2, Loader2, LogOut, UserPlus, Users, Home, FileDown } from 'lucide-react';
import { inr, fmtDate } from '../../lib/saas.jsx';

/**
 * /cp/:slug — channel partner (external broker) portal for one builder.
 * Separate login (token in sessionStorage), never touches the CRM session.
 */
const configured = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/';
const cp = axios.create({ baseURL: configured.endsWith('/') ? configured : `${configured}/` });

const STAGE = {
  registered: ['Registered', 'bg-ink-100 text-ink-700'],
  in_discussion: ['Baat chal rahi hai', 'bg-sky-100 text-sky-700'],
  visit_scheduled: ['Visit scheduled', 'bg-amber-100 text-amber-800'],
  visited: ['Visit ho gaya', 'bg-violet-100 text-violet-700'],
  booked: ['Booked', 'bg-green-100 text-green-700'],
  lost: ['Lost', 'bg-red-100 text-red-700'],
};

const err = (e) => e?.response?.data?.details?.[0]?.message || e?.response?.data?.message || 'Kuch galat hua';

function Auth({ slug, info, onLogin }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', firmName: '', phone: '', email: '', city: '', reraNumber: '', password: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'register') {
        const { data } = await cp.post(`cp/${slug}/register`, f);
        setMsg({ ok: true, text: data.message });
        setMode('login');
      } else {
        const { data } = await cp.post(`cp/${slug}/login`, { email: f.email, password: f.password });
        onLogin(data.data.token);
      }
    } catch (e2) {
      setMsg({ ok: false, text: err(e2) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <div className="mb-5 inline-flex rounded-lg bg-ink-100 p-1 text-sm" role="tablist">
        {[['login', 'Login'], ['register', 'Register']].map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-md px-4 py-1.5 font-semibold ${mode === k ? 'bg-white shadow-card' : 'text-ink-600'}`}>{l}</button>)}
      </div>
      {msg && <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      <form className="space-y-3" onSubmit={submit}>
        {mode === 'register' && (
          <>
            <input className="input-field" placeholder="Aapka naam" required value={f.name} onChange={set('name')} />
            <input className="input-field" placeholder="Firm ka naam" value={f.firmName} onChange={set('firmName')} />
            <input className="input-field" placeholder="Mobile" required inputMode="tel" value={f.phone} onChange={set('phone')} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input-field" placeholder="City" value={f.city} onChange={set('city')} />
              <input className="input-field" placeholder="RERA no. (optional)" value={f.reraNumber} onChange={set('reraNumber')} />
            </div>
          </>
        )}
        <input className="input-field" placeholder={mode === 'login' ? 'Email ya mobile' : 'Email'} type={mode === 'login' ? 'text' : 'email'} required autoComplete="username" value={f.email} onChange={set('email')} />
        <input className="input-field" placeholder="Password" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} />
        <button className="btn-primary w-full gap-2 !bg-emerald-950 hover:!bg-emerald-900" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}{mode === 'login' ? 'Login' : 'Register'}</button>
      </form>
      {mode === 'register' && info && <p className="mt-3 text-xs text-ink-500">Commission {info.commissionPct}% · Aapke registered customer {info.leadProtectionDays} din tak aapke naam protected rahenge.</p>}
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [tab, setTab] = useState('leads');
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState([]);
  const [inv, setInv] = useState([]);
  const [f, setF] = useState({ name: '', phone: '', email: '', project: '', budget: '', visitDate: '', notes: '' });
  const [msg, setMsg] = useState(null);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([cp.get('cp/me', auth), cp.get('cp/me/leads', auth), cp.get('cp/me/inventory', auth)]);
      setMe(a.data.data);
      setLeads(b.data.data.items);
      setInv(c.data.data.items);
    } catch (e) {
      if (e?.response?.status === 401) onLogout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const { data } = await cp.post('cp/me/leads', { ...f, budget: f.budget ? Number(f.budget) : undefined, email: f.email || undefined }, auth);
      setMsg({ ok: true, text: data.message });
      setF({ name: '', phone: '', email: '', project: '', budget: '', visitDate: '', notes: '' });
      load();
      setTab('leads');
    } catch (e2) {
      setMsg({ ok: false, text: err(e2) });
    }
  };
  const projects = [...new Set(inv.map((i) => i.project))];

  if (!me) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" /></div>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">Namaste <strong>{me.partner.name}</strong>{me.partner.firmName ? ` (${me.partner.firmName})` : ''} · commission {me.partner.commissionPct}%</p>
        <button className="btn-secondary gap-2 !py-1.5" onClick={onLogout}><LogOut size={14} /> Logout</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[['Customers', me.stats.leads], ['Bookings', me.stats.bookings], ['Commission', inr(me.stats.commissionEarned)]].map(([l, v]) => <div key={l} className="rounded-xl border border-ink-100 bg-white p-4 shadow-card"><p className="text-xs text-ink-500">{l}</p><p className="mt-1 font-display text-xl font-bold">{v}</p></div>)}
      </div>
      <div className="inline-flex flex-wrap rounded-lg bg-ink-100 p-1 text-sm" role="tablist">
        {[['leads', 'Mere customers', Users], ['add', 'Customer register', UserPlus], ['inventory', 'Inventory', Home]].map(([k, l, Icon]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold ${tab === k ? 'bg-white shadow-card' : 'text-ink-600'}`}><Icon size={14} />{l}</button>)}
      </div>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      {tab === 'leads' && (
        <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase text-ink-400"><tr><th className="px-4 py-2.5">Customer</th><th className="px-4 py-2.5">Project</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Protected till</th><th className="px-4 py-2.5 text-right">Commission</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {leads.map((l) => <tr key={l.id}><td className="px-4 py-2.5">{l.name}<span className="block text-xs text-ink-400">{l.phone}</span></td><td className="px-4 py-2.5">{l.project || '—'}</td><td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE[l.stage]?.[1]}`}>{STAGE[l.stage]?.[0]}</span>{l.nextVisit && <span className="block text-xs text-ink-400">{l.nextVisit}</span>}</td><td className="px-4 py-2.5 text-ink-500">{fmtDate(l.protectedUntil)}</td><td className="px-4 py-2.5 text-right font-mono">{l.commission ? inr(l.commission) : '—'}</td></tr>)}
              {!leads.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-500">Abhi koi customer register nahi kiya.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'add' && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input-field" placeholder="Customer ka naam" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="input-field" placeholder="Customer ka mobile" required inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <input className="input-field" placeholder="Email (optional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <select className="input-field" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} aria-label="Project"><option value="">Project</option>{projects.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <input className="input-field" placeholder="Budget (₹)" inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/\D/g, '') })} />
            <input className="input-field" placeholder="Visit kab? (optional)" value={f.visitDate} onChange={(e) => setF({ ...f, visitDate: e.target.value })} />
          </div>
          <textarea className="input-field" rows={2} placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <button className="btn-primary !bg-emerald-950 hover:!bg-emerald-900">Register customer</button>
          <p className="text-xs text-ink-500">Agar customer pehle se builder ke paas hai to register nahi hoga (lead protection sabke liye barabar).</p>
        </form>
      )}
      {tab === 'inventory' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {inv.map((p, i) => (
            <div key={i} className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
              <p className="font-semibold text-ink-900">{p.project}</p>
              <p className="text-sm text-ink-600">{[p.bhk && `${p.bhk} BHK`, p.type, p.sizeSqft && `${p.sizeSqft} sq.ft`].filter(Boolean).join(' · ')}</p>
              <p className="text-sm text-ink-500">{p.location}</p>
              <p className="mt-1 text-sm font-semibold">{p.priceMin || p.priceMax ? `${inr(p.priceMin || p.priceMax)}${p.priceMax && p.priceMin !== p.priceMax ? ` – ${inr(p.priceMax)}` : ''}` : 'Price on request'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${p.availability === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.availability}</span>
                {p.possession && <span className="text-ink-500">Possession {p.possession}</span>}
                {p.brochureUrl && <a className="inline-flex items-center gap-1 font-semibold text-emerald-800" href={p.brochureUrl} target="_blank" rel="noreferrer"><FileDown size={12} /> Brochure</a>}
              </div>
            </div>
          ))}
          {!inv.length && <p className="text-sm text-ink-500">Inventory jald update hogi.</p>}
        </div>
      )}
    </div>
  );
}

export default function CpPortal() {
  const { slug } = useParams();
  const storeKey = `propai.cp.${slug}`;
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem(storeKey); } catch { return null; } });

  useEffect(() => {
    cp.get(`cp/${slug}/info`).then((r) => setInfo(r.data.data)).catch(() => setError('Ye partner portal available nahi hai.'));
  }, [slug]);

  const login = (t) => { try { sessionStorage.setItem(storeKey, t); } catch { /* private mode */ } setToken(t); };
  const logout = () => { try { sessionStorage.removeItem(storeKey); } catch { /* private mode */ } setToken(null); };

  return (
    <div className="min-h-screen bg-[#fcfbf8] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center gap-3">
          {info?.logoUrl ? <img src={info.logoUrl} alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-1 shadow-card" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-950 text-white"><Building2 size={20} /></span>}
          <div><p className="font-display text-lg font-bold text-emerald-950">{info?.company || 'Partner portal'}</p><p className="text-xs uppercase tracking-[0.18em] text-ink-500">Channel partner portal</p></div>
        </header>
        {error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : !info ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" /></div> : token ? <Dashboard token={token} onLogout={logout} /> : <Auth slug={slug} info={info} onLogin={login} />}
        <p className="mt-8 text-center text-xs text-ink-400">Powered by Visitsly</p>
      </div>
    </div>
  );
}
