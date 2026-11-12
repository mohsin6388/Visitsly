import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, Loader2, MessageCircle, Sparkles, CalendarCheck, BarChart3 } from 'lucide-react';
import { publicApi } from '../../api/saasApi.js';
import { money } from '../../lib/saas.jsx';

const FEATURES = [
  { icon: MessageCircle, title: 'AI WhatsApp agent', body: 'Har lead se Hinglish mein baat karta hai, budget aur location samajhta hai, sahi property aur brochure bhejta hai.' },
  { icon: CalendarCheck, title: 'Site visit booking', body: 'Chat mein hi visit fix — calendar, reminder aur follow-up apne aap.' },
  { icon: Sparkles, title: 'Lead scoring', body: 'Har reply par score. 30+ lead, 60+ hot. Aapki team sirf garam leads par time lagaye.' },
  { icon: BarChart3, title: 'Meta bill dashboard', body: 'Kitne messages gaye, kitna charge laga — sab ek jagah.' },
];

export default function PricingPage() {
  const [data, setData] = useState(null);
  const [cycle, setCycle] = useState('monthly');
  const [region, setRegion] = useState(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /Dubai|Muscat|Riyadh|Qatar|Bahrain|Kuwait/.test(tz) ? 'ae' : 'in';
    } catch { return 'in'; }
  });
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    publicApi.plans(region).then((r) => setData(r.data)).catch((e) => setError(e?.response?.data?.message || 'Plans load nahi hue'));
  }, [region]);

  const cur = data?.currency || (region === 'ae' ? 'AED' : 'INR');
  const taxNote = data ? (data.taxRate ? `+ ${Math.round(data.taxRate * 100)}% ${data.taxLabel}` : `excl. ${data.taxLabel}`) : '';

  return (
    <div className="min-h-screen bg-[#fcfbf8] text-ink-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/pricing" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-white"><Building2 size={20} /></span>
          <span className="font-display text-lg font-bold text-emerald-950">Visitsly</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/login" className="rounded-lg px-3 py-2 font-semibold text-emerald-950 hover:bg-emerald-50">Login</Link>
          <Link to="/signup" className="btn-primary !rounded-lg !bg-emerald-950 hover:!bg-emerald-900">Free trial</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-6 pt-8 text-center sm:px-6 sm:pt-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Real estate ke liye WhatsApp AI CRM</p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-3xl font-bold leading-tight text-emerald-950 sm:text-5xl">Har lead se baat. Har visit book. Ek hi CRM mein.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-600">CRM + bulk WhatsApp + AI agent jo chat karke site visit book kare. {data?.trialDays || 7} din free trial, card nahi chahiye.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1 text-sm shadow-card" role="tablist" aria-label="Country">
            {[['in', '🇮🇳 India'], ['ae', '🇦🇪 UAE']].map(([r, label]) => (
              <button key={r} role="tab" aria-selected={region === r} onClick={() => setRegion(r)} className={`rounded-lg px-4 py-2 font-semibold transition ${region === r ? 'bg-emerald-950 text-white' : 'text-ink-600 hover:bg-ink-50'}`}>{label}</button>
            ))}
          </div>
          <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1 text-sm shadow-card" role="tablist" aria-label="Billing cycle">
            {[['monthly', 'Monthly'], ['halfyearly', '6 months — no setup fee'], ['annual', 'Yearly — 2 months free']].map(([c, label]) => (
              <button key={c} role="tab" aria-selected={cycle === c} onClick={() => setCycle(c)} className={`rounded-lg px-4 py-2 font-semibold transition ${cycle === c ? 'bg-emerald-950 text-white' : 'text-ink-600 hover:bg-ink-50'}`}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        {!data && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" /></div>}
        {data && (
          <div className={`grid gap-4 sm:grid-cols-2 ${data.plans.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            {data.plans.map((p) => {
              const perMonth = cycle === 'annual' ? Math.round(p.annual / 12) : p.monthly;
              const periodTotal = cycle === 'annual' ? p.annual : cycle === 'halfyearly' ? p.halfyearly : p.monthly;
              const setupLine = !p.setupFee ? 'No setup fee' : cycle === 'monthly' ? `setup ${money(p.setupFee, cur)} one-time` : `setup ${money(p.setupFee, cur)} waived`;
              return (
                <article key={p.code} className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-card ${p.popular ? 'border-emerald-700 ring-2 ring-emerald-700/20' : 'border-ink-200'}`}>
                  {p.popular && <span className="absolute -top-3 left-6 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-bold text-white">Most popular</span>}
                  <h2 className="font-display text-xl font-bold text-emerald-950">{p.name}</h2>
                  <p className="text-sm text-ink-500">{p.tagline}</p>
                  <p className="mt-5 font-display text-3xl font-bold text-ink-900">
                    {p.contactSales ? <span className="text-2xl">{money(perMonth, cur)}+</span> : money(perMonth, cur)}
                    <span className="text-sm font-medium text-ink-500"> /month</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {cycle !== 'monthly' && !p.contactSales ? `${money(periodTotal, cur)} paid ${cycle === 'annual' ? 'yearly' : 'every 6 months'} · ` : ''}{taxNote} · {setupLine}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm text-ink-700">
                    {p.highlights.map((h) => <li key={h} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-700" />{h}</li>)}
                  </ul>
                  {p.contactSales ? (
                    <a href={data.sales?.phone ? `https://wa.me/${data.sales.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Visitsly Enterprise plan ke baare mein baat karni hai')}` : `mailto:${data.sales?.email || ''}?subject=Visitsly%20Enterprise`} className="btn-secondary mt-6 w-full !rounded-xl">Sales se baat karein</a>
                  ) : (
                    <Link to={`/signup?plan=${p.code}&region=${region}`} className={`mt-6 w-full !rounded-xl ${p.popular ? 'btn-primary !bg-emerald-950 hover:!bg-emerald-900' : 'btn-secondary'}`}>Free trial shuru karein</Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-ink-500">Meta ke WhatsApp message charges plan se alag hain aur aapke Visitsly wallet se jaate hain. Bulk messaging hamari <Link to="/messaging-policy" className="underline">Bulk Messaging Policy</Link> ke andar hi hoti hai.</p>
        {data?.addons && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-ink-200 bg-white p-5 text-sm">
            <h3 className="font-semibold text-ink-900">Add-ons</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {data.addons.map((a) => (
                <li key={a.code} className="rounded-lg bg-ink-50 px-3 py-2">
                  <span className="block text-ink-600">{a.name}</span>
                  <span className="font-semibold">{a.display || (a.price == null ? 'On request' : money(a.price, cur))}</span>
                  {!a.display && a.price != null && <span className="text-ink-500"> / {a.unit === 'month' ? 'month' : a.unit === 'once' ? 'one-time' : a.unit}</span>}
                  {a.note && <span className="block text-xs text-ink-500">{a.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="border-t border-ink-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={20} /></span>
              <h3 className="mt-3 font-semibold text-ink-900">{title}</h3>
              <p className="mt-1 text-sm text-ink-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="py-8 text-center text-xs text-ink-500">© {new Date().getFullYear()} Visitsly · Deific Digital</footer>
    </div>
  );
}
