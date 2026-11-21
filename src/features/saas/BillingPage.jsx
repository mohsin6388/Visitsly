import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, CreditCard, Receipt, AlertTriangle, Phone, Mail, Gift, Sparkles, Users, Smartphone, Bot, PhoneCall, RotateCcw, Plus, Minus } from 'lucide-react';
import { billingApi, growthApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { fmtDate, StatusPill, UsageBar, LIMIT_LABEL, loadRazorpay, errText, money } from '../../lib/saas.jsx';
import { showDialog, toast, Skeleton, confirmDialog } from '../../components/ui/index.jsx';

export { money };

/** Contacts, bulk messages, AI conversations (+ users, campaigns): used vs limit. Trial = totals for the trial. */
export function UsageMeters({ org, compact = false }) {
  const usage = org?.usage || {};
  const limits = org?.limits || {};
  const trialing = org?.status === 'trialing';
  const keys = compact ? ['contacts', 'bulkMessages', 'aiConversations'] : ['contacts', 'bulkMessages', 'aiConversations', 'users', 'campaignsPerMonth'];
  const label = (key) => {
    if (!trialing) return LIMIT_LABEL[key];
    return { contacts: 'Contacts uploaded', bulkMessages: 'Bulk WhatsApp messages', aiConversations: 'AI conversations', users: 'Logins', campaignsPerMonth: 'Campaigns' }[key] || LIMIT_LABEL[key];
  };
  return (
    <div className="space-y-4">
      {keys.map((key) => (
        <UsageBar key={key} label={label(key)} used={key === 'campaignsPerMonth' ? usage.campaigns : usage[key]} limit={limits[key]} />
      ))}
      {!compact && limits.aiRepliesPerContact != null && <p className="text-xs text-ink-500 dark:text-ink-400">AI sends up to {Number(limits.aiRepliesPerContact).toLocaleString('en-IN')} replies per contact.</p>}
    </div>
  );
}

const ADDONS = [
  { key: 'extraUser', label: 'Extra team member', icon: Users, unit: '/ user / month', step: 1, min: 1, field: 'extraUsers' },
  { key: 'extraNumber', label: 'Extra WhatsApp number', icon: Smartphone, unit: '/ number / month', step: 1, min: 1, field: 'extraNumbers' },
  { key: 'extraAiConversations', label: '1,000 extra AI conversations', icon: Bot, unit: '/ pack / month', step: 1, min: 1, field: 'aiPacks' },
  { key: 'voiceMinute', label: 'AI calling minutes', icon: PhoneCall, unit: '/ minute', step: 100, min: 100 },
  { key: 'leadRevival', label: 'Old leads revival campaign', icon: RotateCcw, unit: 'one-time', step: 1, min: 1, max: 1 },
];

/** Razorpay Checkout wrapped in a promise: resolves {status: 'success'|'dismissed'}, rejects on failure. */
function openCheckout(options) {
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      theme: { color: '#059669' },
      handler: (resp) => resolve({ status: 'success', resp }),
      modal: { ondismiss: () => resolve({ status: 'dismissed' }), confirm_close: true },
    });
    rzp.on('payment.failed', (resp) => reject(Object.assign(new Error(resp?.error?.description || 'Payment failed'), { reason: resp?.error?.reason, paymentFailed: true })));
    rzp.open();
  });
}

function paymentFailedDialog(err) {
  showDialog({
    tone: 'error',
    title: 'Payment failed ❌',
    message: `${err.message || 'The bank declined the payment.'}\n\nIf money was deducted, it is refunded automatically in 5–7 days. Try another card or UPI.`,
  });
}

function AddonCard({ addon, price, currency, have, onBuy, busy, disabled }) {
  const [qty, setQty] = useState(addon.min);
  const Icon = addon.icon;
  const total = (Number(price) || 0) * qty;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-ink-100 p-4 dark:border-ink-800">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"><Icon size={18} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900 dark:text-white">{addon.label}</p>
          <p className="text-xs text-ink-500">{price != null ? `${money(price, currency)} ${addon.unit}` : ''}{have ? ` · you have ${have}` : ''}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {addon.max === 1 ? <span className="text-xs text-ink-500">1</span> : (
          <div className="flex items-center rounded-lg border border-ink-200 dark:border-ink-700">
            <button type="button" className="p-1.5" aria-label="Less" onClick={() => setQty((q) => Math.max(addon.min, q - addon.step))}><Minus size={14} /></button>
            <span className="min-w-[48px] text-center text-sm font-semibold">{qty}</span>
            <button type="button" className="p-1.5" aria-label="More" onClick={() => setQty((q) => q + addon.step)}><Plus size={14} /></button>
          </div>
        )}
        <button type="button" className="btn-primary gap-1.5 !px-3 !py-1.5 text-xs" disabled={busy || disabled} onClick={() => onBuy(addon, qty)}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />} Pay {money(total, currency)}
        </button>
      </div>
    </li>
  );
}

