import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setSession(data.user, data.accessToken, data.org);

      // New workspaces complete WhatsApp-first onboarding. Connected users
      // return to the page they originally requested.
      const whatsappConnected = data.org?.whatsapp?.status === 'connected'
        && Boolean(data.org?.whatsapp?.phoneNumberId);
      navigate(
        whatsappConnected
          ? (location.state?.from?.pathname || '/dashboard')
          : '/get-started',
        { replace: true },
      );
    } catch (err) {
      setError(
        err?.response?.data?.message
          || 'Login nahi ho paya. Email aur password check karke dobara try karein.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form-shell w-full">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-blue-700">
        <Sparkles size={14} aria-hidden="true" />
        Visitsly workspace
      </div>

      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-[42px]">
        Welcome back<span className="text-blue-600">.</span>
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-6 text-slate-500">
        Sign in to manage your leads, conversations and property visits—all in one place.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-5 text-red-700"
          >
            <span className="mt-0.5 shrink-0 font-bold">!</span>
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
            Work email
          </label>
          <div className="group relative">
            <Mail
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-blue-600"
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="you@company.com"
              value={form.email}
              onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="group relative">
            <LockKeyhole
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-blue-600"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Enter your password"
              value={form.password}
              onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowPassword((show) => !show)}
              className="absolute inset-y-0 right-0 flex items-center rounded-r-2xl px-4 text-slate-400 transition hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {loading ? <Loader2 size={19} className="animate-spin" aria-hidden="true" /> : null}
          <span>{loading ? 'Signing in…' : 'Sign in to Visitsly'}</span>
          {!loading && <ArrowRight size={19} className="transition group-hover:translate-x-0.5" aria-hidden="true" />}
        </button>
      </form>

      <div className="mt-7 flex items-start gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3.5">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
        <p className="text-xs leading-5 text-slate-500">
          Your workspace is protected. We’ll never ask you to share your Facebook or WhatsApp password.
        </p>
      </div>

      <p className="mt-7 text-center text-sm text-slate-500">
        New to Visitsly?{' '}
        <Link to="/signup" className="font-semibold text-blue-700 transition hover:text-blue-800 hover:underline">
          Start your 7-day free trial
        </Link>
      </p>
    </div>
  );
}
