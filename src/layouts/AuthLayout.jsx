import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Home } from "lucide-react";
import { publicApi } from "../api/saasApi.js";
import { BrandMark } from "../features/auth/AuthParts.jsx";

const HOME_URL = "https://visitsly.com";

const STATS = [
  ["3 sec", "first reply on WhatsApp"],
  ["24×7", "nights & holidays"],
  ["100%", "inquiries get a reply"],
  ["0", "manual follow-up calls"],
];

const CHECKS = ["Official WhatsApp Business API", "Setup done for you"];

/* Keeps the auth card fully visible on any desktop screen height:
   if the card is taller than the space available, it is scaled down to fit. */
function FitCard({ children, wide = false }) {
  const areaRef = useRef(null);
  const cardRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: null });

  useLayoutEffect(() => {
    const measure = () => {
      const area = areaRef.current;
      const card = cardRef.current;
      if (!area || !card) return;
      if (window.innerWidth < 1024) {
        setFit({ scale: 1, height: null });
        return;
      }
      const style = window.getComputedStyle(area);
      const avail =
        area.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      const natural = card.offsetHeight;
      const scale = Math.max(0.5, Math.min(1, avail / natural));
      setFit({ scale, height: natural * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cardRef.current);
    ro.observe(areaRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <main
      ref={areaRef}
      className="flex items-center justify-center px-4 pb-8 pt-20 sm:px-8 sm:pt-24 lg:min-h-0 lg:overflow-hidden lg:px-[4vw] lg:pb-5 lg:pt-[84px]"
    >
      <div
        className={`w-full ${wide ? "max-w-[640px]" : "max-w-[440px]"}`}
        style={{ height: fit.height ?? "auto" }}
      >
        <div
          ref={cardRef}
          style={{
            transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined,
            transformOrigin: "top center",
          }}
          className="w-full rounded-2xl bg-white p-6 shadow-[0_24px_60px_-20px_rgba(37,63,160,.30)] ring-1 ring-[#dbe3f5] sm:p-8 lg:[@media(max-height:820px)]:p-6"
        >
          {children}
        </div>
      </div>
    </main>
  );
}

export default function AuthLayout() {
  // Respect configured white-label branding; Visitsly is the default brand.
  const [brand, setBrand] = useState(null);
  const { pathname } = useLocation();

  useEffect(() => {
    let active = true;
    publicApi
      .branding(window.location.host)
      .then((response) => {
        if (active) setBrand(response.data.branding);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const configuredName = brand?.productName?.trim();
  // Treat the previous hard-coded product name as legacy branding.
  const name =
    configuredName && configuredName.toLowerCase() !== "propai"
      ? configuredName
      : "Visitsly";

  const onSignup = pathname.startsWith("/signup");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f8ff] lg:h-screen lg:min-h-0">
      {/* soft landing-page background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_420px_at_85%_10%,rgba(96,165,250,.28),transparent_70%),radial-gradient(600px_380px_at_0%_100%,rgba(99,102,241,.14),transparent_70%),linear-gradient(rgba(59,79,224,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(59,79,224,.045)_1px,transparent_1px)] [background-size:auto,auto,44px_44px,44px_44px]"
      />

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-4 sm:px-8 lg:px-[4vw]">
        <a
          href={HOME_URL}
          aria-label={`${name} home`}
          className="rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-lp-teal/30"
        >
          <BrandMark logoUrl={brand?.logoUrl} name={name} size="sm" />
        </a>

        <a
          href={HOME_URL}
          className="hidden items-center gap-2 rounded-xl border border-[#dbe3f5] bg-white px-4 py-2 text-sm font-semibold text-lp-ink shadow-sm transition hover:border-lp-teal/40 hover:text-lp-teal lg:flex"
        >
          <Home size={15} aria-hidden="true" /> Home
        </a>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className={`rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm transition ${onSignup ? "border-[#dbe3f5] text-lp-ink hover:border-lp-teal/40" : "border-lp-teal text-lp-teal"}`}
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="rounded-xl bg-gradient-to-r from-[#3B4FE0] to-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(59,79,224,.7)] transition hover:brightness-110"
          >
            Create account
          </Link>
        </div>
      </header>

      <div
        className={`relative z-10 grid min-h-screen lg:h-full lg:min-h-0 ${onSignup ? "lg:grid-cols-[0.85fr_1.15fr]" : "lg:grid-cols-[1.1fr_0.9fr]"}`}
      >
        {/* hero copy (desktop) */}
        <section className="hidden min-h-0 flex-col justify-center pl-[4vw] pr-6 pt-16 lg:flex">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dbe3f5] bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            AI for real estate
            <span className="rounded-full bg-gradient-to-r from-[#3B4FE0] to-[#0EA5E9] px-2 py-0.5 text-[10px] font-semibold text-white">
              AI
            </span>
          </p>
          <h2 className="mt-5 max-w-[560px] font-display text-[clamp(30px,min(5.4vh,3.4vw),50px)] font-bold leading-[1.12] tracking-[-0.025em] text-lp-ink">
            The Ultimate Visit Booking{" "}
            <span className="bg-gradient-to-r from-[#3B4FE0] to-[#0EA5E9] bg-clip-text text-transparent">
              AI System
            </span>
          </h2>
          <p className="mt-4 max-w-[480px] text-[15px] leading-7 text-slate-500">
            Replies to every property inquiry on WhatsApp in seconds, qualifies
            the buyer and books the site visit.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {CHECKS.map((c) => (
              <li
                key={c}
                className="rounded-full border border-[#dbe3f5] bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
              >
                <span className="mr-1.5 text-lp-teal">✓</span>
                {c}
              </li>
            ))}
          </ul>
          <dl className="mt-7 grid max-w-[560px] grid-cols-4 gap-3 [@media(max-height:680px)]:hidden">
            {STATS.map(([value, label]) => (
              <div
                key={value}
                className="rounded-xl border border-[#dbe3f5] bg-white px-3 py-3 text-center shadow-sm"
              >
                <dt className="font-display text-xl font-bold text-lp-teal">
                  {value}
                </dt>
                <dd className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* auth card */}
        <FitCard wide={onSignup}>
          <Outlet />
        </FitCard>
      </div>
    </div>
  );
}
