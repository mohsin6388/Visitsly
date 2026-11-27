import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, Tag, X } from 'lucide-react';
import { billingApi } from '../../api/saasApi.js';
import { errText, money } from '../../lib/saas.jsx';
import { Modal } from '../../components/ui/index.jsx';

function Row({ label, value, tone = '', strong = false }) {
  return <div className={`flex items-start justify-between gap-3 py-1.5 text-sm ${strong ? 'font-bold text-ink-900 dark:text-white' : 'text-ink-600 dark:text-ink-300'}`}>
    <span>{label}</span><span className={`shrink-0 font-mono ${tone}`}>{value}</span>
  </div>;
}

/**
 * "Confirm your order": shows exactly what will be charged (offer, coupon, GST, total) BEFORE Razorpay.
 * Nothing is created on the server while this is open — Razorpay opens only when the user presses
 * "Pay now" (the parent's onPay creates the order and opens the payment window).
 *
 * onPay({ coupon, quote }) → Promise. The parent closes the modal when the payment is done.
 */
export default function ConfirmOrderModal({ plan, cycle, onClose, onPay, busy }) {
  const [quote, setQuote] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [applied, setApplied] = useState(null); // { code, appliesTo } when the server accepted it
  const [couponError, setCouponError] = useState('');
  const [checking, setChecking] = useState(false);

  const loadQuote = useCallback(async (coupon) => {
    setLoadError('');
    try { setQuote((await billingApi.quote(plan.code, cycle, coupon)).data.quote); }
    catch (err) { setLoadError(errText(err, 'Could not load the price. Please try again.')); }
  }, [plan.code, cycle]);
  useEffect(() => { loadQuote(); }, [loadQuote]);

  const applyCoupon = async (event) => {
    event?.preventDefault();
    const code = couponInput.trim();
    if (!code) { setCouponError('Enter a coupon code.'); return; }
    setChecking(true); setCouponError('');
    try {
      const res = await billingApi.validateCoupon(code, plan.code, cycle);
      setQuote(res.data.quote);
      setApplied({ code: res.data.coupon.code, appliesTo: res.data.coupon.appliesTo });
      setCouponInput('');
    } catch (err) {
      setCouponError(errText(err, 'This coupon could not be applied.'));
    } finally { setChecking(false); }
  };
  const removeCoupon = async () => { setApplied(null); setCouponError(''); await loadQuote(); };

  const cur = quote?.currency || plan.currency || 'INR';
  const cycleLabel = cycle === 'annual' ? 'Yearly' : 'Monthly';
  const offerOff = quote?.offer ? Math.round((quote.listPrice - quote.price) * 100) / 100 : 0;
  const taxLabel = quote?.taxRate ? `${quote.taxLabel || 'Tax'} (${Math.round(quote.taxRate * 100)}%)` : 'Tax';
  const close = () => { if (!busy) onClose(); };

  return <Modal open onClose={close} title="Confirm your order" size="max-w-md"
    footer={<>
      <button type="button" className="btn-secondary" onClick={close} disabled={busy}>Cancel</button>
      <button type="button" className="btn-primary gap-2" disabled={busy || !quote || checking} onClick={() => onPay({ coupon: applied?.code || '', quote })}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}{busy ? 'Opening payment…' : quote ? `Pay now ${money(quote.total, cur)}` : 'Pay now'}
      </button>
    </>}>
    {loadError ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{loadError} <button type="button" className="font-semibold underline" onClick={() => loadQuote(applied?.code)}>Retry</button></p>
      : !quote ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-500"><Loader2 size={18} className="animate-spin" /> Calculating your total…</div>
      : <div>
        <div className="flex items-start justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 dark:bg-ink-800/60">
          <div><p className="font-semibold text-ink-900 dark:text-white">{quote.planName}</p><p className="text-xs text-ink-500">{cycleLabel} plan</p></div>
          {quote.offer && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{quote.offer.percentOff}% off</span>}
        </div>

        <div className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
          <Row label="Plan price" value={quote.offer ? <><s className="mr-1.5 text-ink-400">{money(quote.listPrice, cur)}</s>{money(quote.price, cur)}</> : money(quote.price, cur)} />
          {quote.offer && <Row label={`Offer${quote.offer.label ? ` · ${quote.offer.label}` : ''} (${quote.offer.percentOff}% off)`} value={`− ${money(offerOff, cur)}`} tone="text-emerald-600" />}
          {quote.couponDiscount > 0 && <Row label={`Coupon ${quote.coupon?.code || ''}`} value={`− ${money(quote.couponDiscount, cur)}`} tone="text-emerald-600" />}
          <Row label="Amount before tax" value={money(quote.subtotal, cur)} />
          <Row label={taxLabel} value={quote.taxRate ? money(quote.taxAmount, cur) : 'Included'} />
          <Row label="Total to pay now" value={money(quote.total, cur)} strong />
        </div>

        <div className="mt-4">
          {applied ? <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <span className="inline-flex items-center gap-1.5"><Tag size={14} /> <b>{applied.code}</b> applied</span>
            <button type="button" onClick={removeCoupon} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"><X size={12} /> Remove</button>
          </div> : <form onSubmit={applyCoupon}>
            <label htmlFor="coupon-code" className="mb-1 block text-xs font-semibold text-ink-600 dark:text-ink-300">Have a coupon?</label>
            <div className="flex gap-2">
              <input id="coupon-code" value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }} placeholder="Enter code" maxLength={40} autoComplete="off" disabled={busy} className={`input-field !h-9 flex-1 uppercase ${couponError ? '!border-red-400' : ''}`} />
              <button type="submit" disabled={checking || busy || !couponInput.trim()} className="btn-secondary !py-1.5 text-xs">{checking ? <Loader2 size={13} className="animate-spin" /> : 'Apply'}</button>
            </div>
            {couponError && <p role="alert" className="mt-1.5 text-xs text-red-600">{couponError}</p>}
          </form>}
          {applied?.appliesTo === 'first' && <p className="mt-2 text-[11px] text-ink-500">This discount applies to this payment only. It pays for one {cycle === 'annual' ? 'year' : 'month'}; you renew from this page afterwards.</p>}
          {applied?.appliesTo === 'all' && <p className="mt-2 text-[11px] text-ink-500">This discount applies to every renewal of this plan.</p>}
        </div>
        <p className="mt-3 text-[11px] text-ink-400">You will be taken to the secure Razorpay window only after you press “Pay now”.</p>
      </div>}
  </Modal>;
}
