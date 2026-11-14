import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { authApi } from "../../api/authApi.js";
import { publicApi } from "../../api/saasApi.js";
import { guessCountry, COUNTRY_OPTIONS } from "../../lib/country.js";
import { inr } from "../../lib/saas.jsx";
import { AuthHeading, AuthTabs } from "./AuthParts.jsx";

const TYPES = [
  { value: "broker", label: "Broker" },
  { value: "agency", label: "Agency" },
  { value: "builder", label: "Builder" },
  { value: "other", label: "Other" },
];

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

export default function SignupPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    city: "",
    businessType: "broker",
    country: COUNTRY_OPTIONS.some(([c]) => c === guessCountry()) ? guessCountry() : "IN",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState(null);
  const navigate = useNavigate();
  const plan = params.get("plan") || "";

  useEffect(() => {
    publicApi
      .plans({ country: form.country })
      .then((r) => setPlans(r.data))
      .catch(() => {});
  }, [form.country]);
  const chosen = plans?.plans?.find((p) => p.code === plan);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      await authApi.signup({
        ...form,
        email: form.email.trim().toLowerCase(),
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
          const key = d.path.replace(/^body\./, "");
          if (!map[key]) map[key] = d.message;
        });
        setFieldErrors(map);
        setError("Neeche laal wale fields theek karein.");
      } else {
        const message =
          err?.response?.data?.message ||
          "Signup nahi ho paya. Dobara try karein.";
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
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <AuthHeading bold="Start your" light="Free trial.">
        {plans?.trialDays || 7} din free. Pehle email verify hoga; card ki
        zarurat nahi. Apna WhatsApp number jodiye aur AI ko leads se baat karne
        dijiye.
      </AuthHeading>
      <div className="mt-6">
        <AuthTabs active="signup" />
      </div>
      {plans?.trial?.highlights?.length > 0 && (
        <div className="mt-4 rounded-xl border border-lp-teal/25 bg-lp-teal/10 px-4 py-3 text-sm text-lp-ink">
          <p className="font-semibold">Free trial mein included</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {plans.trial.highlights.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2
                  size={15}
                  className="mt-0.5 shrink-0 text-lp-tealdark"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {chosen && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-lp-teal/25 bg-lp-teal/10 px-3 py-2 text-sm text-lp-ink">
          <CheckCircle2 size={16} /> Chosen plan: <strong>{chosen.name}</strong>{" "}
          — {inr(chosen.monthly)}/mahina (trial ke baad)
        </div>
      )}

      <form className="space-y-4" onSubmit={submit} noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="companyName"
            error={fieldErrors.companyName}
            label="Company / firm ka naam"
          >
            <input
              id="companyName"
              required
              className="auth-input px-4"
              placeholder="e.g. Sharma Properties"
              value={form.companyName}
              onChange={set("companyName")}
            />
          </Field>
          <Field id="name" error={fieldErrors.name} label="Aapka naam">
            <input
              id="name"
              required
              autoComplete="name"
              className="auth-input px-4"
              value={form.name}
              onChange={set("name")}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="phone" error={fieldErrors.phone} label="Mobile (WhatsApp)">
            <input
              id="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              className="auth-input px-4"
              placeholder="98XXXXXXXX"
              value={form.phone}
              onChange={set("phone")}
            />
          </Field>
          <Field
            id="email"
            error={fieldErrors.email}
            label="Email address (verification required)"
          >
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="city" error={fieldErrors.city} label="City">
            <input
              id="city"
              className="auth-input px-4"
              placeholder="Kanpur"
              value={form.city}
              onChange={set("city")}
            />
          </Field>
          <Field
            id="businessType"
            error={fieldErrors.businessType}
            label="Aap kaun hain?"
          >
            <select
              id="businessType"
              className="auth-input px-4"
              value={form.businessType}
              onChange={set("businessType")}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="country" error={fieldErrors.country} label="Country (isi currency mein price aur payment)">
          <select id="country" className="auth-input px-4" value={form.country} onChange={set("country")}>
            {COUNTRY_OPTIONS.map(([c, label]) => <option key={c} value={c}>{label}</option>)}
          </select>
        </Field>
        <Field id="password" error={fieldErrors.password} label="Password">
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              className="auth-input px-4 pr-12"
              placeholder="8+ characters, 1 capital, 1 number"
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
          {loading ? "Account ban raha hai…" : "Start free trial"}
          {!loading && <ArrowRight size={18} />}
        </button>
        <p className="text-center text-xs text-slate-500">
          Signup karke aap Visitsly ki Terms aur Privacy Policy se sehmat hain.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Email verify karna zaroori hai. Pehle se account hai?{" "}
        <Link
          to="/login"
          className="font-semibold text-lp-tealdark hover:text-lp-ink"
        >
          Login
        </Link>{" "}
        ·{" "}
        <Link
          to="/pricing"
          className="font-semibold text-lp-tealdark hover:text-lp-ink"
        >
          Pricing
        </Link>
      </p>
    </div>
  );
}