export default function BillingPage() {
  const qc = useQueryClient();
  const setOrg = useAuthStore((s) => s.setOrg);
  const { data, isLoading, error } = useQuery({ queryKey: ['billing'], queryFn: billingApi.get });
  const [cycle, setCycle] = useState('monthly');
  const [busy, setBusy] = useState(null);

  if (isLoading) return <div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 !rounded-2xl" /><Skeleton className="h-40 !rounded-2xl" /></div>;
  if (error) return <div className="card text-sm text-red-600">{errText(error, 'Could not load billing')}</div>;

  const { org, plans, invoices, addons, currency = 'INR', taxRate = 0, activeAddons = [], recommendedPlan = null, annualMonthsCharged = 10 } = data.data;
  const freeMonths = 12 - Number(annualMonthsCharged || 10);
  const voiceUsage = org.voiceUsage || null;
  const sub = org.subscription || {};
  const usage = org.usage || {};
  const limits = org.limits || {};
  const taxText = currency === 'INR' ? '+ 18% GST' : taxRate ? `+ ${Math.round(taxRate * 100)}% tax` : 'Tax included';

  const refresh = async (nextOrg) => {
    if (nextOrg) setOrg(nextOrg);
    await qc.invalidateQueries({ queryKey: ['billing'] });
  };

  const buy = async (plan) => {
    setBusy(plan.code);
    try {
      if (!(await loadRazorpay())) throw new Error('Could not open the payment window — check your internet and try again');
      const { data: co } = await billingApi.checkout(plan.code, cycle);
      if (co.currencyNote) toast.info(co.currencyNote);
      const isOrder = co.mode === 'order' || Boolean(co.orderId);
      const result = await openCheckout({
        key: co.keyId,
        ...(isOrder ? { order_id: co.orderId, amount: co.amount, currency: co.currency } : { subscription_id: co.subscriptionId }),
        name: co.productName,
        description: `${co.quote.planName} (${cycle === 'annual' ? 'yearly' : 'monthly'})`,
        prefill: co.prefill,
      });
      if (result.status === 'dismissed') { toast.info('Payment cancelled. Try again anytime.'); return; }
      const res = isOrder ? await billingApi.verifyOrder(result.resp) : await billingApi.verify(result.resp);
      await refresh(res.data.org);
      showDialog({ tone: 'success', title: 'Payment successful 🎉', message: `${co.quote.planName} plan is now active.\nAmount: ${money(co.quote.firstPayment, co.quote.currency)}${isOrder ? `\nPaid for one ${cycle === 'annual' ? 'year' : 'month'} — renew from this page before it ends.` : ''}\nYour invoice is under "Invoices".` });
    } catch (err) {
      if (err.paymentFailed) paymentFailedDialog(err);
      else showDialog({ title: 'Payment not completed', message: errText(err) });
    } finally {
      setBusy(null);
    }
  };

  const buyAddon = async (addon, qty) => {
    setBusy(`addon:${addon.key}`);
    try {
      if (!(await loadRazorpay())) throw new Error('Could not open the payment window — check your internet and try again');
      const { data: co } = await billingApi.addonCheckout(addon.key, qty);
      const result = await openCheckout({
        key: co.keyId,
        order_id: co.orderId,
        amount: co.amount,
        currency: co.currency,
        name: co.productName,
        description: `${co.quote.name} × ${co.quote.quantity}`,
        prefill: co.prefill,
      });
      if (result.status === 'dismissed') { toast.info('Payment cancelled.'); return; }
      const res = await billingApi.addonVerify(result.resp);
      await refresh(res.data.org);
      showDialog({ tone: 'success', title: 'Payment successful 🎉', message: `${co.quote.name} × ${co.quote.quantity} is now active.\nAmount: ${money(co.quote.total, co.quote.currency)}` });
    } catch (err) {
      if (err.paymentFailed) paymentFailedDialog(err);
      else showDialog({ title: 'Payment not completed', message: errText(err) });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!(await confirmDialog({ title: 'Cancel subscription?', message: 'It ends at the end of the current period. Your data stays safe.', confirmLabel: 'Cancel subscription', cancelLabel: 'Keep plan', danger: true }))) return;
    setBusy('cancel');
    try {
      const res = await billingApi.cancel();
      await refresh(res.data.org);
      toast.success('Subscription will end at the end of this period.');
    } catch (err) {
      toast.error(errText(err, 'Could not cancel'));
    } finally { setBusy(null); }
  };

  const trialing = org.status === 'trialing';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Plans & billing</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Plans, add-ons and invoices. Prices in {currency}.</p>
      </div>

      {/* Current status / trial */}
      <section className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${trialing ? 'border-sky-200 bg-gradient-to-r from-sky-50 to-emerald-50 dark:border-sky-900 dark:from-sky-950/30 dark:to-emerald-950/20' : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900'}`}>
        <div className="flex items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${trialing ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'}`}>{trialing ? <Gift size={22} /> : <Sparkles size={22} />}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-bold text-ink-900 dark:text-white">{trialing ? 'Free trial' : `${org.planName} plan`}</h2><StatusPill status={org.status} /></div>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              {trialing ? <>Trial ends <b>{fmtDate(org.trialEndsAt)}</b> ({sub.daysLeft ?? 0} days left). Pick a plan below to keep going.</> : org.cancelAtPeriodEnd ? <>Plan ends <b>{fmtDate(org.currentPeriodEnd)}</b>.</> : org.billingMode === 'order' ? <>Paid until <b>{fmtDate(org.currentPeriodEnd)}</b> · renew below before it ends</> : <>Next bill: <b>{fmtDate(org.currentPeriodEnd)}</b> · {org.billingCycle === 'annual' ? 'Yearly' : 'Monthly'}</>}
            </p>
            {!sub.active && sub.reason && <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-200"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{sub.reason}</p>}
          </div>
        </div>
        {org.status === 'active' && !org.cancelAtPeriodEnd && <button type="button" onClick={cancel} disabled={busy === 'cancel'} className="self-start text-sm font-semibold text-ink-500 hover:text-red-600 hover:underline sm:self-center">Cancel subscription</button>}
      </section>

      {/* Plans */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Plans</h2>
          <div className="inline-flex rounded-lg border border-ink-200 bg-white p-1 text-sm dark:border-ink-700 dark:bg-ink-900" role="tablist" aria-label="Billing cycle">
            {['monthly', 'annual'].map((c) => <button key={c} type="button" role="tab" aria-selected={cycle === c} onClick={() => setCycle(c)} className={`rounded-md px-3 py-1.5 font-semibold ${cycle === c ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{c === 'monthly' ? 'Monthly' : freeMonths > 0 ? `Yearly (${freeMonths} month${freeMonths === 1 ? '' : 's'} free)` : 'Yearly'}</button>)}
          </div>
        </div>
        {!org.billingConfigured && (
          <div className="mt-4 rounded-xl border border-ink-200 bg-white p-4 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
            Online payment is not switched on for this workspace yet. Pay by UPI / bank transfer and our team will activate your plan
            {org.sales?.phone && <> · <a className="inline-flex items-center gap-1 font-semibold text-brand-700" href={`https://wa.me/${org.sales.phone.replace(/\D/g, '')}`}><Phone size={14} />{org.sales.phone}</a></>}
            {org.sales?.email && <> · <a className="inline-flex items-center gap-1 font-semibold text-brand-700" href={`mailto:${org.sales.email}`}><Mail size={14} />{org.sales.email}</a></>}
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => {
            const renewable = org.billingMode === 'order' && org.status === 'active';
            const current = p.code === org.plan && org.status === 'active' && org.billingCycle === cycle && !renewable;
            const price = cycle === 'annual' ? p.annual : p.monthly;
            const custom = p.customPricing || price == null;
            const isRec = recommendedPlan === p.code;
            const highlight = isRec || (!recommendedPlan && p.popular);
            return (
              <article key={p.code} className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-card dark:bg-ink-900 ${highlight ? 'border-brand-600 ring-2 ring-brand-600/15' : 'border-ink-100 dark:border-ink-800'}`}>
                {isRec ? <span className="absolute -top-2.5 left-4 rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">Recommended for you</span>
                  : p.popular && <span className="absolute -top-2.5 left-4 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-950">Most popular</span>}
                <h3 className="font-semibold text-ink-900 dark:text-white">{p.name}</h3>
                {p.tagline && <p className="text-xs text-ink-500">{p.tagline}</p>}
                {custom ? (
                  <>
                    <p className="mt-3 font-display text-xl font-bold text-ink-900 dark:text-white">Custom pricing</p>
                    <p className="text-xs text-ink-400">Contact sales</p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 font-display text-2xl font-bold text-ink-900 dark:text-white">{money(price, p.currency || currency)}<span className="text-xs font-medium text-ink-400"> /{cycle === 'annual' ? 'year' : 'month'}</span></p>
                    <p className="text-xs text-ink-400">{taxText}</p>
                  </>
                )}
                <ul className="mt-3 flex-1 space-y-1.5 text-xs text-ink-600 dark:text-ink-300">
                  {p.highlights.slice(0, 7).map((h) => <li key={h} className="flex gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-brand-600" />{h}</li>)}
                </ul>
                {p.contactSales ? (
                  <button type="button" className="btn-secondary mt-4 w-full" onClick={() => growthApi.request({ type: 'enterprise', message: 'I would like to discuss the Enterprise plan' }).then((r) => toast.success(r.message)).catch(() => toast.error('Request failed'))}>Contact sales</button>
                ) : current ? (
                  <span className="btn-secondary mt-4 w-full cursor-default opacity-70">Current plan ✓</span>
                ) : (
                  <button type="button" onClick={() => buy(p)} disabled={!!busy || !org.billingConfigured} className="btn-primary mt-4 w-full gap-2">{busy === p.code ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}{renewable && p.code === org.plan ? 'Renew' : org.status === 'active' ? 'Switch to this plan' : `Get ${p.name}`}</button>
                )}
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-400">Auto-renews by card{currency === 'INR' ? ', UPI AutoPay or netbanking' : ''}. Meta’s WhatsApp charges are billed directly to your WhatsApp Business account.</p>
      </section>

      {/* Add-ons */}
      <section className="card min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink-900 dark:text-white">Add-ons</h2>
          {usage.voiceMinutes > 0 && <span className="text-xs text-ink-500">AI calling this month: {usage.voiceMinutes} min</span>}
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADDONS.map((a) => {
            const fromGrants = activeAddons.filter((g) => g.key === a.key).reduce((n, g) => n + (g.quantity || 0), 0);
            return <AddonCard key={a.key} addon={a} price={addons?.[a.key]?.price} currency={currency} have={(a.field ? org.addons?.[a.field] || 0 : 0) + fromGrants} busy={busy === `addon:${a.key}`} disabled={!!busy || !org.billingConfigured} onBuy={buyAddon} />;
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-400">Add-ons activate right after payment. Monthly add-ons last 1 month.</p>
      </section>

      {/* Usage */}
      <section className="card min-w-0 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{trialing ? 'Free trial usage (whole trial)' : 'Usage this month'}</p>
        <UsageMeters org={org} />
        {voiceUsage?.enabled && (
          <p className="text-xs text-ink-500 dark:text-ink-400">
            AI calling: {voiceUsage.usedMinutes} min used of {voiceUsage.includedMinutes + voiceUsage.prepaidMinutes} included this month
            {voiceUsage.overageMinutes > 0 ? ` · ${voiceUsage.overageMinutes} extra min at ${money(addons?.voiceMinute?.price, currency)}/min` : ''}
          </p>
        )}
        {voiceUsage && !voiceUsage.enabled && <p className="text-xs text-ink-500 dark:text-ink-400">AI calling and email campaigns are available on paid plans.</p>}
      </section>

      {/* Invoices */}
      <section className="card min-w-0">
        <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><Receipt size={18} /> Invoices</h2>
        {invoices.length === 0 ? <p className="mt-3 text-sm text-ink-500">No payments yet.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase text-ink-400"><tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Details</th><th className="py-2 pr-4">Amount</th><th className="py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td className="py-2 pr-4 text-ink-600 dark:text-ink-300">{fmtDate(inv.paidAt || inv.createdAt)}</td>
                    <td className="py-2 pr-4 text-ink-900 dark:text-white">{inv.description}</td>
                    <td className="py-2 pr-4 font-mono">{money(inv.amount, inv.currency || 'INR')}</td>
                    <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inv.status === 'paid' ? 'Paid' : inv.status === 'refunded' ? 'Refunded' : 'Failed'}</span></td>
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
