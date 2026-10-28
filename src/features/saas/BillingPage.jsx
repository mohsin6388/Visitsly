import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Loader2, Receipt, AlertTriangle, Phone, Mail } from 'lucide-react';
import { billingApi, growthApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { inr, fmtDate, StatusPill, UsageBar, LIMIT_LABEL, loadRazorpay } from '../../lib/saas.jsx';

const ADDON_KEYS = [
  ['extraUser', 'extraUsers', 'Extra user'],
  ['extraNumber', 'extraNumbers', 'Extra WhatsApp number'],
  ['extraAiConversations', 'aiPacks', '1,000 AI conversations'],
  ['voiceMinute', null, 'AI voice calling'],
  ['leadRevival', null, 'Purani leads revive campaign'],
];

function AddonsSection({ org, addons, onMessage }) {
  const request = async (key, label) => {
    const qty = key === 'voiceMinute' || key === 'leadRevival' ? 1 : Number(window.prompt(`${label} — kitne chahiye?`, '1'));
    if (!qty) return;
    try {
      const res = await growthApi.request({ type: key === 'voiceMinute' ? 'voice' : 'addon', addon: key, quantity: qty });
      onMessage({ tone: 'ok', text: res.message });
    } catch (err) {
      onMessage({ tone: 'error', text: err?.response?.data?.message || 'Request nahi gayi' });
    }
  };
  return (
    <section className="card min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink-900 dark:text-white">Add-ons</h2>
        {org.usage?.voiceMinutes > 0 && <span className="text-xs text-ink-500">AI calling is mahine: {org.usage.voiceMinutes} min</span>}
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADDON_KEYS.map(([key, field, label]) => {
          const a = addons?.[key];
          const have = field ? org.addons?.[field] || 0 : 0;
          return (
            <li key={key} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
              <span className="min-w-0 text-sm"><span className="block font-medium text-ink-800 dark:text-ink-100">{label}</span><span className="text-xs text-ink-500">{a ? `${inr(a.price)} / ${a.unit === 'month' ? 'mahina' : a.unit === 'minute' ? 'minute' : a.unit === 'once' ? 'ek baar' : 'pack'}` : ''}{have ? ` · aapke paas ${have}` : ''}</span></span>
              <button className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs" onClick={() => request(key, label)}>Request</button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-400">Request ke baad Visitsly team payment link bhejegi; payment hote hi add-on turant chalu.</p>
    </section>
  );
}

export default function BillingPage() {
  const qc = useQueryClient();
  const setOrg = useAuthStore((s) => s.setOrg);
  const { data, isLoading, error } = useQuery({ queryKey: ['billing'], queryFn: billingApi.get });
  const [cycle, setCycle] = useState('monthly');
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;
  if (error) return <div className="card text-sm text-red-600">{error?.response?.data?.message || 'Billing load nahi hua'}</div>;

  const { org, plans, invoices } = data.data;
  const sub = org.subscription || {};

  const refresh = async (nextOrg) => {
    if (nextOrg) setOrg(nextOrg);
    await qc.invalidateQueries({ queryKey: ['billing'] });
  };

  const buy = async (plan) => {
    setMessage(null);
    setBusy(plan.code);
    try {
      const ready = await loadRazorpay();
      if (!ready) throw new Error('Razorpay load nahi hua — internet check karke dobara try karein');
      const { data: co } = await billingApi.checkout(plan.code, cycle);
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: co.keyId,
          subscription_id: co.subscriptionId,
          name: co.productName,
          description: `${co.quote.planName} (${cycle === 'annual' ? 'yearly' : 'monthly'})`,
          prefill: co.prefill,
          theme: { color: '#064E3B' },
          handler: async (resp) => {
            try {
              const res = await billingApi.verify(resp);
              await refresh(res.data.org);
              setMessage({ tone: 'ok', text: `Payment ho gaya — ${co.quote.planName} plan active hai.` });
              resolve();
            } catch (err) { reject(err); }
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on('payment.failed', (resp) => reject(new Error(resp?.error?.description || 'Payment fail hua')));
        rzp.open();
      });
    } catch (err) {
      setMessage({ tone: 'error', text: err?.response?.data?.message || err.message });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Subscription current period ke end par band ho jayega. Data safe rahega. Cancel karein?')) return;
    setBusy('cancel');
    try {
      const res = await billingApi.cancel();
      await refresh(res.data.org);
      setMessage({ tone: 'ok', text: 'Subscription period ke end par band ho jayega.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err?.response?.data?.message || 'Cancel nahi hua' });
    } finally {
      setBusy(null);
    }
  };

  const usage = org.usage || {};
  const limits = org.limits || {};

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Plan & Billing</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Aapka plan, is mahine ka usage aur invoices.</p>
      </div>

      {message && (
        <div role="status" className={`rounded-xl px-4 py-3 text-sm ${message.tone === 'ok' ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>{message.text}</div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="card min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Current plan</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">{org.planName}</h2>
              {org.priceOverride && <p className="text-sm text-ink-500">Special price: {inr(org.priceOverride)}/mahina</p>}
            </div>
            <StatusPill status={org.status} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            {org.status === 'trialing' ? (
              <div><dt className="text-ink-400">Trial khatam</dt><dd className="font-semibold text-ink-900 dark:text-white">{fmtDate(org.trialEndsAt)} ({sub.daysLeft} din)</dd></div>
            ) : (
              <div><dt className="text-ink-400">{org.cancelAtPeriodEnd ? 'Band hoga' : 'Agla bill'}</dt><dd className="font-semibold text-ink-900 dark:text-white">{fmtDate(org.currentPeriodEnd)}</dd></div>
            )}
            <div><dt className="text-ink-400">Billing</dt><dd className="font-semibold capitalize text-ink-900 dark:text-white">{org.billingCycle === 'annual' ? 'Yearly' : 'Monthly'}</dd></div>
          </dl>
          {!sub.active && sub.reason && (
            <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{sub.reason}</div>
          )}
          {org.status === 'active' && !org.cancelAtPeriodEnd && (
            <button onClick={cancel} disabled={busy === 'cancel'} className="mt-5 text-sm font-semibold text-ink-500 underline-offset-2 hover:text-red-600 hover:underline">Cancel subscription</button>
          )}
        </section>

        <section className="card min-w-0 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Is mahine ka usage</p>
          {['contacts', 'aiConversations', 'users', 'campaignsPerMonth'].map((key) => (
            <UsageBar key={key} label={LIMIT_LABEL[key]} used={key === 'campaignsPerMonth' ? usage.campaigns : usage[key]} limit={limits[key]} />
          ))}
          <p className="text-xs text-ink-400">AI conversation = ek lead jisse AI ne is mahine baat ki (kitne bhi messages).</p>
        </section>
      </div>

      <AddonsSection org={org} addons={data.data.addons} onMessage={setMessage} />

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Plan badlein</h2>
          <div className="inline-flex rounded-lg border border-ink-200 bg-white p-1 text-sm dark:border-ink-700 dark:bg-ink-900" role="tablist" aria-label="Billing cycle">
            {['monthly', 'annual'].map((c) => (
              <button key={c} role="tab" aria-selected={cycle === c} onClick={() => setCycle(c)} className={`rounded-md px-3 py-1.5 font-semibold ${cycle === c ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{c === 'monthly' ? 'Monthly' : 'Yearly (2 mahine free)'}</button>
            ))}
          </div>
        </div>
        {!org.billingConfigured && (
          <div className="mt-4 rounded-xl border border-ink-200 bg-white p-4 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
            Online payment jald shuru hoga. Abhi UPI / bank transfer se payment karke Visitsly team se activate karwayein
            {org.sales?.phone && <> · <a className="inline-flex items-center gap-1 font-semibold text-brand-700" href={`https://wa.me/${org.sales.phone.replace(/\D/g, '')}`}><Phone size={14} />{org.sales.phone}</a></>}
            {org.sales?.email && <> · <a className="inline-flex items-center gap-1 font-semibold text-brand-700" href={`mailto:${org.sales.email}`}><Mail size={14} />{org.sales.email}</a></>}
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => {
            const current = p.code === org.plan && org.status === 'active' && org.billingCycle === cycle;
            const price = cycle === 'annual' ? p.annual : p.monthly;
            return (
              <article key={p.code} className={`flex flex-col rounded-xl2 border bg-white p-5 shadow-card dark:bg-ink-900 ${p.popular ? 'border-brand-600' : 'border-ink-100 dark:border-ink-800'}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-ink-900 dark:text-white">{p.name}</h3>
                  {p.popular && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Popular</span>}
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-ink-900 dark:text-white">{inr(price)}<span className="text-xs font-medium text-ink-400"> /{cycle === 'annual' ? 'saal' : 'mahina'}</span></p>
                <p className="text-xs text-ink-400">+ GST{p.setupFee ? ` · setup ${inr(p.setupFee)} (ek baar)` : ''}</p>
                <ul className="mt-3 flex-1 space-y-1.5 text-xs text-ink-600 dark:text-ink-300">
                  {p.highlights.slice(0, 5).map((h) => <li key={h} className="flex gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-brand-600" />{h}</li>)}
                </ul>
                {p.contactSales ? (
                  <button type="button" className="btn-secondary mt-4 w-full" onClick={() => growthApi.request({ type: 'enterprise', message: 'Enterprise plan ke baare mein baat karni hai' }).then((r) => setMessage({ tone: 'ok', text: r.message })).catch(() => setMessage({ tone: 'error', text: 'Request nahi gayi' }))}>Sales se baat karein</button>
                ) : current ? (
                  <span className="btn-secondary mt-4 w-full cursor-default opacity-70">Current plan</span>
                ) : (
                  <button onClick={() => buy(p)} disabled={!!busy || !org.billingConfigured} className="btn-primary mt-4 w-full gap-2">
                    {busy === p.code ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                    {org.status === 'active' ? 'Switch' : 'Choose'} {p.name}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-400">Card, UPI AutoPay ya netbanking e-mandate se auto-renew. Meta ke WhatsApp charges aapke WhatsApp Business account se seedhe Meta ko jaate hain.</p>
      </section>

      <section className="card min-w-0">
        <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><Receipt size={18} /> Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Abhi koi payment nahi hua.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase text-ink-400"><tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Details</th><th className="py-2 pr-4">Amount</th><th className="py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td className="py-2 pr-4 text-ink-600 dark:text-ink-300">{fmtDate(inv.paidAt || inv.createdAt)}</td>
                    <td className="py-2 pr-4 text-ink-900 dark:text-white">{inv.description}</td>
                    <td className="py-2 pr-4 font-mono">{inr(inv.amount)}</td>
                    <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inv.status === 'paid' ? 'Paid' : 'Failed'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
