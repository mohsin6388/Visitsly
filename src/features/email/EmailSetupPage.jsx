import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Mail, Copy, Check, Trash2, Wallet, ShieldCheck, RefreshCw, Info, Plus } from 'lucide-react';
import { emailApi } from '../../api/emailApi.js';
import { billingApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { PageTitle, Notice, errText, loadRazorpay, money } from '../../lib/saas.jsx';
import { openCheckout, paymentFailedDialog } from '../../lib/checkout.js';
import { confirmDialog, Modal, showDialog, toast } from '../../components/ui/index.jsx';

/* ------------------------------------------------------------------ */
/* Guidelines (shown the first time, and via "Learn more")             */
/* ------------------------------------------------------------------ */

const GUIDELINES = [
  ['Authenticate your domain (SPF, DKIM, DMARC)', 'Without it your emails go to spam or are rejected by Gmail, Outlook and others.'],
  ['Use a subdomain for bulk email', 'For example info.yourcompany.com. It protects the reputation of your main office email.'],
  ['Warm up slowly', 'Start with small batches for the first few days, then increase gradually.'],
  ['Email only people who gave you their details', 'Enquiries and site-visit leads only. Never use bought or old scraped lists.'],
  ['Unsubscribe always works', 'Every email includes an unsubscribe link. Unsubscribed people are never emailed again.'],
  ['Keep bounces and spam complaints low', 'Campaigns pause automatically if they get too high.'],
  ['Avoid spammy content', 'No ALL CAPS, excessive "!!!", too many links, image-only emails or misleading subjects.'],
  ['Be relevant', 'Mention the project, area or the visit they asked about. Keep subjects honest.'],
  ['Reply quickly to customer replies', 'It improves your reputation and your conversions.'],
  ['Clean your list', 'Remove invalid and repeatedly bouncing addresses.'],
];
const SEEN_KEY = 'visitsly.email.guidelines.seen';
const seenBefore = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable */ } };

