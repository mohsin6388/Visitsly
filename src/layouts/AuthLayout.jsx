import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { publicApi } from '../api/saasApi.js';
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export default function AuthLayout() {
  // Respect configured white-label branding; Visitsly is the default brand.
  const [brand, setBrand] = useState(null);

  useEffect(() => {
    let active = true;
    publicApi.branding(window.location.host)
      .then((response) => {
        if (active) setBrand(response.data.branding);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const configuredName = brand?.productName?.trim();
  // Treat the previous hard-coded product name as legacy branding.
  const name = configuredName && configuredName.toLowerCase() !== 'propai'
    ? configuredName
    : 'Visitsly';

  return (
    <div className="login-layout min-h-screen bg-white text-slate-900 lg:grid lg:grid-cols-[minmax(440px,0.92fr)_1.08fr]">
      <section className="relative flex min-h-screen items-center overflow-hidden px-6 py-8 sm:px-10 lg:px-12 xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-28 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-indigo-100/50 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-[440px] py-5">
          <Link to="/pricing" className="inline-flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20">
            {brand?.logoUrl ? (
              <img src={brand.logoUrl} alt={`${name} logo`} className="h-11 w-11 rounded-2xl border border-slate-100 bg-white object-contain p-1.5 shadow-sm" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
                <Building2 size={23} aria-hidden="true" />
              </span>
            )}
            <span className="font-display text-2xl font-extrabold tracking-tight text-slate-950">{name}</span>
            <ArrowUpRight size={15} className="ml-0.5 text-slate-400" aria-hidden="true" />
          </Link>

          <div className="mt-10 sm:mt-12">
            <Outlet />
          </div>

          <div className="mt-9 flex items-center justify-center gap-2 text-xs text-slate-400 sm:justify-start">
            <ShieldCheck size={15} aria-hidden="true" />
            Secure access for your property team
          </div>
        </div>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden bg-[#0a1020] text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-20 h-[30rem] w-[30rem] rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-[26rem] w-[26rem] rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
        </div>

        <div className="relative flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white">
            <Sparkles size={16} aria-hidden="true" />
          </span>
          Your AI-powered real estate workspace
        </div>

        <div className="relative mx-auto w-full max-w-[660px] py-10">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3.5 py-2 text-xs font-semibold text-blue-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
            From first chat to site visit
          </p>
          <h2 className="max-w-xl font-display text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">
            Every lead deserves a <span className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-transparent">great follow-up.</span>
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300 xl:text-base xl:leading-7">
            Bring WhatsApp conversations, property matching, lead qualification and site visits into one calm, connected workflow.
          </p>

          <div className="mt-9 rounded-[28px] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                  <MessageCircle size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">WhatsApp lead assistant</p>
                  <p className="mt-0.5 text-xs text-slate-400">Conversation workflow preview</p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">AI assisted</span>
            </div>

            <div className="space-y-3 py-4">
              <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-5 text-slate-200">
                Looking for a 3 BHK in Noida, with possession soon.
              </div>
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md border border-blue-300/20 bg-blue-500/15 px-4 py-3 text-sm leading-5 text-blue-50">
                Got it. I’ll check matching properties and help arrange a visit.
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0c1528]/80 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Lead qualification</span>
                  <TrendingUp size={16} className="text-sky-300" aria-hidden="true" />
                </div>
                <p className="mt-2 text-sm font-semibold text-white">Requirements captured</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['3 BHK', 'Noida', 'Soon'].map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-medium text-slate-300">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0c1528]/80 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Next step</span>
                  <CalendarCheck size={16} className="text-violet-300" aria-hidden="true" />
                </div>
                <p className="mt-2 text-sm font-semibold text-white">Site visit follow-up</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-200">
                  <CheckCircle2 size={13} aria-hidden="true" /> Ready when lead confirms
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-slate-400">
          <span>{name} · Built for property teams</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={14} aria-hidden="true" /> Your workspace, your data</span>
        </div>
      </aside>
    </div>
  );
}
