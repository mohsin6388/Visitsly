import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Loader2,
  ArrowRight,
  CalendarCheck,
} from "lucide-react";
import { authApi } from "../../api/authApi.js";
import { useAuthStore } from "../../store/authStore.js";
import { AuthHeading, AuthTabs, SocialButtons } from "./AuthParts.jsx";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  // Social login is not wired to the backend yet — keep the buttons honest.
  const handleSocial = (provider) => {
    setError("");
    setNotice(
      `${provider === "google" ? "Google" : "Microsoft"} login jaldi aa raha hai. Abhi email aur password se login karein.`,
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await authApi.login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setSession(data.user, data.accessToken, data.org);

      // New workspaces complete WhatsApp-first onboarding. Connected users
      // return to the page they originally requested.
      const whatsappConnected =
        data.org?.whatsapp?.status === "connected" &&
        Boolean(data.org?.whatsapp?.phoneNumberId);
      navigate(
        whatsappConnected
          ? location.state?.from?.pathname || "/dashboard"
          : "/whatsapp",
        { replace: true },
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Login nahi ho paya. Email aur password check karke dobara try karein.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form-shell w-full">
      <AuthHeading bold="Welcome back." light="Log in.">
        Pick up your leads, WhatsApp chats and site visits where you left off.
      </AuthHeading>

      <div className="mt-7">
        <AuthTabs active="login" />
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-5 text-red-700"
          >
            <span className="mt-0.5 shrink-0 font-bold">!</span>
            <span>{error}</span>
          </div>
        )}
        {notice && !error && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-lp-teal/30 bg-lp-teal/10 px-4 py-3.5 text-sm leading-5 text-lp-tealdark"
          >
            {notice}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-semibold text-lp-ink"
          >
            Email address
          </label>
          <div className="group relative">
            <Mail
              size={19}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-lp-teal"
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              required
              className="auth-input pl-11 pr-4"
              placeholder="you@company.com"
              value={form.email}
              onChange={(event) =>
                setForm((state) => ({ ...state, email: event.target.value }))
              }
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-lp-ink"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-lp-tealdark transition hover:text-lp-ink hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="group relative">
            <LockKeyhole
              size={19}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-lp-teal"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="auth-input pl-11 pr-12"
              placeholder="Enter your password"
              value={form.password}
              onChange={(event) =>
                setForm((state) => ({ ...state, password: event.target.value }))
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword((show) => !show)}
              className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-4 text-slate-400 transition hover:text-lp-tealdark focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lp-teal"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="auth-cta group">
          {loading ? (
            <Loader2 size={19} className="animate-spin" aria-hidden="true" />
          ) : null}
          <span>{loading ? "Logging in…" : "Log in"}</span>
          {!loading && (
            <ArrowRight
              size={19}
              className="transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          )}
        </button>
      </form>

      {/* <div className="my-6 flex items-center gap-4 text-sm text-slate-500">
        <span className="h-px flex-1 bg-slate-300/70" />
        or continue with
        <span className="h-px flex-1 bg-slate-300/70" />
      </div> */}

      <SocialButtons onSelect={handleSocial} />

      <Link
        to="/signup"
        className="group mt-6 flex items-center gap-4 rounded-2xl bg-lp-ink px-4 py-4 transition hover:bg-lp-deep"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lp-teal/15 text-lp-mint">
          <CalendarCheck size={22} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-white">
            Start your 7-day free trial
          </span>
          <span className="block text-sm text-white/60">
            Explore all premium features. No credit card required.
          </span>
        </span>
        <ArrowRight
          size={18}
          className="shrink-0 text-lp-mint transition group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