function GuidelinesModal({ open, onClose, accepted, onAccept }) {
  const [tick, setTick] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email sending guidelines"
      size="max-w-2xl"
      footer={accepted ? (
        <button type="button" className="btn-primary" onClick={onClose}>Close</button>
      ) : (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-start gap-2 text-sm font-medium text-ink-800 dark:text-ink-100">
            <input type="checkbox" className="mt-1" checked={tick} onChange={(e) => setTick(e.target.checked)} />
            I have read and will follow these guidelines.
          </label>
          <button type="button" className="btn-primary" disabled={!tick} onClick={() => { markSeen(); onAccept(); }}>Continue</button>
        </div>
      )}
    >
      <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">Your sending reputation decides whether customers see your emails. Please follow these 10 points.</p>
      <ol className="space-y-3">
        {GUIDELINES.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{i + 1}</span>
            <span className="text-sm"><b className="text-ink-900 dark:text-white">{title}.</b> <span className="text-ink-600 dark:text-ink-300">{text}</span></span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|rocketmail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|pm|zoho|zohomail|gmx|yandex|mail|rediffmail|rediff)\./i;
const STEPS = ['Official email', 'Verify email', 'Authenticate domain', 'Ready'];
const stepIndex = (sender) => {
  if (!sender?.exists) return 0;
  if (sender.paused) return 3;
  if (sender.status === 'awaiting_domain') return 2; // strict-DMARC domain: DNS first, code later
  if (sender.status !== 'verified') return 1;
  if (sender.requireDomainAuth && sender.domainAuthStatus !== 'authenticated') return 2;
  return 3;
};

function Steps({ current }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((label, i) => {
        const done = i < current || (i === 3 && current === 3);
        const active = i === current;
        return (
          <li key={label} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : done ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300' : 'border-ink-200 text-ink-400 dark:border-ink-700'}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[11px] dark:bg-ink-800">{done && !active ? <Check size={12} /> : i + 1}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error('Could not copy'); } }}>
      {done ? <Check size={12} /> : <Copy size={12} />}{done ? 'Copied' : 'Copy'}
    </button>
  );
}

const AUTH_BADGE = {
  authenticated: ['bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', 'Authenticated'],
  pending: ['bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200', 'Waiting for DNS'],
  failed: ['bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', 'Problem'],
  not_started: ['bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300', 'Not started'],
};

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

const PACKS = [1000, 5000, 10000, 25000];

function RechargeModal({ open, onClose, price, onDone }) {
  const [qty, setQty] = useState(5000);
  const [busy, setBusy] = useState(false);
  const base = Math.round((price?.perEmail || 0) * qty * 100) / 100;
  const total = Math.round(base * (1 + (price?.gstRate || 0)));
  const gst = Math.round((total - base) * 100) / 100;

  const pay = async () => {
    setBusy(true);
    try {
      if (!(await loadRazorpay())) throw new Error('Could not open the payment window — check your internet and try again');
      const { data: co } = await billingApi.addonCheckout('emailCredit', qty);
      const result = await openCheckout({ key: co.keyId, order_id: co.orderId, amount: co.amount, currency: co.currency, name: co.productName, description: `${co.quote.name} × ${co.quote.quantity}`, prefill: co.prefill });
      if (result.status === 'dismissed') { toast.info('Payment cancelled.'); return; }
      await billingApi.addonVerify(result.resp);
      showDialog({ tone: 'success', title: 'Payment successful 🎉', message: `${qty.toLocaleString('en-IN')} emails added to your wallet.\nAmount paid: ${money(co.quote.total, co.quote.currency)}` });
      onClose();
      onDone();
    } catch (err) {
      if (err.paymentFailed) paymentFailedDialog(err);
      else showDialog({ title: 'Payment not completed', message: errText(err) });
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Recharge email wallet" footer={<button type="button" className="btn-primary inline-flex items-center gap-2" disabled={busy} onClick={pay}>{busy && <Loader2 size={15} className="animate-spin" />}Pay {money(total, 'INR')}</button>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PACKS.map((p) => (
            <button key={p} type="button" onClick={() => setQty(p)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${qty === p ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'border-ink-200 dark:border-ink-700'}`}>{p.toLocaleString('en-IN')} emails</button>
          ))}
        </div>
        <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Or enter a number of emails
          <input className="input-field mt-1.5 sm:max-w-[200px]" type="number" min={1000} max={500000} step={1000} value={qty} onChange={(e) => setQty(Math.min(500000, Math.max(1000, Math.round(Number(e.target.value) || 1000))))} />
        </label>
        <dl className="space-y-1.5 rounded-xl bg-ink-50 p-4 text-sm dark:bg-ink-800/60">
          <div className="flex justify-between"><dt className="text-ink-500">{qty.toLocaleString('en-IN')} emails × {money(price?.perEmail, 'INR')}</dt><dd>{money(base, 'INR')}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">GST ({Math.round((price?.gstRate || 0) * 100)}%)</dt><dd>{money(gst, 'INR')}</dd></div>
          <div className="flex justify-between border-t border-ink-200 pt-1.5 font-bold dark:border-ink-700"><dt>Total</dt><dd>{money(total, 'INR')}</dd></div>
        </dl>
        <p className="text-xs text-ink-500">You get an invoice by email after payment. Wallet money does not expire.</p>
      </div>
    </Modal>
  );
}

function WalletCard({ wallet, onChanged }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  useEffect(() => { emailApi.wallet().then((r) => setHistory(r.data.history || [])).catch(() => {}); }, [wallet?.balance]);
  const price = wallet?.price;
  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30"><Wallet size={20} /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Email wallet</p>
            <p className="font-display text-2xl font-bold text-ink-900 dark:text-white">{(wallet?.emailsLeft ?? 0).toLocaleString('en-IN')} <span className="text-sm font-medium text-ink-500">emails left</span></p>
            <p className="text-xs text-ink-500">Balance {money(wallet?.balance || 0, 'INR')}</p>
          </div>
        </div>
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setOpen(true)}><Plus size={15} /> Recharge</button>
      </div>
      {price && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          Rate per email: <b>{money(price.perEmail, 'INR')}</b> + {Math.round(price.gstRate * 100)}% GST = <b>{money(price.perEmailWithGst, 'INR')}</b> all-in.
        </div>
      )}
      {history.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Recent recharges</p>
          <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
            {history.slice(0, 5).map((h) => (
              <li key={h._id} className="flex justify-between py-1.5"><span className="text-ink-600 dark:text-ink-300">+{Number(h.emails).toLocaleString('en-IN')} emails</span><span className="text-xs text-ink-400">{new Date(h.at).toLocaleDateString('en-IN')}</span></li>
            ))}
          </ul>
        </div>
      )}
      <RechargeModal open={open} onClose={() => setOpen(false)} price={price} onDone={onChanged} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function EmailSetupPage() {
  const org = useAuthStore((s) => s.org);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [form, setForm] = useState({ email: '', displayName: '' });
  const [otp, setOtp] = useState('');

  const sender = data?.sender;
  const wallet = data?.wallet;

  const load = useCallback(async () => {
    try {
      const res = await emailApi.status();
      setData(res.data);
    } catch (err) {
      setMsg({ ok: false, text: errText(err, 'Could not load email status') });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Guidelines popup: first time only (and always until accepted on the server).
  useEffect(() => {
    if (!data) return;
    const ok = Boolean(sender?.guidelinesAccepted) || seenBefore();
    setAccepted(ok);
    if (!ok) setShowGuide(true);
  }, [data, sender?.guidelinesAccepted]);

  useEffect(() => { setForm((f) => ({ ...f, displayName: f.displayName || sender?.displayName || org?.name || '' })); }, [org?.name, sender?.displayName]);

  const step = stepIndex(sender);
  const freeMailWarning = useMemo(() => FREE_MAIL.test(form.email.trim()), [form.email]);

  const run = async (key, fn, okText) => {
    setBusy(key); setMsg(null);
    try {
      const res = await fn();
      if (res?.data?.sender) setData((d) => ({ ...d, sender: res.data.sender }));
      if (okText) setMsg({ ok: true, text: res?.message || okText });
      return res;
    } catch (err) {
      setMsg({ ok: false, text: errText(err, 'Something went wrong') });
      return null;
    } finally { setBusy(''); }
  };

  const submitEmail = (e) => {
    e.preventDefault();
    if (freeMailWarning) { setMsg({ ok: false, text: 'Please use your official company email' }); return; }
    run('start', () => emailApi.startSender({ email: form.email.trim(), displayName: form.displayName.trim(), guidelinesAccepted: accepted }), 'We sent a 6-digit code to this email.');
  };
  const submitOtp = async (e) => {
    e.preventDefault();
    const res = await run('verify', () => emailApi.verifySender(otp.trim()), 'Email verified.');
    if (res) { setOtp(''); load(); }
  };
  const remove = async () => {
    if (!(await confirmDialog({ title: 'Remove sender email?', message: 'Email campaigns stop until you set up a sender again. A running campaign blocks this.', confirmLabel: 'Remove', danger: true }))) return;
    const res = await run('remove', () => emailApi.removeSender(), 'Sender removed.');
    if (res) { setForm({ email: '', displayName: org?.name || '' }); load(); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle title="Email setup" />
        <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline" onClick={() => setShowGuide(true)}><Info size={15} /> Learn more: sending guidelines</button>
      </div>
      <Notice msg={msg} />
      <Steps current={step} />

      {/* Step 1 */}
      {step === 0 && (
        <form onSubmit={submitEmail} className="card space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Step 1 · Your official email</h2>
          <p className="text-sm text-ink-600 dark:text-ink-300">Campaign emails go out <b>from</b> this address and customer replies come back to it. Use your company domain (for example <code>info@yourcompany.com</code>). Free emails like Gmail or Yahoo are not allowed.</p>
          {!accepted && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Please read and accept the <button type="button" className="font-semibold underline" onClick={() => setShowGuide(true)}>sending guidelines</button> to continue.</p>}
          <fieldset disabled={!accepted || busy === 'start'} className="space-y-4 disabled:opacity-60">
            <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Sender name (your company)
              <input className="input-field mt-1.5" placeholder="Agarwaal Homes" value={form.displayName} maxLength={100} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} required />
            </label>
            <label className="block text-sm font-medium text-ink-800 dark:text-ink-100">Official email
              <input className="input-field mt-1.5" type="email" required placeholder="info@yourcompany.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              {freeMailWarning && <span className="mt-1 block text-xs font-semibold text-red-600">Please use your official company email</span>}
            </label>
            <div className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
              <b>Tip:</b> for bulk campaigns use a subdomain address such as <code>info@info.yourcompany.com</code>. If a campaign ever gets spam complaints, only that subdomain is affected — your main office email stays safe.
            </div>
            <button className="btn-primary inline-flex items-center gap-2" disabled={freeMailWarning}>{busy === 'start' && <Loader2 size={15} className="animate-spin" />}Send verification code</button>
          </fieldset>
        </form>
      )}

      {/* Step 2 */}
      {step === 1 && (
        <form onSubmit={submitOtp} className="card space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Step 2 · Verify {sender.email}</h2>
          <p className="text-sm text-ink-600 dark:text-ink-300">We emailed a <b>6-digit code</b> to this address. Open that inbox and type the code here. It can take a minute to arrive — check spam too.</p>
          <input className="input-field max-w-[220px] text-center font-mono text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary inline-flex items-center gap-2" disabled={otp.length !== 6 || busy === 'verify'}>{busy === 'verify' && <Loader2 size={15} className="animate-spin" />}Verify</button>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={busy === 'resend'} onClick={() => run('resend', () => emailApi.resendCode(), 'We sent a new code.')}><RefreshCw size={14} />Send a new code</button>
            <button type="button" className="btn-secondary" onClick={remove}>Use a different email</button>
          </div>
        </form>
      )}

      {/* Step 3 */}
      {step === 2 && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">Step 3 · Authenticate {sender.domain}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${(AUTH_BADGE[sender.domainAuthStatus] || AUTH_BADGE.not_started)[0]}`}>{(AUTH_BADGE[sender.domainAuthStatus] || AUTH_BADGE.not_started)[1]}</span>
          </div>
          {sender.status === 'awaiting_domain' && <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">Add these records first. After they are found, we will email a 6-digit code to your address.</p>}
          <p className="text-sm text-ink-600 dark:text-ink-300">Add these records at your domain provider (GoDaddy, Hostinger, Cloudflare, etc.). They prove the emails really come from you, so they reach the inbox instead of spam. DNS changes can take from a few minutes up to a few hours.</p>
          {sender.dnsRecords?.length ? (
            <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 text-ink-500 dark:bg-ink-800"><tr><th className="p-2">Purpose</th><th className="p-2">Type</th><th className="p-2">Host / Name</th><th className="p-2">Value</th><th className="p-2">Status</th></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {sender.dnsRecords.map((r) => (
                    <tr key={`${r.label}-${r.host}`} className="align-top">
                      <td className="p-2 font-semibold">{r.label}</td>
                      <td className="p-2">{r.type}</td>
                      <td className="p-2"><div className="break-all font-mono">{r.host}</div><div className="mt-1"><CopyBtn text={r.host} /></div></td>
                      <td className="p-2"><div className="max-w-[280px] break-all font-mono">{r.value}</div><div className="mt-1"><CopyBtn text={r.value} /></div></td>
                      <td className="p-2">{r.ok ? <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={13} />Found</span> : <span className="text-amber-700">Not found yet</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">We could not load the DNS records. Press “Check DNS” to try again.</p>}
          {sender.lastError && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{sender.lastError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={busy === 'dns'} onClick={() => run('dns', () => emailApi.checkDns(), null).then((r) => {
              const sd = r?.data?.sender;
              if (sd?.domainAuthStatus === 'authenticated') setMsg({ ok: true, text: sd.status === 'pending_verification' ? 'Domain authenticated. We emailed a 6-digit code to your address.' : 'Domain authenticated. You are ready to send.' });
            })}>
              {busy === 'dns' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}Check DNS
            </button>
            <button type="button" className="btn-secondary" onClick={remove}>Use a different email</button>
          </div>
        </section>
      )}

      {/* Step 4 */}
      {step === 3 && sender?.exists && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Mail size={20} /></span>
              <div>
                <p className="font-semibold text-ink-900 dark:text-white">{sender.email}</p>
                <p className="text-xs text-ink-500">{sender.displayName} · {sender.domain}</p>
              </div>
            </div>
            {sender.ready
              ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={14} /> Ready to send</span>
              : <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={14} /> {sender.paused ? 'Paused' : 'Problem'}</span>}
          </div>
          {sender.paused && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{sender.pausedReason || 'Email sending is paused.'} Clean your list, then contact support to resume.</p>}
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            Campaign emails sent today: <b>{sender.sentToday ?? 0}</b>{sender.dailyCap ? <> / <b>{sender.dailyCap}</b> daily limit</> : ''}. Customers’ replies arrive in <b>{sender.email}</b>.
          </div>
          <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
            <button type="button" className="btn-secondary inline-flex items-center gap-2 text-red-600" disabled={busy === 'remove'} onClick={remove}><Trash2 size={15} /> Remove sender</button>
          </div>
        </section>
      )}

      <WalletCard wallet={wallet} onChanged={load} />

      <GuidelinesModal
        open={showGuide}
        accepted={accepted}
        onClose={() => setShowGuide(false)}
        onAccept={() => { setAccepted(true); setShowGuide(false); }}
      />
    </div>
  );
}
