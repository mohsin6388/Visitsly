import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, Check, Download, Send, CreditCard, Receipt, AlertTriangle, Phone, Mail, Gift, Sparkles, Users, Smartphone, Bot, PhoneCall, RotateCcw, Plus, Minus } from 'lucide-react';
import { billingApi, growthApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { fmtDate, StatusPill, UsageBar, LIMIT_LABEL, loadRazorpay, errText, money } from '../../lib/saas.jsx';
import { showDialog, toast, confirmDialog } from '../../components/ui/index.jsx';
import ConfirmOrderModal from './ConfirmOrderModal.jsx';
import { openCheckout, paymentFailedDialog } from '../../lib/checkout.js';

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

function AddonCard({ addon, price, currency, have, onBuy, busy, disabled, locked = false }) {
  const [qty, setQty] = useState(addon.min);
  const Icon = addon.icon;
  const total = (Number(price) || 0) * qty;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-ink-100 p-4 dark:border-ink-800">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"><Icon size={18} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900 dark:text-white">{addon.label}</p>
          {locked && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Available on Growth &amp; above</p>}
          <p className="text-xs text-ink-500">{price != null ? `${money(price, currency)} ${addon.unit}` : ''}{have ? ` · you have ${have}` : ''}</p>
        </div>
      </div>
      {locked ? (
        <Link to="/billing" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="btn-secondary !py-1.5 text-center text-xs">Upgrade to Growth to use AI calling</Link>
      ) : (
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
      )}
    </li>
  );
}

