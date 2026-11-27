import { Link } from "react-router-dom";
import { UserRound, UserPlus } from "lucide-react";

export function BrandMark({
  logoUrl,
  name = "Visitsly",
  size = "md",
  className = "",
}) {
  const sm = size === "sm";
  const hasSly = name.toLowerCase().endsWith("sly");
  const head = hasSly ? name.slice(0, -3) : name;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className={`${sm ? "h-9 w-9" : "h-10 w-10"} rounded-xl bg-white object-contain p-1 shadow-sm`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`flex ${sm ? "h-9 w-9 text-lg" : "h-10 w-10 text-xl"} items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#06B6D4] shadow-md shadow-blue-500/30`}
        >
          🏠
        </span>
      )}
      <span
        className={`font-display ${sm ? "text-[22px]" : "text-2xl"} font-extrabold tracking-[-0.03em] text-lp-ink`}
      >
        {head}
        {hasSly && <span className="text-[#2F6BE8]">sly</span>}
      </span>
    </span>
  );
}

export function AuthHeading({ bold, children }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-lp-ink">
        {bold}
      </h1>
      {children && (
        <p className="mt-1 text-sm text-slate-500 lg:[@media(max-height:700px)]:hidden">
          {children}
        </p>
      )}
    </div>
  );
}

export function AuthTabs({ active = "login" }) {
  const base =
    "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition";
  const on = "bg-white text-lp-teal shadow-sm";
  const off = "text-slate-500 hover:text-lp-ink";
  return (
    <div
      role="tablist"
      className="mb-5 flex rounded-xl border border-[#dbe3f5] bg-lp-card p-1"
    >
      <Link
        to="/login"
        role="tab"
        aria-selected={active === "login"}
        className={`${base} ${active === "login" ? on : off}`}
      >
        <UserRound size={15} aria-hidden="true" /> Login
      </Link>
      <Link
        to="/signup"
        role="tab"
        aria-selected={active === "signup"}
        className={`${base} ${active === "signup" ? on : off}`}
      >
        <UserPlus size={15} aria-hidden="true" /> Create account
      </Link>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3a7.2 7.2 0 0 1-10.7-3.78H1.3v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.36 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4.06-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.3 6.6l4.06 3.1A7.2 7.2 0 0 1 12 4.75z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 23 23" aria-hidden="true">
      <rect width="11" height="11" fill="#F25022" />
      <rect x="12" width="11" height="11" fill="#7FBA00" />
      <rect y="12" width="11" height="11" fill="#00A4EF" />
      <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
    </svg>
  );
}

// onSelect('google' | 'microsoft') — wire this to your OAuth flow when ready.
export function SocialButtons({ onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* <button
        type="button"
        className="auth-social"
        onClick={() => onSelect?.("google")}
      >
        <GoogleIcon /> Google
      </button>
      <button
        type="button"
        className="auth-social"
        onClick={() => onSelect?.("microsoft")}
      >
        <MicrosoftIcon /> Microsoft
      </button> */}
    </div>
  );
}
