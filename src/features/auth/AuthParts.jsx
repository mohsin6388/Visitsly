import { Link } from "react-router-dom";
import { UserRound, UserPlus } from "lucide-react";

export function BrandMark({
  logoUrl,
  name = "Visitsly",
  light = false,
  size = "md",
  className = "",
}) {
  const sm = size === "sm";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className={`${sm ? "h-8 w-8" : "h-9 w-9"} rounded-xl bg-white object-contain p-1 shadow-sm`}
        />
      ) : (
        <span
          className={`flex ${sm ? "h-8 w-8" : "h-9 w-9"} items-center justify-center rounded-xl bg-lp-teal shadow-md shadow-lp-teal/30`}
        >
          <span className="h-3.5 w-3.5 rotate-45 rounded-[3px] bg-white" />
        </span>
      )}
      <span
        className={`font-display ${sm ? "text-[22px]" : "text-[24px]"} font-extrabold tracking-[-0.04em] ${light ? "text-white" : "text-lp-ink"}`}
      >
        {name}
      </span>
    </span>
  );
}

/* Section-style heading: bold first part, light second part (like the landing page). */
export function AuthHeading({ bold, light, children }) {
  return (
    <div>
      <h1 className="font-display text-[34px] uppercase leading-[1.02] tracking-[-0.03em] text-lp-ink [word-spacing:0.08em] sm:text-[40px]">
        <span className="font-extrabold">{bold}</span>
        {light && (
          <>
            <br />
            <span className="font-light">{light}</span>
          </>
        )}
      </h1>
      {children && (
        <p className="mt-3 max-w-md text-[15px] leading-6 text-slate-500 lg:[@media(max-height:760px)]:hidden">
          {children}
        </p>
      )}
    </div>
  );
}

export function AuthTabs({ active = "login" }) {
  const base =
    "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-semibold transition sm:px-4";
  const on = "bg-lp-ink text-white shadow-md";
  const off = "text-slate-600 hover:text-lp-ink";
  return (
    <div
      role="tablist"
      className="mb-6 flex rounded-full border border-[#dfe7e4] bg-lp-card p-1"
    >
      <Link
        to="/login"
        role="tab"
        aria-selected={active === "login"}
        className={`${base} ${active === "login" ? on : off}`}
      >
        <UserRound size={16} aria-hidden="true" /> Login
      </Link>
      <Link
        to="/signup"
        role="tab"
        aria-selected={active === "signup"}
        className={`${base} ${active === "signup" ? on : off}`}
      >
        <UserPlus size={16} aria-hidden="true" /> Create account
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