/** PDF download (blob, with the auth token) + "Email me a copy" for a paid invoice. */
function InvoiceActions({ inv, onSent }) {
  const [busy, setBusy] = useState('');
  if (inv.status !== 'paid') return <span className="text-xs text-ink-400">—</span>;
  const blobError = async (e, fallback) => {
    try {
      const d = e?.response?.data;
      if (d instanceof Blob) return JSON.parse(await d.text())?.message || fallback;
    } catch { /* not JSON */ }
    return errText(e, fallback);
  };
  const pdf = async () => {
    setBusy('pdf');
    try {
      const blob = await billingApi.invoicePdf(inv._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoiceNumber || 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast.error(await blobError(e, 'Could not download the invoice.')); }
    finally { setBusy(''); }
  };
  const email = async () => {
    setBusy('mail');
    try { const r = await billingApi.resendInvoice(inv._id); toast.success(r?.message || 'Invoice emailed.'); onSent?.(); }
    catch (e) { toast.error(errText(e, 'Could not email the invoice.')); }
    finally { setBusy(''); }
  };
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <button type="button" disabled={!!busy} onClick={pdf} className="btn-secondary gap-1 !px-2 !py-1 text-xs">{busy === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF</button>
      <button type="button" disabled={!!busy} onClick={email} className="btn-secondary gap-1 !px-2 !py-1 text-xs">{busy === 'mail' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Email me a copy</button>
    </div>
  );
}

export default function BillingPage() {
  const qc = useQueryClient();
  const setOrg = useAuthStore((s) => s.setOrg);
  const { data, isLoading, error } = useQuery({ queryKey: ['billing'], queryFn: billingApi.get });
  const [cycle, setCycle] = useState('monthly');
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null); // plan waiting in the "Confirm your order" popup
  const [showOthers, setShowOthers] = useState(false); // active subscription: "View other plans" text list

  if (isLoading) return <div role="status" aria-live="polite" className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-ink-500"><Loader2 size={34} className="animate-spin text-brand-600" /><p className="text-sm font-medium">Loading billing…</p></div>;
  if (error) return <div className="card text-sm text-red-600">{errText(error, 'Could not load billing')}</div>;

  const { org, plans, invoices, addons, currency = 'INR', taxRate = 0, activeAddons = [], recommendedPlan = null, annualMonthsCharged = 10, activePlanLocked = org?.status === 'active' } = data.data;
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

  // Called from the confirm popup's "Pay now": only now is the order / subscription created and Razorpay opened.
  const buy = async (plan, payCycle, { coupon = '', quote: shown } = {}) => {
    setBusy(plan.code);
    let co = null;
    try {
      if (!(await loadRazorpay())) throw new Error('Could not open the payment window — check your internet and try again');
      ({ data: co } = await billingApi.checkout(plan.code, payCycle, coupon));
      // The server re-prices everything. If it differs from what the customer confirmed, ask again.
      if (shown && Math.abs(Number(co.quote.total) - Number(shown.total)) > 0.005 && co.quote.currency === shown.currency) {
        await billingApi.checkoutCancel({ orderId: co.orderId, subscriptionId: co.subscriptionId }).catch(() => {});
        setConfirming(null);
        toast.info('The price just changed. Please review the new total and pay again.');
        setTimeout(() => setConfirming(plan), 0);
        return;
      }
      if (co.currencyNote) toast.info(co.currencyNote);
      const isOrder = co.mode === 'order' || Boolean(co.orderId);
      const result = await openCheckout({
        key: co.keyId,
        ...(isOrder ? { order_id: co.orderId, amount: co.amount, currency: co.currency } : { subscription_id: co.subscriptionId }),
        name: co.productName,
        description: `${co.quote.planName} (${payCycle === 'annual' ? 'yearly' : 'monthly'})`,
        prefill: co.prefill,
      });
      if (result.status === 'dismissed') {
        await billingApi.checkoutCancel({ orderId: co.orderId, subscriptionId: co.subscriptionId }).catch(() => {});
        toast.info('Payment cancelled. Nothing was charged.');
        return;
      }
      const res = isOrder ? await billingApi.verifyOrder(result.resp) : await billingApi.verify(result.resp);
      setConfirming(null);
      await refresh(res.data.org);
      showDialog({ tone: 'success', title: 'Payment successful 🎉', message: `${co.quote.planName} plan is now active.\nAmount: ${money(co.quote.firstPayment, co.quote.currency)}${isOrder ? `\nPaid for one ${payCycle === 'annual' ? 'year' : 'month'} — renew from this page before it ends.` : ''}\nYour invoice is under "Invoices".` });
    } catch (err) {
      if (co) await billingApi.checkoutCancel({ orderId: co.orderId, subscriptionId: co.subscriptionId }).catch(() => {});
      if (err.paymentFailed) paymentFailedDialog(err);
      else {
        showDialog({ title: 'Payment not completed', message: errText(err) });
        if (err?.response?.data?.details?.code === 'PLAN_ALREADY_ACTIVE') { setConfirming(null); await refresh(); }
      }
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
  // One active paid plan at a time: while it runs only that plan is shown (renewal stays possible).
  // Active subscription = only the current plan is shown (as one card). Otherwise Starter / Growth / Builder side by side;
  // Enterprise is only a small "Contact sales" line.
  const isActive = org.status === 'active';
  const locked = isActive;
  const planCycle = locked ? org.billingCycle : cycle;
  const buyablePlans = plans.filter((p) => !p.contactSales && p.code !== 'enterprise');
  const enterprisePlan = plans.find((p) => p.contactSales || p.code === 'enterprise');
  const visiblePlans = buyablePlans;
  const currentPlan = plans.find((p) => p.code === org.plan) || null;
  const renewableNow = org.billingMode === 'order' && isActive;
  const limitRows = [['contacts', 'Contacts'], ['bulkMessages', 'Bulk messages'], ['aiConversations', 'AI conversations'], ['users', 'Team members'], ['whatsappNumbers', 'WhatsApp numbers']]
    .filter(([k]) => limits[k] !== undefined)
    .map(([k, label]) => [label, limits[k] == null || Number(limits[k]) >= 1e9 ? 'Unlimited' : Number(limits[k]).toLocaleString('en-IN')]);

  const usageSection = (
    <section className="card min-w-0 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{trialing ? 'Free trial usage (whole trial)' : 'Usage this month'}</p>
      <UsageMeters org={org} />
      {voiceUsage?.enabled && (
        <p className="text-xs text-ink-500 dark:text-ink-400">
          {voiceUsage.unlimited
            ? `AI calling: unlimited · ${voiceUsage.usedMinutes || 0} min used this month`
            : `AI calling: ${voiceUsage.remainingIncluded ?? 0} min left (plan ${voiceUsage.planRemaining ?? 0} + recharged ${voiceUsage.packBalance ?? 0})`}
        </p>
      )}
      {voiceUsage && !voiceUsage.enabled && <p className="text-xs text-ink-500 dark:text-ink-400">AI calling is available on Growth and above. Email campaigns are available on Growth and above too.</p>}
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Plans & billing</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Plans, add-ons and invoices. Prices in {currency}.</p>
      </div>

      {isActive ? (
        <>
      {/* ACTIVE subscription: only the current plan */}
      <section className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 p-5 shadow-card dark:border-emerald-600 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white"><Sparkles size={22} /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-ink-900 dark:text-white">{currentPlan?.name || org.planName} plan</h2>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold uppercase text-white">Active</span>
              </div>
              <p className="mt-1 text-sm text-ink-700 dark:text-ink-200">
                {org.billingCycle === 'annual' ? 'Yearly' : 'Monthly'} billing · {org.cancelAtPeriodEnd ? 'ends' : org.billingMode === 'order' ? 'paid until' : 'next bill'} <b>{fmtDate(org.currentPeriodEnd)}</b>
              </p>
              {!sub.active && sub.reason && <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-200"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{sub.reason}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {renewableNow && currentPlan && (
              <button type="button" onClick={() => setConfirming(currentPlan)} disabled={!!busy || !org.billingConfigured} className="btn-primary gap-2"><CreditCard size={16} />Renew</button>
            )}
            {!org.cancelAtPeriodEnd && <button type="button" onClick={cancel} disabled={busy === 'cancel'} className="text-sm font-semibold text-ink-500 hover:text-red-600 hover:underline">Cancel subscription</button>}
          </div>
        </div>
        {limitRows.length > 0 && (
          <dl className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {limitRows.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/80 px-3 py-2 dark:bg-ink-900/60">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
                <dd className="text-sm font-bold text-ink-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {!org.billingConfigured && <p className="mt-3 text-xs text-ink-600 dark:text-ink-300">Online payment is not switched on for this workspace yet. {org.sales?.email ? <>Contact <a className="font-semibold text-brand-700" href={`mailto:${org.sales.email}`}>{org.sales.email}</a>.</> : null}</p>}
        <div className="mt-4 border-t border-emerald-200 pt-3 dark:border-emerald-900">
          <button type="button" onClick={() => setShowOthers((v) => !v)} aria-expanded={showOthers} className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">{showOthers ? 'Hide other plans' : 'View other plans (More)'}</button>
          {showOthers && (
            <div className="mt-2 text-sm text-ink-700 dark:text-ink-200">
              <ul className="space-y-1">
                {plans.filter((p) => p.code !== org.plan).map((p) => <li key={p.code}><b>{p.name}</b> — {p.tagline || p.highlights?.[0] || ''}</li>)}
              </ul>
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">You can switch after this plan ends or contact support{org.sales?.email ? <> at <a className="font-semibold text-brand-700" href={`mailto:${org.sales.email}`}>{org.sales.email}</a></> : ''}.</p>
            </div>
          )}
        </div>
      </section>

      {usageSection}
        </>
      ) : (
        <>
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
      </section>

      {/* Plans */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Plans</h2>
          {!locked && <div className="inline-flex rounded-lg border border-ink-200 bg-white p-1 text-sm dark:border-ink-700 dark:bg-ink-900" role="tablist" aria-label="Billing cycle">
            {['monthly', 'annual'].map((c) => <button key={c} type="button" role="tab" aria-selected={cycle === c} onClick={() => setCycle(c)} className={`rounded-md px-3 py-1.5 font-semibold ${cycle === c ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{c === 'monthly' ? 'Monthly' : freeMonths > 0 ? `Yearly (${freeMonths} month${freeMonths === 1 ? '' : 's'} free)` : 'Yearly'}</button>)}
          </div>}
        </div>
        {false && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">You can choose a different plan after this one ends. Need to change it sooner? Contact support{org.sales?.email ? <> at <a className="font-semibold text-brand-700" href={`mailto:${org.sales.email}`}>{org.sales.email}</a></> : ''}.</p>}
        {!org.billingConfigured && (
          <div className="mt-4 rounded-xl border border-ink-200 bg-white p-4 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
            Online payment is not switched on for this workspace yet. Pay by UPI / bank transfer and our team will activate your plan
            {org.sales?.phone && <> · <a className="inline-flex items-center gap-1 font-semibold text-brand-700" href={`https://wa.me/${org.sales.phone.replace(/\D/g, '')}`}><Phone size={14} />{org.sales.phone}</a></>}
            {org.sales?.email && <> · <a className="inline-flex items-center gap-1 font-semibold text-brand-700" href={`mailto:${org.sales.email}`}><Mail size={14} />{org.sales.email}</a></>}
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {visiblePlans.map((p) => {
            const renewable = org.billingMode === 'order' && org.status === 'active';
            const current = p.code === org.plan && org.status === 'active' && org.billingCycle === planCycle && !renewable;
            const price = planCycle === 'annual' ? p.annual : p.monthly;
            const offer = !locked ? p.offer?.[planCycle] : null; // { listPrice, offerPrice, percentOff, label }
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
                ) : locked ? (
                  <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{planCycle === 'annual' ? 'Yearly' : 'Monthly'} billing · {org.cancelAtPeriodEnd ? 'ends' : org.billingMode === 'order' ? 'paid until' : 'renews'} <b>{fmtDate(org.currentPeriodEnd)}</b></p>
                ) : offer ? (
                  <>
                    <p className="mt-3 flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium text-ink-400 line-through">{money(offer.listPrice, p.currency || currency)}</span>
                      <span className="font-display text-2xl font-bold text-ink-900 dark:text-white">{money(offer.offerPrice, p.currency || currency)}<span className="text-xs font-medium text-ink-400"> /{planCycle === 'annual' ? 'year' : 'month'}</span></span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{offer.percentOff}% off</span>
                    </p>
                    <p className="text-xs text-ink-400">{offer.label ? `${offer.label} · ` : ''}{taxText}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 font-display text-2xl font-bold text-ink-900 dark:text-white">{money(price, p.currency || currency)}<span className="text-xs font-medium text-ink-400"> /{planCycle === 'annual' ? 'year' : 'month'}</span></p>
                    <p className="text-xs text-ink-400">{taxText}</p>
                  </>
                )}
                <ul className="mt-3 flex-1 space-y-1.5 text-xs text-ink-600 dark:text-ink-300">
                  {p.highlights.slice(0, 7).map((h) => <li key={h} className="flex gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-brand-600" />{h}</li>)}
                </ul>
                {p.contactSales ? (
                  <button type="button" className="btn-secondary mt-4 w-full" onClick={() => growthApi.request({ type: 'enterprise', message: 'I would like to discuss the Enterprise plan' }).then((r) => toast.success(r.message)).catch(() => toast.error('Request failed'))}>Contact sales</button>
                ) : locked && !renewable ? (
                  <span className="btn-secondary mt-4 w-full cursor-default opacity-70">Current plan ✓</span>
                ) : current ? (
                  <span className="btn-secondary mt-4 w-full cursor-default opacity-70">Current plan ✓</span>
                ) : (
                  <>
                    {locked && <span className="mt-4 block text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">Current plan ✓</span>}
                    <button type="button" onClick={() => setConfirming(p)} disabled={!!busy || !org.billingConfigured} className={`btn-primary w-full gap-2 ${locked ? 'mt-2' : 'mt-4'}`}><CreditCard size={16} />{renewable && p.code === org.plan ? 'Renew' : `Get ${p.name}`}</button>
                  </>
                )}
              </article>
            );
          })}
        </div>
        {enterprisePlan && <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">Need more than Builder? <button type="button" className="font-semibold text-brand-700 hover:underline dark:text-brand-300" onClick={() => growthApi.request({ type: 'enterprise', message: 'I would like to discuss the Enterprise plan' }).then((r) => toast.success(r.message)).catch(() => toast.error('Request failed'))}>Enterprise — Contact sales</button></p>}
        <p className="mt-3 text-xs text-ink-400">Auto-renews by card{currency === 'INR' ? ', UPI AutoPay or netbanking' : ''}. Meta’s WhatsApp charges are billed directly to your WhatsApp Business account.</p>
      </section>
        </>
      )}

      {/* Add-ons */}
      <section className="card min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink-900 dark:text-white">Add-ons</h2>
          {usage.voiceMinutes > 0 && <span className="text-xs text-ink-500">AI calling this month: {usage.voiceMinutes} min</span>}
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADDONS.map((a) => {
            const fromGrants = activeAddons.filter((g) => g.key === a.key).reduce((n, g) => n + (g.quantity || 0), 0);
            return <AddonCard key={a.key} addon={a} price={addons?.[a.key]?.price} currency={currency} have={(a.field ? org.addons?.[a.field] || 0 : 0) + fromGrants} busy={busy === `addon:${a.key}`} disabled={!!busy || !org.billingConfigured} onBuy={buyAddon} locked={a.key === 'voiceMinute' && (org.features?.aiCalling === false || voiceUsage?.enabled === false)} />;
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-400">Add-ons activate right after payment. Monthly add-ons last 1 month.</p>
      </section>

      {/* Usage (trial / no active plan: below add-ons as before) */}
      {!isActive && usageSection}

      {/* Invoices */}
      <section className="card min-w-0">
        <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><Receipt size={18} /> Invoices</h2>
        {invoices.length === 0 ? <p className="mt-3 text-sm text-ink-500">No payments yet.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-ink-400"><tr><th className="py-2 pr-4">Invoice no.</th><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Details</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Status</th><th className="py-2">Invoice</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-ink-700 dark:text-ink-200">{inv.invoiceNumber || '—'}</td>
                    <td className="py-2 pr-4 text-ink-600 dark:text-ink-300">{fmtDate(inv.paidAt || inv.createdAt)}</td>
                    <td className="py-2 pr-4 text-ink-900 dark:text-white">{inv.description}</td>
                    <td className="py-2 pr-4 font-mono">{money(inv.amount, inv.currency || 'INR')}</td>
                    <td className="py-2 pr-4"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inv.status === 'paid' ? 'Paid' : inv.status === 'refunded' ? 'Refunded' : 'Failed'}</span></td>
                    <td className="py-2"><InvoiceActions inv={inv} onSent={() => qc.invalidateQueries({ queryKey: ['billing'] })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirming && (
        <ConfirmOrderModal
          plan={confirming}
          cycle={planCycle}
          busy={busy === confirming.code}
          onClose={() => setConfirming(null)}
          onPay={(details) => buy(confirming, planCycle, details)}
        />
      )}
    </div>
  );
}
