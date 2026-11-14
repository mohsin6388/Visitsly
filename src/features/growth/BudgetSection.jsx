import { useEffect, useState } from 'react';
import { Wallet, Send, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { budgetApi } from '../../api/saasApi.js';
import { errText, Toggle } from '../../lib/saas.jsx';
import { toast, showDialog, Skeleton } from '../../components/ui/index.jsx';

function money(n, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: n < 100 ? 2 : 0 }).format(Number(n) || 0);
  } catch {
    return `${currency} ${Math.round(Number(n) || 0)}`;
  }
}

const CAT = { MARKETING: 'WhatsApp marketing', UTILITY: 'WhatsApp utility', AUTHENTICATION: 'WhatsApp OTP', SERVICE: 'WhatsApp chat (service)', REFERRAL_CONVERSION: 'Ad se aaye chats' };

/** Reports → Budget: set a spend budget and get a WhatsApp report before it runs out. */
export default function BudgetSection() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = () => {
    setLoading(true);
    budgetApi.get()
      .then((r) => { setData(r.data); setForm(r.data.budget); })
      .catch((e) => toast.error(errText(e, 'Budget load nahi hua')))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async (patch = {}) => {
    const body = { ...form, ...patch };
    setBusy('save');
    try {
      const r = await budgetApi.update({
        enabled: body.enabled,
        amount: Number(body.amount) || 0,
        currency: body.currency,
        period: body.period,
        startDate: body.period === 'custom' ? body.startDate : null,
        endDate: body.period === 'custom' ? body.endDate : null,
        thresholds: body.thresholds,
        alertPhone: String(body.alertPhone || '').trim(),
        pauseCampaignsAtLimit: !!body.pauseCampaignsAtLimit,
        rates: body.rates,
      });
      setData(r.data);
      setForm(r.data.budget);
      toast.success(r.message || 'Save ho gaya');
    } catch (e) {
      showDialog({ title: 'Budget save nahi hua', message: errText(e) });
    } finally { setBusy(''); }
  };

  const sendNow = async () => {
    setBusy('send');
    try {
      const r = await budgetApi.sendReport();
      showDialog({ tone: r.data?.result?.whatsapp?.some((x) => x.ok) ? 'success' : 'warning', title: 'Kharcha report', message: r.message });
    } catch (e) {
      showDialog({ title: 'Report nahi gayi', message: errText(e) });
    } finally { setBusy(''); }
  };

  if (loading && !data) return <Skeleton className="h-64 !rounded-2xl" />;
  if (!data || !form) return null;
  const sp = data.spend;
  const cur = sp.currency;
  const pct = Math.min(100, sp.percent || 0);
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <section className="card min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900 dark:text-white"><Wallet size={19} className="text-brand-600" /> Kharcha & budget</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">WhatsApp (Meta) + AI calling ka kharcha. Budget ke paas pahunchte hi aapke WhatsApp par report aayegi.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="btn-secondary !px-2.5 !py-2" aria-label="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          <button type="button" onClick={sendNow} disabled={busy === 'send'} className="btn-secondary gap-2 !py-2 text-sm">{busy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Abhi report bhejein</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[['Ab tak kharcha', money(sp.total, cur)], ['Budget', sp.amount ? money(sp.amount, cur) : 'Set nahi'], ['Bacha hua', sp.amount ? money(sp.remaining, cur) : '—'], ['Isi speed se period end tak', money(sp.projected, cur)]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60"><p className="text-xs text-ink-500">{l}</p><p className="mt-1 font-display text-lg font-bold text-ink-900 dark:text-white">{v}</p></div>
        ))}
      </div>
      {sp.amount > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-ink-500"><span>{sp.period.label}</span><span className="font-semibold">{sp.percent}% use hua</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} /></div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
          <p className="text-sm font-semibold text-ink-900 dark:text-white">Kahan kharcha hua</p>
          {sp.whatsapp.error && <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {sp.whatsapp.error}</p>}
          <ul className="mt-2 space-y-1.5 text-sm">
            {sp.whatsapp.lines.filter((l) => l.volume > 0).map((l) => (
              <li key={l.category} className="flex justify-between gap-2"><span className="text-ink-600 dark:text-ink-300">{CAT[l.category] || l.category} · {Number(l.volume).toLocaleString('en-IN')} msgs</span><b className="text-ink-900 dark:text-white">{money(l.cost, cur)}</b></li>
            ))}
            <li className="flex justify-between gap-2"><span className="text-ink-600 dark:text-ink-300">AI calling · {sp.voice.minutes} min ({sp.voice.calls} calls)</span><b className="text-ink-900 dark:text-white">{money(sp.voice.cost, cur)}</b></li>
          </ul>
          {sp.whatsapp.estimated && <p className="mt-3 text-[11px] text-ink-400">WhatsApp kharcha andaazan hai (messages × rate). Final bill Meta ke invoice par hota hai — rates neeche badal sakte hain.</p>}
        </div>

        <div className="space-y-3 rounded-xl border border-ink-100 p-4 dark:border-ink-800">
          <Toggle checked={!!form.enabled} onChange={(v) => set({ enabled: v })} label="Budget alert chalu karein" help="Har ghante check hota hai" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Budget ({form.currency})<input type="number" min={0} className="input-field mt-1" value={form.amount || ''} onChange={(e) => set({ amount: e.target.value })} placeholder="5000" /></label>
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Period
              <select className="input-field mt-1" value={form.period} onChange={(e) => set({ period: e.target.value })}><option value="month">Har mahina</option><option value="custom">Apni dates</option></select>
            </label>
            {form.period === 'custom' && <>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Se<input type="date" className="input-field mt-1" value={form.startDate || ''} onChange={(e) => set({ startDate: e.target.value })} /></label>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Tak<input type="date" className="input-field mt-1" value={form.endDate || ''} onChange={(e) => set({ endDate: e.target.value })} /></label>
            </>}
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-600 dark:text-ink-300">Kitna % hone par WhatsApp report aaye</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[50, 75, 80, 90, 100].map((t) => {
                const on = (form.thresholds || []).includes(t);
                return <button key={t} type="button" onClick={() => set({ thresholds: on ? form.thresholds.filter((x) => x !== t) : [...(form.thresholds || []), t].sort((a, b) => a - b) })} className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>{t}%</button>;
              })}
            </div>
          </div>
          <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300">Report kis WhatsApp number par (khali = Settings wala alert number)
            <input className="input-field mt-1" inputMode="tel" placeholder="9876543210" value={form.alertPhone || ''} onChange={(e) => set({ alertPhone: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200"><input type="checkbox" checked={!!form.pauseCampaignsAtLimit} onChange={(e) => set({ pauseCampaignsAtLimit: e.target.checked })} /> 100% hone par bulk campaigns apne aap pause karein</label>
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-ink-600 dark:text-ink-300">Rates (andaaza lagane ke liye, {form.currency} mein)</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[['marketing', 'Marketing message'], ['utility', 'Utility message'], ['authentication', 'OTP message'], ['service', 'Chat (service)'], ['voicePerMinute', 'AI call / minute']].map(([k, l]) => (
                <label key={k} className="text-ink-500">{l}<input type="number" step="0.01" min={0} className="input-field mt-1 !py-1.5" value={form.rates?.[k] ?? ''} onChange={(e) => set({ rates: { ...form.rates, [k]: e.target.value } })} /></label>
              ))}
            </div>
          </details>
          <button type="button" onClick={() => save()} disabled={busy === 'save'} className="btn-primary gap-2">{busy === 'save' && <Loader2 size={15} className="animate-spin" />} Budget save karein</button>
        </div>
      </div>
    </section>
  );
}
