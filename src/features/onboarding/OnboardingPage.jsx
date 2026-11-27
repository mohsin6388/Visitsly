import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building2, Check, Globe2, Handshake, HardHat, Loader2, LogOut, MapPin, UserRound, Users } from 'lucide-react';
import { orgApi } from '../../api/saasApi.js';
import { authApi } from '../../api/authApi.js';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';
import { COUNTRY_OPTIONS, currencyForCountry, detectCountry, isCountryCode } from '../../lib/country.js';
import { errText } from '../../lib/saas.jsx';
import { BrandMark } from '../auth/AuthParts.jsx';

const PLACEHOLDER_COMPANY = 'My Company';

const TYPES = [
  { value: 'broker', label: 'Broker', icon: Handshake, body: 'I sell and rent properties for clients, mostly on my own.' },
  { value: 'agency', label: 'Agency', icon: Users, body: 'We are a team of agents handling many projects and leads.' },
  { value: 'builder', label: 'Builder', icon: HardHat, body: 'We build and sell our own projects.' },
];

const CURRENCY_TEXT = { INR: '₹ INR', AED: 'AED', USD: 'USD' };

const STEPS = [
  { key: 'ownerName', icon: UserRound, title: 'What’s your name?', sub: 'So your team and customers know who they’re talking to.' },
  { key: 'companyName', icon: Building2, title: 'What’s your company called?', sub: 'The AI uses this name when it chats with your leads.' },
  { key: 'country', icon: Globe2, title: 'Which country do you work in?', sub: 'This sets your billing currency.' },
  { key: 'city', icon: MapPin, title: 'Which city are you in?', sub: 'Helps the AI talk about locations your buyers know.' },
  { key: 'businessType', icon: Building2, title: 'I am a…', sub: 'We’ll recommend the plan that fits you. You can pick any plan later.' },
];

function validate(key, value) {
  const v = String(value || '').trim();
  if (key === 'ownerName') return v.length >= 2 ? '' : 'Enter your name';
  if (key === 'companyName') return v.length >= 2 ? '' : 'Enter your company name';
  if (key === 'country') return isCountryCode(v) ? '' : 'Choose your country';
  if (key === 'city') return v.length >= 2 ? '' : 'Enter your city';
  if (key === 'businessType') return ['broker', 'agency', 'builder'].includes(v) ? '' : 'Choose one';
  return '';
}

