import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { authApi } from "../../api/authApi.js";
import { useAuthStore } from "../../store/authStore.js";
import { AuthHeading, AuthTabs } from "./AuthParts.jsx";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

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

      // First login of a new workspace → onboarding wizard (name, company, country, city, type).
      if (data.org && data.org.profileDone === false) {
        navigate("/onboarding", { replace: true });
        return;
      }

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
          "Could not log in. Check your email and password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form-shell w-full">
      <AuthHeading bold="Welcome back" />

      <div className="mt-4">
        <AuthTabs active="login" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
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

      <p className="mt-6 text-center text-sm text-slate-600">
        New to Visitsly?{" "}
        <Link
          to="/signup"
          className="font-semibold text-lp-tealdark hover:text-lp-ink hover:underline"
        >
          Start your free trial
        </Link>
      </p>
    </div>
  );
}
