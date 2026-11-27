import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { authApi } from "../../api/authApi.js";
import { publicApi } from "../../api/saasApi.js";
import { detectCountry, initialCountry } from "../../lib/country.js";
import { money } from "../../lib/saas.jsx";
import PhoneInput, { toInternational } from "../../components/PhoneInput.jsx";
import { AuthHeading, AuthTabs } from "./AuthParts.jsx";

// Defined outside the page so inputs keep focus while typing.
function Field({ id, label, error, children }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-lp-ink"
      >
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Signup asks for three things only: mobile number (with dial code), email
 * and password. Name, company, country, city and business type are asked in
 * the onboarding wizard after the first login.
 */
export default function SignupPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", phone: "", password: "" });
  // Dial-code country: detected (IP → browser), always changeable.
  const [dialCountry, setDialCountry] = useState(() => initialCountry());
  const [detected, setDetected] = useState(() => initialCountry());
  const dialTouched = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState(null);
  const navigate = useNavigate();
  const plan = params.get("plan") || "";

  useEffect(() => {
    let alive = true;
    detectCountry().then(({ country }) => {
      if (!alive) return;
      setDetected(country);
      if (!dialTouched.current) setDialCountry(country);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    publicApi
      .plans({ country: detected })
      .then((r) => setPlans(r.data))
      .catch(() => {});
  }, [detected]);
  const chosen = plans?.plans?.find((p) => p.code === plan && !p.customPricing);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    const phone = toInternational(dialCountry, form.phone);
    if (!phone) {
      setFieldErrors({ phone: "Enter your mobile number" });
      return;
    }
    setLoading(true);
    try {
      await authApi.signup({
        email: form.email.trim().toLowerCase(),
        phone,
        password: form.password,
        // Detected country: default region for the phone and the provisional
        // company country (confirmed in onboarding).
        country: detected,
        plan: plan || undefined,
      });
      navigate(
        `/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`,
        { replace: true },
      );
    } catch (err) {
      const details = err?.response?.data?.details;
      if (Array.isArray(details)) {
        const map = {};
        details.forEach((d) => {
          const key = String(d.path || "").replace(/^body\./, "");
          if (!map[key]) map[key] = d.message;
        });
        setFieldErrors(map);
        setError("Please fix the highlighted fields.");
      } else {
        const message =
          err?.response?.data?.message ||
          "Could not create your account. Please try again.";
        if (
          err?.response?.status === 409 &&
          /verification pending/i.test(message)
        ) {
          navigate(
            `/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`,
            { replace: true },
          );
          return;
        }
        // Show duplicate / invalid mobile or email next to its field.
        if (/mobile/i.test(message)) {
          setFieldErrors({ phone: message });
          return;
        }
        if (err?.response?.status === 409 && /email/i.test(message)) {
          setFieldErrors({ email: message });
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
      <AuthHeading bold="Start your free trial">
        {plans?.trialDays || 7} days free. No card needed.
      </AuthHeading>
      <div className="mt-4">
        <AuthTabs active="signup" />
      </div>
      {chosen && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-lp-teal/25 bg-lp-teal/10 px-3 py-2 text-sm text-lp-ink">
          <CheckCircle2 size={16} /> Plan: <strong>{chosen.name}</strong> —{" "}
          {money(chosen.monthly, chosen.currency)}/month after trial
          {chosen.currency === "INR" ? " + 18% GST" : ""}
        </div>
      )}

      <form className="space-y-3.5" onSubmit={submit} noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        <Field id="phone" error={fieldErrors.phone} label="WhatsApp / mobile number">
          <PhoneInput
            id="phone"
            country={dialCountry}
            onCountryChange={(c) => {
              dialTouched.current = true;
              setDialCountry(c);
            }}
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            placeholder={dialCountry === "IN" ? "98XXXXXXXX" : dialCountry === "AE" ? "50XXXXXXX" : "Mobile number"}
            invalid={Boolean(fieldErrors.phone)}
          />
        </Field>
        <Field id="email" error={fieldErrors.email} label="Email">
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            className="auth-input px-4"
            placeholder="name@company.com"
            value={form.email}
            onChange={set("email")}
          />
        </Field>
        <Field id="password" error={fieldErrors.password} label="Password">
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              className="auth-input px-4 pr-12"
              placeholder="8+ chars, 1 capital, 1 number"
              value={form.password}
              onChange={set("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <button type="submit" disabled={loading} className="auth-cta group">
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? "Creating account…" : "Start free trial"}
          {!loading && <ArrowRight size={18} />}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-lp-tealdark hover:text-lp-ink"
        >
          Login
        </Link>
      </p>
    </div>
  );
}
