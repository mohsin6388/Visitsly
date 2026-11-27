import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, Check, CheckCircle2, Circle, LockKeyhole,
  MessageCircle, RefreshCw, Send, Sparkles, Users, X, ShieldCheck,
} from 'lucide-react';
import { orgApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import ConnectWhatsApp from '../whatsapp/ConnectWhatsApp.jsx';

const STEPS = [
  { key: 'whatsappDone', title: 'Connect WhatsApp', body: 'Connect your business number through Meta’s official flow.', to: '/whatsapp', cta: 'Connect number', icon: MessageCircle },
  { key: 'contactsDone', title: 'Import your leads', body: 'Bring your existing buyers from Excel or CSV.', to: '/leads', cta: 'Import leads', icon: Users },
  { key: 'propertiesDone', title: 'Add your properties', body: 'Give the AI assistant inventory to match with buyer needs.', to: '/properties', cta: 'Add properties', icon: Building2 },
  { key: 'firstMessageDone', title: 'Send your first message', body: 'Test an approved WhatsApp template before campaigns.', to: '/whatsapp#test-message', cta: 'Send test message', icon: Send },
];

/** WhatsApp-first onboarding. Progress stays tenant-scoped in Organization.onboarding. */
export default function SetupChecklist({ compact = false }) {
  const org = useAuthStore((state) => state.org);
  const setOrg = useAuthStore((state) => state.setOrg);
  const [refreshing, setRefreshing] = useState(false);

  const whatsappConnected = org?.whatsapp?.status === 'connected' && Boolean(org?.whatsapp?.phoneNumberId);
  const saved = org?.onboarding || {};
  const status = useMemo(() => ({
    ...saved,
    whatsappDone: whatsappConnected,
    contactsDone: whatsappConnected && Boolean(saved.contactsDone),
    propertiesDone: whatsappConnected && Boolean(saved.propertiesDone),
    firstMessageDone: whatsappConnected && Boolean(saved.firstMessageDone),
  }), [saved, whatsappConnected]);
  const count = STEPS.filter((step) => status[step.key]).length;
  const nextStep = STEPS.find((step) => !status[step.key]);
  const percent = Math.round((count / STEPS.length) * 100);

  const refreshOrg = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await orgApi.get();
      setOrg(response.data.org);
      return response.data.org;
    } catch {
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [setOrg]);

  useEffect(() => { void refreshOrg(); }, [refreshOrg]);

  if (!org) return null;
  if (compact && (saved.dismissed || count === STEPS.length)) return null;

  const dismiss = async () => {
    if (!whatsappConnected) return;
    const response = await orgApi.onboarding({ dismissed: true }).catch(() => null);
    if (response) setOrg(response.data.org);
  };

  return <div className={compact ? 'mb-1' : 'mx-auto max-w-5xl space-y-5'}>
    <section className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.025)] ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'}`}>
      {!compact && <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-emerald-100/70 blur-3xl" />}
      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10 ${compact ? 'h-11 w-11' : 'h-12 w-12'}`}><Sparkles size={compact ? 20 : 22} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Your workspace setup</p>
              <h2 className={`mt-1 font-display font-bold tracking-tight text-slate-950 ${compact ? 'text-base sm:text-lg' : 'text-2xl'}`}>{compact ? 'Get your AI assistant ready' : `Welcome to ${org.name || 'Visitsly'}`}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">{compact ? 'Connect WhatsApp first, then add leads and property inventory to start qualifying buyers.' : 'Complete these simple steps to let your property assistant turn WhatsApp inquiries into qualified leads and site visits.'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-right ring-1 ring-inset ring-slate-200/70"><p className="text-lg font-bold tabular-nums text-slate-950">{count}<span className="text-slate-400">/{STEPS.length}</span></p><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">steps complete</p></div>
            {compact && whatsappConnected && <button type="button" onClick={dismiss} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Hide setup checklist"><X size={16} /></button>}
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${percent}%` }} /></div>
        {org.status === 'trialing' && <p className="mt-2 text-xs text-slate-400">Free trial · {org.subscription?.daysLeft ?? '—'} days left</p>}

        {!whatsappConnected && <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-sm text-amber-950">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700 shadow-sm"><ShieldCheck size={17} /></span>
          <div><p className="font-semibold">Start by connecting WhatsApp</p><p className="mt-1 text-xs leading-5 text-amber-800">Meta authorization can sometimes need extra permissions or number verification. If something fails, the WhatsApp setup page will show the stage, error and next step; you can retry without losing this checklist.</p></div>
        </div>}

        <ol className={`mt-4 grid gap-3 ${compact ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2'}`}>
          {STEPS.map((step, index) => {
            const complete = status[step.key];
            const locked = index > 0 && !whatsappConnected;
            const isNext = !complete && !locked && nextStep?.key === step.key;
            const Icon = step.icon;
            return <li key={step.key} className={`relative flex min-w-0 flex-col rounded-xl border p-3.5 transition ${complete ? 'border-emerald-200 bg-emerald-50/50' : isNext ? 'border-emerald-300 bg-white shadow-[0_4px_16px_rgba(5,150,105,0.07)]' : 'border-slate-200 bg-slate-50/70'} ${locked ? 'opacity-70' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${complete ? 'bg-emerald-100 text-emerald-700' : isNext ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200'}`}>{complete ? <Check size={16} /> : <Icon size={16} />}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Step {index + 1}</span>
                <span className="ml-auto">{complete ? <CheckCircle2 size={16} className="text-emerald-600" /> : locked ? <LockKeyhole size={14} className="text-slate-400" /> : <Circle size={15} className="text-slate-300" />}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">{step.title}</p>
              <p className="mt-1 flex-1 text-xs leading-5 text-slate-500">{step.body}</p>
              {complete ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} /> Completed</p> : locked ? <p className="mt-3 text-[11px] font-medium text-slate-400">Unlocks after WhatsApp connects</p> : <Link to={step.to} className={`mt-3 inline-flex items-center gap-1.5 self-start text-xs font-bold ${isNext ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-600 hover:text-slate-900'}`}>{step.cta}<ArrowRight size={13} /></Link>}
            </li>;
          })}
        </ol>
        {refreshing && <p className="mt-3 flex items-center gap-2 text-xs text-slate-400"><RefreshCw size={13} className="animate-spin" /> Refreshing setup status…</p>}
      </div>
    </section>

    {!compact && !whatsappConnected && <section className="space-y-3">
      <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><MessageCircle size={18} /></span><div><h3 className="font-display text-lg font-bold tracking-tight text-slate-950">Step 1 · Connect your WhatsApp Business number</h3><p className="mt-1 text-sm leading-5 text-slate-500">Use Meta’s official signup. Keep access to this tab until the connection is confirmed.</p></div></div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-5"><ConnectWhatsApp onChange={refreshOrg} /></div>
    </section>}

    {!compact && whatsappConnected && count < STEPS.length && <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><CheckCircle2 size={18} /></span><div><p className="font-semibold text-emerald-950">WhatsApp is connected</p><p className="mt-1 text-sm text-emerald-800">Next, {nextStep?.title.toLowerCase() || 'finish your workspace setup'} to start using the AI property assistant.</p></div></div><Link to={nextStep?.to || '/dashboard'} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">Continue setup <ArrowRight size={15} /></Link></div>}

    {!compact && count === STEPS.length && <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><CheckCircle2 size={22} className="mt-0.5 text-emerald-700" /><div><p className="font-semibold text-emerald-950">Your workspace is ready</p><p className="mt-1 text-sm text-emerald-800">Your WhatsApp, leads and property inventory setup is complete.</p></div></div><Link to="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Open dashboard <ArrowRight size={15} /></Link></div>}
  </div>;
}

export function GetStartedPage() {
  return <div className="py-1"><SetupChecklist /></div>;
}