const slide = {
  enter: (dir) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

/**
 * First-login onboarding wizard: one question per slide (name → company →
 * country → city → business type). Answers are saved after every step so the
 * owner can close the tab and resume. "Let's go" saves the profile, fixes the
 * billing country/currency, and opens the app the usual way.
 */
export default function OnboardingPage() {
  const { org, user, setOrg, setUser, clearSession } = useAuthStore();
  const role = useOrgRole();
  const navigate = useNavigate();
  const draft = org?.onboarding?.profileDraft || {};

  const [answers, setAnswers] = useState(() => ({
    ownerName: draft.ownerName || user?.name || '',
    companyName: draft.companyName || (org?.name && org.name !== PLACEHOLDER_COMPANY ? org.name : ''),
    country: draft.country || org?.country || 'IN',
    city: draft.city || org?.city || '',
    businessType: draft.businessType || '',
  }));
  const [step, setStep] = useState(() => Math.min(Math.max(Number(draft.step) || 0, 0), STEPS.length - 1));
  const [dir, setDir] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const countryTouched = useRef(Boolean(draft.country));
  const inputRef = useRef(null);

  // Country: IP-detected first, then the browser guess — unless the user (or a saved draft) chose one.
  useEffect(() => {
    detectCountry().then(({ country }) => {
      if (!countryTouched.current && isCountryCode(country)) setAnswers((a) => ({ ...a, country }));
    });
  }, []);

  useEffect(() => {
    setError('');
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [step]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const currency = currencyForCountry(answers.country);
  const countryName = useMemo(() => COUNTRY_OPTIONS.find(([c]) => c === answers.country)?.[1] || answers.country, [answers.country]);

  if (!org) return <Navigate to="/" replace />;
  if (org.profileDone !== false) return <Navigate to="/" replace />;

  const setAnswer = (key, value) => {
    if (key === 'country') countryTouched.current = true;
    setAnswers((a) => ({ ...a, [key]: value }));
    setError('');
  };

  const saveDraft = (nextStep) => {
    // Best effort: resume where the user left off if they close the tab.
    orgApi.saveProfileDraft({ ...answers, step: nextStep }).catch(() => {});
  };

  const next = async (e) => {
    e?.preventDefault?.();
    const problem = validate(current.key, answers[current.key]);
    if (problem) {
      setError(problem);
      return;
    }
    if (!last) {
      setDir(1);
      setStep(step + 1);
      saveDraft(step + 1);
      return;
    }
    // Final step: check everything, then save.
    const firstBad = STEPS.findIndex((s) => validate(s.key, answers[s.key]));
    if (firstBad !== -1) {
      setDir(-1);
      setStep(firstBad);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ownerName: answers.ownerName.trim(),
        companyName: answers.companyName.trim(),
        country: answers.country,
        city: answers.city.trim(),
        businessType: answers.businessType,
      };
      const res = await orgApi.saveProfile(payload);
      const nextOrg = res.data.org;
      if (user) setUser({ ...user, name: payload.ownerName });
      setOrg(nextOrg);
      // Open the app exactly like before: WhatsApp connected → dashboard, else WhatsApp setup.
      const connected = nextOrg?.whatsapp?.status === 'connected' && Boolean(nextOrg?.whatsapp?.phoneNumberId);
      navigate(connected ? '/dashboard' : '/whatsapp', { replace: true });
    } catch (err) {
      setError(errText(err, 'Could not save. Please try again.'));
      setSaving(false);
    }
  };

  const back = () => {
    if (step === 0) return;
    setDir(-1);
    setStep(step - 1);
  };

  const logout = async () => {
    try { await authApi.logout(); } finally { clearSession(); navigate('/login', { replace: true }); }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#f5f8ff]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_420px_at_85%_10%,rgba(96,165,250,.22),transparent_70%),radial-gradient(600px_380px_at_0%_100%,rgba(99,102,241,.12),transparent_70%)]" />

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <BrandMark size="sm" />
        <button type="button" onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-lp-ink">
          <LogOut size={15} /> Log out
        </button>
      </header>

      {/* Progress */}
      <div className="relative z-10 mx-auto w-full max-w-xl px-4 sm:px-0">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dbe3f5]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Setup progress">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[#3B4FE0] to-[#0EA5E9]" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.35, ease: 'easeOut' }} />
        </div>
      </div>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pb-10 pt-8 sm:items-center sm:pt-0">
        {role !== 'owner' ? (
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow-[0_24px_60px_-20px_rgba(37,63,160,.30)] ring-1 ring-[#dbe3f5]">
            <h1 className="font-display text-xl font-bold text-lp-ink">Almost there</h1>
            <p className="mt-2 text-sm text-slate-600">Your company owner needs to finish setting up the workspace. Please ask them to log in once, then try again.</p>
          </div>
        ) : (
          <form onSubmit={next} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white p-6 shadow-[0_24px_60px_-20px_rgba(37,63,160,.30)] ring-1 ring-[#dbe3f5] sm:p-9" noValidate>
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={current.key} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22, ease: 'easeOut' }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lp-card text-lp-teal"><current.icon size={20} /></span>
                <h1 className="mt-4 font-display text-2xl font-bold tracking-[-0.02em] text-lp-ink sm:text-[28px]">{current.title}</h1>
                <p className="mt-1.5 text-sm text-slate-500">{current.sub}</p>

                <div className="mt-6">
                  {current.key === 'ownerName' && (
                    <input ref={inputRef} id="ownerName" autoComplete="name" className="auth-input px-4 text-base" placeholder="e.g. Rahul Sharma" value={answers.ownerName} onChange={(e) => setAnswer('ownerName', e.target.value)} aria-label="Your name" maxLength={100} />
                  )}
                  {current.key === 'companyName' && (
                    <input ref={inputRef} id="companyName" autoComplete="organization" className="auth-input px-4 text-base" placeholder="e.g. Sharma Properties" value={answers.companyName} onChange={(e) => setAnswer('companyName', e.target.value)} aria-label="Company name" maxLength={120} />
                  )}
                  {current.key === 'country' && (
                    <div>
                      <select ref={inputRef} id="country" className="auth-input px-4 text-base" value={answers.country} onChange={(e) => setAnswer('country', e.target.value)} aria-label="Country">
                        {COUNTRY_OPTIONS.map(([c, label]) => <option key={c} value={c}>{label}</option>)}
                      </select>
                      <p className="mt-3 rounded-xl bg-lp-card/70 px-4 py-3 text-sm text-lp-ink">
                        You’ll be billed in <strong>{CURRENCY_TEXT[currency]}</strong>{currency === 'INR' ? ' (+ 18% GST)' : ''}. The country and currency can’t be changed after setup.
                      </p>
                    </div>
                  )}
                  {current.key === 'city' && (
                    <input ref={inputRef} id="city" autoComplete="address-level2" className="auth-input px-4 text-base" placeholder={answers.country === 'AE' ? 'e.g. Dubai' : answers.country === 'IN' ? 'e.g. Pune' : 'Your city'} value={answers.city} onChange={(e) => setAnswer('city', e.target.value)} aria-label="City" maxLength={80} />
                  )}
                  {current.key === 'businessType' && (
                    <div role="radiogroup" aria-label="Business type" className="grid gap-3 sm:grid-cols-3">
                      {TYPES.map((t, i) => {
                        const on = answers.businessType === t.value;
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.value}
                            ref={i === 0 ? inputRef : undefined}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setAnswer('businessType', t.value)}
                            className={`relative flex flex-col items-start rounded-2xl border-2 p-4 text-left transition sm:min-h-[150px] ${on ? 'border-lp-teal bg-lp-card/60 shadow-[0_10px_24px_-14px_rgba(59,79,224,.6)]' : 'border-[#dbe3f5] bg-white hover:border-lp-teal/50'}`}
                          >
                            {on && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-lp-teal text-white"><Check size={13} /></span>}
                            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${on ? 'bg-lp-teal text-white' : 'bg-lp-card text-lp-teal'}`}><Icon size={20} /></span>
                            <span className="mt-3 font-display text-base font-bold text-lp-ink">{t.label}</span>
                            <span className="mt-1 text-xs leading-5 text-slate-500">{t.body}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
              </motion.div>
            </AnimatePresence>

            {last && (
              <p className="mt-5 text-xs text-slate-500">
                {answers.companyName || 'Your company'} · {answers.city || 'City'} · {countryName}
              </p>
            )}

            <div className="mt-7 flex items-center justify-between gap-3">
              <button type="button" onClick={back} disabled={step === 0 || saving} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-lp-ink disabled:invisible">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="submit" disabled={saving} className="auth-cta !w-auto min-w-[150px]">
                {saving && <Loader2 size={18} className="animate-spin" />}
                {last ? (saving ? 'Setting up…' : 'Let’s go') : 'Next'}
                {!saving && <ArrowRight size={18} />}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
