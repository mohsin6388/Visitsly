import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { authApi } from '../../api/authApi.js';
import { publicApi } from '../../api/saasApi.js';
import { inr } from '../../lib/saas.jsx';

const TYPES = [
  { value: 'broker', label: 'Broker' },
  { value: 'agency', label: 'Agency' },
  { value: 'builder', label: 'Builder' },
  { value: 'other', label: 'Other' },
];

// Defined outside the page so inputs keep focus while typing.
function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-800">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function SignupPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ companyName: '', name: '', email: '', phone: '', password: '', city: '', businessType: 'broker' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState(null);
  const navigate = useNavigate();
  const plan = params.get('plan') || '';

  useEffect(() => { publicApi.plans().then((r) => setPlans(r.data)).catch(() => {}); }, []);
  const chosen = plans?.plans?.find((p) => p.code === plan);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      await authApi.signup({ ...form, email: form.email.trim().toLowerCase(), plan: plan || undefined });
      navigate(`/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`, { replace: true });
    } catch (err) {
      const details = err?.response?.data?.details;
      if (Array.isArray(details)) {
        const map = {};
        details.forEach((d) => { const key = d.path.replace(/^body\./, ''); if (!map[key]) map[key] = d.message; });
        setFieldErrors(map);
        setError('Neeche laal wale fields theek karein.');
      } else {
        const message = err?.response?.data?.message || 'Signup nahi ho paya. Dobara try karein.';
        if (err?.response?.status === 409 && /verification pending/i.test(message)) {
          navigate(`/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`, { replace: true });
          return;
        }
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-800">Visitsly CRM</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">Free trial shuru karein</h1>
      <p className="mt-2 text-sm text-ink-500">{plans?.trialDays || 7} din free. Pehle email verify hoga; card ki zarurat nahi. Apna WhatsApp number jodiye aur AI ko leads se baat karne dijiye.</p>
      {plans?.trial?.highlights?.length > 0 && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">Free trial mein included</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {plans.trial.highlights.map((item) => <li key={item} className="flex items-start gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-blue-700" />{item}</li>)}
          </ul>
        </div>
      )}
      {chosen && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <CheckCircle2 size={16} /> Chosen plan: <strong>{chosen.name}</strong> — {inr(chosen.monthly)}/mahina (trial ke baad)
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <Field id="companyName" error={fieldErrors.companyName} label="Company / firm ka naam">
          <input id="companyName" required className="input-field !rounded-xl !py-3" placeholder="e.g. Sharma Properties" value={form.companyName} onChange={set('companyName')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" error={fieldErrors.name} label="Aapka naam">
            <input id="name" required autoComplete="name" className="input-field !rounded-xl !py-3" value={form.name} onChange={set('name')} />
          </Field>
          <Field id="phone" error={fieldErrors.phone} label="Mobile (WhatsApp)">
            <input id="phone" required inputMode="tel" autoComplete="tel" className="input-field !rounded-xl !py-3" placeholder="98XXXXXXXX" value={form.phone} onChange={set('phone')} />
          </Field>
        </div>
        <Field id="email" error={fieldErrors.email} label="Email address (verification required)">
          <input id="email" type="email" required autoComplete="username" className="input-field !rounded-xl !py-3" placeholder="name@company.com" value={form.email} onChange={set('email')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="city" error={fieldErrors.city} label="City">
            <input id="city" className="input-field !rounded-xl !py-3" placeholder="Kanpur" value={form.city} onChange={set('city')} />
          </Field>
          <Field id="businessType" error={fieldErrors.businessType} label="Aap kaun hain?">
            <select id="businessType" className="input-field !rounded-xl !py-3" value={form.businessType} onChange={set('businessType')}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <Field id="password" error={fieldErrors.password} label="Password">
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} required autoComplete="new-password" className="input-field !rounded-xl !py-3 !pr-12" placeholder="8+ characters, 1 capital, 1 number" value={form.password} onChange={set('password')} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-4 text-ink-500" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </Field>
        <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 !rounded-xl !bg-blue-950 !py-3.5 text-base hover:!bg-blue-900">
          {loading && <Loader2 size={18} className="animate-spin" />}{loading ? 'Account ban raha hai…' : 'Start free trial'}{!loading && <ArrowRight size={18} />}
        </button>
        <p className="text-center text-xs text-ink-500">Signup karke aap Visitsly ki Terms aur Privacy Policy se sehmat hain.</p>
      </form>
      <p className="mt-6 text-center text-sm text-ink-600">Email verify karna zaroori hai. Pehle se account hai? <Link to="/login" className="font-semibold text-blue-900 hover:text-blue-700">Login</Link> · <Link to="/pricing" className="font-semibold text-blue-900 hover:text-blue-700">Pricing</Link></p>
    </div>
  );
}
