import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Info, KeyRound, Link2, Loader2, Plus, RefreshCw, Send, ShieldCheck, Smartphone, Unplug, X, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orgApi, growthApi } from '../../api/saasApi.js';
import { whatsappApi } from '../../api/whatsappApi.js';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';
import { confirmDialog, showSendError } from '../../components/ui/index.jsx';
import { Formatted, partsFromTemplate } from '../../components/WhatsAppPreview.jsx';

/**
 * Connect a company's own WhatsApp Business number to Visitsly.
 * One compact screen: number + test message on the left, a tick / cross
 * checklist on the right. Errors show a red (i) button that opens the details.
 */
function loadFacebookSdk(appId, version) {
  if (!appId) return Promise.reject(new Error('Meta App ID is not configured. Contact support.'));
  const initialize = (FB) => {
    const marker = `${appId}:${version}`;
    if (window.__propaiFacebookSdkMarker === marker) return FB;
    try {
      FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      window.__propaiFacebookSdkMarker = marker;
    } catch (error) {
      // A page-level Facebook SDK may already have been initialized. Reuse it
      // only if it is known to be initialized for the same Visitsly app.
      if (window.__propaiFacebookSdkMarker !== marker) throw error;
    }
    return FB;
  };

  if (window.FB) {
    try { return Promise.resolve(initialize(window.FB)); }
    catch (error) { return Promise.reject(new Error(`Facebook SDK failed to start: ${error.message}`)); }
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      callback(value);
    };
    const timeoutId = window.setTimeout(() => {
      finish(reject, new Error('Facebook SDK is taking too long to load. Check your internet and ad-blocker, then try again.'));
    }, 15000);

    window.fbAsyncInit = () => {
      try { finish(resolve, initialize(window.FB)); }
      catch (error) { finish(reject, new Error(`Facebook SDK failed to start: ${error.message}`)); }
    };

    let script = document.querySelector('script[data-propai-facebook-sdk="true"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.dataset.propaiFacebookSdk = 'true';
      script.onerror = () => finish(reject, new Error('Facebook SDK could not be downloaded. Check your network or ad-blocker.'));
      document.body.appendChild(script);
    } else {
      script.onerror = () => finish(reject, new Error('Facebook SDK did not load. Refresh the page and try again.'));
      // The script might already have loaded before this component initialized.
      const pollId = window.setInterval(() => {
        if (window.FB && !settled) {
          window.clearInterval(pollId);
          window.fbAsyncInit?.();
        }
      }, 100);
      window.setTimeout(() => window.clearInterval(pollId), 15000);
    }
  });
}


const META_NAME_URL = 'https://business.facebook.com/latest/whatsapp_manager/phone_numbers';
const META_PAYMENT_URL = 'https://business.facebook.com/billing_hub/payment_settings';
const META_PERMISSIONS_URL = 'https://business.facebook.com/settings/whatsapp-business-accounts';

function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`my-6 w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-2xl bg-white p-5 shadow-xl dark:bg-ink-900`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-ink-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function variableIndexes(text = '') {
  return [...new Set([...String(text).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}
function componentOf(template, type) {
  return (template?.components || []).find((c) => String(c.type).toUpperCase() === type);
}
// Text, image, video and document headers can all be sent as a test.
function isTestable(template) {
  const header = componentOf(template, 'HEADER');
  return !header || !header.format || ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(header.format).toUpperCase());
}
function mediaHeaderFormat(template) {
  const f = String(componentOf(template, 'HEADER')?.format || '').toUpperCase();
  return ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(f) ? f : null;
}
// Shortest template first: the quickest way to check the number works.
const templateLength = (t) => String(componentOf(t, 'BODY')?.text || t.bodyText || '').length + (mediaHeaderFormat(t) ? 400 : 0);
function fillSample(text, count) {
  return String(text || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n) => (Number(n) <= count ? 'Sample' : whole));
}

/** Tick / cross checklist: one line per step. Red (i) opens the error details. */
function Checklist({ canManage, connected, wa, onConnect, canUseEmbedded, connectBusy, onUpdated, phoneNumberId, title = 'Setup status' }) {
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState('');
  const payKey = `wa_payment_ok_${wa?.phoneNumberId || ''}`;
  const [paymentDone, setPaymentDone] = useState(() => { try { return localStorage.getItem(payKey) === '1'; } catch { return false; } });
  const markPayment = (value) => { setPaymentDone(value); try { localStorage.setItem(payKey, value ? '1' : '0'); } catch { /* storage unavailable */ } };

  const run = async (mode = 'check') => {
    if (mode !== 'silent') setBusy(mode === 'fix' ? 'fix' : 'check');
    setError('');
    try {
      const res = mode === 'fix' ? await orgApi.fixWhatsappWebhook(phoneNumberId) : await orgApi.whatsappHealth(phoneNumberId);
      setHealth(res.data.health);
    } catch (err) {
      if (mode !== 'silent') setError(err?.response?.data?.message || 'Check failed. Try again shortly.');
    } finally { if (mode !== 'silent') setBusy(''); }
  };

  useEffect(() => { if (connected) run(); else setHealth(null); }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepOf = (key) => health?.steps?.find((st) => st.key === key);
  const nameStep = stepOf('display_name');
  const namePending = connected && nameStep?.state === 'pending';

  // Meta approves the display name in the background: keep checking.
  useEffect(() => {
    if (!connected) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') run('silent'); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = namePending ? window.setInterval(() => run('silent'), 60000) : null;
    return () => { document.removeEventListener('visibilitychange', onVisible); if (timer) window.clearInterval(timer); };
  }, [connected, namePending]); // eslint-disable-line react-hooks/exhaustive-deps

  const phoneDigits = String(health?.phone?.display || wa?.displayPhoneNumber || '').replace(/\D/g, '');
  const registered = stepOf('registered') || stepOf('token');
  const tokenBad = stepOf('token')?.state === 'error';
  const webhook = stepOf('webhook');
  const templates = stepOf('templates');
  const activity = stepOf('activity');
  const loaded = connected && Boolean(health);
  const paymentBroken = stepOf('payment')?.state === 'error' || Boolean(wa?.paymentIssueAt);

  const c = wa?.coexistence || {};
  const syncDone = c.contactsSyncStatus === 'done' && ['done', 'declined'].includes(c.historySyncStatus);
  const syncFailed = c.contactsSyncStatus === 'failed' || c.historySyncStatus === 'failed' || Boolean(c.syncError);
  const deadline = c.syncDeadline ? new Date(c.syncDeadline) : null;
  const windowOpen = deadline ? deadline.getTime() > Date.now() : false;
  const retrySync = async () => {
    setSyncBusy(true); setSyncError('');
    try { const res = await orgApi.retryCoexistenceSync(phoneNumberId); onUpdated?.(res.data.whatsapp); setInfo(null); }
    catch (err) { setSyncError(err?.response?.data?.message || 'Sync request failed.'); }
    finally { setSyncBusy(false); }
  };

  const reconnectBtn = canManage && canUseEmbedded
    ? <button type="button" onClick={() => { setInfo(null); onConnect(); }} disabled={connectBusy} className="btn-primary gap-1.5 !py-1.5 text-xs"><RefreshCw size={13} />{tokenBad ? 'Reconnect' : 'Register number again'}</button>
    : null;

  const rows = [
    { key: 'connect', label: 'Number connected', state: connected ? 'ok' : 'todo' },
    {
      key: 'active', label: 'Number active on WhatsApp',
      state: !loaded ? 'locked' : registered?.state === 'ok' ? 'ok' : 'error',
      info: { title: 'Number is not active', text: registered?.help || wa?.lastError || 'WhatsApp reports this number as inactive.', links: [{ label: 'Check number status in Meta', href: META_NAME_URL }, { label: 'Business permissions', href: META_PERMISSIONS_URL }], action: reconnectBtn },
    },
    {
      key: 'name', label: 'Business name approved',
      state: !loaded ? 'locked' : !nameStep ? 'ok' : nameStep.state === 'pending' ? 'pending' : 'error',
      pendingText: 'Waiting for Meta',
      info: { title: 'Business name not approved', text: nameStep?.help || 'Meta has not approved the display name.', links: [{ label: 'Check status in Meta', href: META_NAME_URL }] },
    },
    {
      key: 'payment', label: 'Payment method added in Meta',
      state: !loaded ? 'locked' : paymentBroken ? 'error' : paymentDone ? 'ok' : 'todo',
      info: { title: 'Payment method missing', text: 'Meta rejected the last message because no payment method is set (error 131042). Add a card in Meta, then send a test message.', links: [{ label: 'Add card in Meta', href: META_PAYMENT_URL }], action: <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => { markPayment(true); setInfo(null); }}>I added a card</button> },
      inline: loaded && !paymentDone && !paymentBroken ? <span className="flex items-center gap-2 text-xs"><a href={META_PAYMENT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300"><ExternalLink size={12} />Add card</a><button type="button" className="font-medium text-ink-500 hover:text-ink-800 hover:underline" onClick={() => markPayment(true)}>Mark done</button></span> : null,
    },
    {
      key: 'webhook', label: 'Customer replies reach Visitsly',
      state: !loaded || !webhook ? 'locked' : webhook.state === 'ok' ? 'ok' : webhook.state === 'error' ? 'error' : 'todo',
      info: { title: 'Replies are not reaching Visitsly', text: webhook?.help || 'The message webhook is not set up for this number.', action: canManage ? <button type="button" className="btn-primary gap-1.5 !py-1.5 text-xs" disabled={!!busy} onClick={() => run('fix')}>{busy === 'fix' && <Loader2 size={13} className="animate-spin" />}Fix with one click</button> : null },
      inline: loaded && webhook && webhook.state !== 'ok' && canManage ? <button type="button" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300" disabled={!!busy} onClick={() => run('fix')}>{busy === 'fix' ? 'Fixing…' : 'Fix'}</button> : null,
    },
    {
      key: 'templates', label: 'Message template approved',
      state: !loaded ? 'locked' : templates?.state === 'ok' ? 'ok' : 'todo',
      inline: loaded && templates?.state !== 'ok' ? <Link to="/whatsapp/templates" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">Create</Link> : null,
    },
    {
      key: 'test', label: 'Two-way chat tested',
      state: !loaded ? 'locked' : activity?.state === 'ok' ? 'ok' : 'todo',
      inline: loaded && activity?.state !== 'ok' && phoneDigits ? <a href={`https://wa.me/${phoneDigits}?text=Hi`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"><ExternalLink size={12} />Send “Hi”</a> : null,
    },
  ];
  if (connected && wa?.isCoexistence) {
    rows.push({
      key: 'sync', label: 'Contacts and chats synced',
      state: syncDone ? 'ok' : syncFailed ? 'error' : 'pending',
      pendingText: 'Syncing',
      info: {
        title: 'Sync did not finish',
        text: c.syncError || (deadline && !windowOpen ? 'The 24-hour sync window has ended. To import old chats, disconnect in the phone app (Settings → Account → Business Platform) and connect again.' : 'Contacts or chat history could not be synced.'),
        action: canManage && windowOpen ? <button type="button" className="btn-primary gap-1.5 !py-1.5 text-xs" onClick={retrySync} disabled={syncBusy}>{syncBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}Try sync again</button> : null,
      },
    });
  }

  const doneCount = rows.filter((r) => r.state === 'ok').length;
  const icon = (r) => r.state === 'ok'
    ? <CheckCircle2 size={18} className="text-green-600" aria-label="Done" />
    : r.state === 'error' ? <XCircle size={18} className="text-red-600" aria-label="Problem" />
      : r.state === 'pending' ? <Clock size={18} className="text-amber-500" aria-label="Pending" />
        : <XCircle size={18} className="text-ink-300" aria-label="Not done" />;

  return (
    <section className="card min-w-0 !p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">{title}</h2>
          <p className="text-xs text-ink-500">{doneCount} of {rows.length} done</p>
        </div>
        {connected && <button type="button" className="btn-secondary gap-1.5 !px-3 !py-1.5 text-xs" onClick={() => run()} disabled={!!busy}>{busy === 'check' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}Recheck</button>}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(doneCount / rows.length) * 100}%` }} /></div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ul className="mt-2 divide-y divide-ink-100 dark:divide-ink-800">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-[40px] items-center gap-3 py-1.5">
            <span className="shrink-0">{icon(r)}</span>
            <span className={`min-w-0 flex-1 text-sm ${r.state === 'locked' || r.state === 'todo' ? 'text-ink-500' : 'font-medium text-ink-900 dark:text-white'}`}>{r.label}</span>
            {r.state === 'pending' && <span className="text-xs font-medium text-amber-700">{r.pendingText}</span>}
            {r.inline}
            {r.state === 'error' && r.info && (
              <button type="button" onClick={() => setInfo(r.info)} aria-label={`Details: ${r.label}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 transition hover:bg-red-200"><Info size={14} /></button>
            )}
          </li>
        ))}
      </ul>
      {info && (
        <Modal title={info.title} onClose={() => { setInfo(null); setSyncError(''); }}>
          <p className="mt-3 text-sm leading-6 text-ink-700 dark:text-ink-200">{info.text}</p>
          {syncError && <p role="alert" className="mt-2 text-xs text-red-600">{syncError}</p>}
          {info.links?.length > 0 && <div className="mt-3 flex flex-col gap-1.5">{info.links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"><ExternalLink size={13} />{l.label}</a>)}</div>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">{info.action}<button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => { setInfo(null); setSyncError(''); }}>Close</button></div>
        </Modal>
      )}
    </section>
  );
}

/** One card per extra number, same look as the main number card. */
function ExtraNumberCard({ n, canManage, busy, onReconnect, onRemove }) {
  const ok = n.status ? n.status === 'connected' : true;
  const mode = n.isCoexistence ? 'Business app + Visitsly' : n.connectedVia === 'embedded_signup' ? 'Connected with Facebook' : 'Manual setup';
  return (
    <section className="card min-w-0 !p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink-900 dark:text-white">{n.label || 'Extra number'}</h2>
        {ok
          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={13} /> Connected</span>
          : <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"><XCircle size={13} /> Needs attention</span>}
      </div>
      <div className="mt-3">
        <p className="font-display text-xl font-bold text-ink-900 dark:text-white">{n.displayPhoneNumber || `ID ${n.phoneNumberId}`}</p>
        <p className="text-sm text-ink-500">{n.verifiedName || 'Business name pending'}{n.qualityRating ? ` · Quality ${n.qualityRating}` : ''} · {mode}</p>
        {n.lastError && !ok && <p className="mt-1 break-words text-xs text-red-600">{n.lastError}</p>}
        {canManage && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onReconnect(n)} disabled={busy} className="btn-secondary gap-1.5 !py-1.5 text-xs"><RefreshCw size={13} />Reconnect</button>
            <button type="button" onClick={() => onRemove(n)} disabled={busy} className="btn-secondary gap-1.5 !py-1.5 text-xs text-red-600"><Unplug size={13} />Remove</button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Pick an approved template, see exactly what will be sent, and send it to your own number. */
function TestMessageCard({ wa, onSent }) {
  const [templates, setTemplates] = useState(null);
  const [key, setKey] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    whatsappApi.templates()
      .then((res) => {
        if (!active) return;
        const list = (Array.isArray(res?.data?.templates) ? res.data.templates : []).filter(isTestable).sort((a, b) => templateLength(a) - templateLength(b));
        setTemplates(list);
        setKey(list[0] ? `${list[0].name}::${list[0].language}` : '');
      })
      .catch(() => { if (active) setTemplates([]); });
    return () => { active = false; };
  }, []);

  const selected = (templates || []).find((t) => `${t.name}::${t.language}` === key) || null;
  const parts = selected ? partsFromTemplate(selected) : null;
  const headerCount = Math.max(0, ...variableIndexes(parts?.headerText));
  const bodyCount = Math.max(0, ...variableIndexes(parts?.body));
  const validPhone = phone.replace(/\D/g, '').length >= 9;
  const mediaFormat = selected ? mediaHeaderFormat(selected) : null;
  const savedMedia = selected?.imageUrl || componentOf(selected, 'HEADER')?.example?.header_handle?.[0] || '';

  const send = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      let res;
      if (selected) {
        res = await whatsappApi.sendTestTemplate(phone.trim(), {
          templateName: selected.name,
          languageCode: selected.language,
          headerSampleValues: Array.from({ length: headerCount }, () => 'Sample'),
          bodySampleValues: Array.from({ length: bodyCount }, () => 'Sample'),
          headerMediaUrl: mediaFormat ? (mediaUrl.trim() || undefined) : undefined,
          confirmRecipient: true,
        });
      } else {
        res = await orgApi.sendWhatsappTestMessage({ phone: phone.trim() });
        if (res?.data?.whatsapp) onSent?.(res.data.whatsapp);
      }
      setNotice('Sent. Check WhatsApp on that number.');
      onSent?.();
    } catch (err) {
      const meta = err?.response?.data?.data?.metaError;
      setError(meta?.error_user_msg || meta?.message || err?.response?.data?.message || 'Could not send the test message.');
    } finally { setBusy(false); }
  };

  return (
    <section className="card min-w-0 !p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900 dark:text-white"><Send size={16} className="text-green-600" /> Send a test message</h2>
      {templates === null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-500"><Loader2 size={15} className="animate-spin" /> Loading templates…</p>
      ) : (
        <form onSubmit={send} className="mt-3 space-y-2.5">
          {templates.length > 0 ? (
            <select className="input-field !py-2" value={key} onChange={(e) => { setKey(e.target.value); setNotice(''); setError(''); }} aria-label="Template">
              {templates.map((t) => <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>{t.name} · {t.language}{mediaHeaderFormat(t) ? ` · ${mediaHeaderFormat(t).toLowerCase()}` : ''}</option>)}
            </select>
          ) : (
            <p className="text-xs text-ink-500">No approved template yet. A default “hello_world” test will be sent. <Link to="/whatsapp/templates" className="font-semibold text-brand-600 hover:underline">Create template</Link></p>
          )}
          {mediaFormat && (
            <div>
              <input className="input-field !py-2 text-xs" type="url" placeholder={savedMedia ? `${mediaFormat.toLowerCase()} saved with the template is used` : `Public HTTPS ${mediaFormat.toLowerCase()} link (needed for this template)`} value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} aria-label="Header media link" />
              <p className="mt-1 text-[11px] text-ink-400">This template has a {mediaFormat.toLowerCase()} header.{savedMedia ? ' Leave empty to use the saved one.' : ''}</p>
            </div>
          )}
          {parts && (
            <div className="max-h-32 overflow-y-auto rounded-xl bg-[#e7f6e0] p-3 text-xs leading-5 text-ink-800 dark:bg-emerald-950/40 dark:text-ink-100">
              {parts.headerText && <p className="mb-1 font-semibold"><Formatted text={fillSample(parts.headerText, headerCount)} /></p>}
              <p className="whitespace-pre-wrap"><Formatted text={fillSample(parts.body, bodyCount)} /></p>
              {parts.footer && <p className="mt-1 text-[11px] text-ink-500">{parts.footer}</p>}
              {parts.buttons.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{parts.buttons.map((b, i) => <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">{b.text}</span>)}</div>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input className="input-field min-w-0 flex-1 font-mono !py-2" inputMode="tel" placeholder="Your number, e.g. 919876543210" required value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ''))} />
            <button className="btn-primary gap-2 !py-2" disabled={busy || !validPhone}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Send</button>
          </div>
          {error && <p role="alert" className="flex flex-wrap items-center gap-2 text-xs text-red-600 [overflow-wrap:anywhere]"><span className="line-clamp-2 min-w-0 flex-1">{error}</span><button type="button" className="shrink-0 font-semibold underline" onClick={() => showSendError(error)}>Why?</button></p>}
          {notice && <p role="status" className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle2 size={14} />{notice}</p>}
          {!notice && wa?.testMessageSentAt && <p className="text-xs text-ink-400">Last test: {new Date(wa.testMessageSentAt).toLocaleString()}</p>}
        </form>
      )}
    </section>
  );
}

function connectionErrorDetails(errorOrMessage, fallback = 'WhatsApp could not be connected.') {
  const response = errorOrMessage?.response?.data || {};
  const details = response.details || {};
  const rawMessage = typeof errorOrMessage === 'string'
    ? errorOrMessage
    : response.message || errorOrMessage?.message || fallback;
  const message = String(rawMessage).replace(/Bearer\s+\S+/gi, '[redacted]');
  const code = details.metaCode ?? details.code ?? errorOrMessage?.code ?? null;
  const codeKey = String(code ?? '').toUpperCase();
  const numericCode = Number(code);
  const status = errorOrMessage?.response?.status;
  const text = message.toLowerCase();
  let title = 'Could not connect WhatsApp';
  let help = 'Try again. If it keeps failing, send the error code and time to Visitsly support.';

  if (codeKey === 'WHATSAPP_CONNECT_ATTEMPT_EXPIRED' || status === 410 || text.includes('session expire')) {
    title = 'Connection session expired';
    help = 'Press “Connect” again to start a new Meta session.';
  } else if (codeKey === 'META_APP_CONFIGURATION_MISSING' || text.includes('meta_app_id') || text.includes('meta_es_config_id') || text.includes('configuration')) {
    title = 'Visitsly’s Meta setup is incomplete';
    help = 'This is a platform issue, not your number. Contact Visitsly support.';
  } else if (codeKey === 'META_SIGNUP_DATA_INCOMPLETE' || codeKey === 'META_TOKEN_UNREADABLE') {
    title = 'Meta signup did not finish';
    help = 'Complete the whole Meta flow and connect again.';
  } else if (codeKey === 'META_PHONE_NUMBER_NOT_FOUND' || codeKey === 'META_PHONE_WABA_MISMATCH' || codeKey === 'META_PHONE_SELECTION_INVALID') {
    title = 'Number does not match the business account';
    help = 'In Meta signup, pick the right WhatsApp Business Account and the number inside it.';
  } else if (numericCode === 190 || text.includes('oauth') || text.includes('access token') || text.includes('authorization')) {
    title = 'Meta authorization problem';
    help = 'Connect again with Facebook. If it continues, Visitsly support must check the Meta app.';
  } else if (numericCode === 10 || numericCode === 200 || text.includes('permission') || text.includes('not authorized') || text.includes('access denied')) {
    title = 'Meta permissions are missing';
    help = 'Select the Business Portfolio you are an admin of. If it repeats, contact Visitsly support.';
  } else if (text.includes('pin') || text.includes('two-step') || text.includes('two step') || text.includes('security code')) {
    title = 'PIN was not accepted';
    help = 'Use the number’s current 6-digit two-step PIN, or choose a new one. Avoid repeated guesses.';
  } else if (text.includes('already') && (text.includes('number') || text.includes('registered') || text.includes('connected'))) {
    title = 'Number is already registered or connected';
    help = 'Check which business account holds this number in WhatsApp Manager. If another Visitsly workspace uses it, contact support.';
  } else if (text.includes('restricted') || text.includes('business verification') || text.includes('business is not verified') || text.includes('business is not allowed')) {
    title = 'Meta needs business verification';
    help = 'Finish business verification and number checks in Meta Business Suite, then retry.';
  } else if (text.includes('rate limit') || status === 429) {
    title = 'Too many requests';
    help = 'Wait a few minutes and try once more.';
  } else if (text.includes('timeout') || text.includes('network') || text.includes('sdk') || text.includes('popup') || text.includes('pop-up')) {
    title = 'Facebook window did not open';
    help = 'Allow pop-ups, check your ad-blocker and internet, and retry.';
  } else if (status >= 500 || status === 502 || text.includes('temporarily unavailable')) {
    title = 'Temporary server problem';
    help = 'Refresh and retry in a few minutes.';
  }
  return { title, message, help, code: code == null ? null : String(code), stage: details.stage || null, fbtraceId: details.fbtraceId || null };
}
export default function ConnectWhatsApp({ onChange }) {
  const [wa, setWa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorTitle, setErrorTitle] = useState('');
  const [errorHelp, setErrorHelp] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [errorStage, setErrorStage] = useState('');
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [registrationPin, setRegistrationPin] = useState('');
  const [phoneChoice, setPhoneChoice] = useState('');
  const [manual, setManual] = useState({ accessToken: '', phoneNumberId: '', businessAccountId: '' });
  const [connectStage, setConnectStage] = useState('');
  const [pendingAttempt, setPendingAttempt] = useState(null);
  const [successNotice, setSuccessNotice] = useState('');
  const sessionRef = useRef({});
  const flowTimerRef = useRef(null);
  const role = useOrgRole();
  const setOrg = useAuthStore((s) => s.setOrg);
  const canManage = role === 'owner';

  const clearFlowTimer = () => {
    if (flowTimerRef.current) window.clearTimeout(flowTimerRef.current);
    flowTimerRef.current = null;
  };

  const showConnectionError = (source, fallback, stage) => {
    const details = connectionErrorDetails(source, fallback);
    setError(details.message);
    setErrorTitle(details.title);
    setErrorHelp(details.help);
    setErrorCode(details.code || '');
    setErrorStage(details.stage || stage || 'connection');
    setConnectStage('');
    setBusy(false);
    return details;
  };

  const clearConnectionError = () => {
    setError('');
    setErrorTitle('');
    setErrorHelp('');
    setErrorCode('');
    setErrorStage('');
  };

  const reload = async () => {
    const res = await orgApi.whatsapp();
    setWa(res.data.whatsapp);
    try {
      const orgRes = await orgApi.get();
      setOrg(orgRes.data.org);
    } catch { /* the WhatsApp status response is still useful */ }
    await onChange?.();
    return res.data.whatsapp;
  };

  useEffect(() => {
    let active = true;
    orgApi.whatsapp()
      .then((r) => { if (active) setWa(r.data.whatsapp); })
      .catch((e) => { if (active) showConnectionError(e, 'Could not load WhatsApp status.', 'load_status'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; clearFlowTimer(); };
    // Only load on mount. The explicit reload function is used after actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prepareEmbeddedSignup = async () => {
    const session = sessionRef.current;
    if (!session.code || !session.wabaId || session.preparationStarted) return;
    session.preparationStarted = true;
    clearFlowTimer();
    setBusy(true);
    setConnectStage('Verifying Meta authorization…');
    clearConnectionError();
    try {
      const response = await orgApi.prepareEmbeddedSignup({
        code: session.code,
        wabaId: String(session.wabaId),
        ...(session.phoneNumberId ? { phoneNumberId: String(session.phoneNumberId) } : {}),
        ...(session.eventType ? { eventType: session.eventType } : {}),
        ...(session.target === 'extra' ? { target: 'extra', ...(session.label ? { label: session.label } : {}), ...(session.reconnectPhoneNumberId ? { reconnectPhoneNumberId: String(session.reconnectPhoneNumberId) } : {}) } : {}),
      });
      const attempt = response?.data?.attempt;
      if (!attempt?.attemptId || !Array.isArray(attempt.phoneNumbers) || !attempt.phoneNumbers.length) {
        throw new Error('Meta account verified, but no phone number details were returned. Start again.');
      }
      sessionRef.current.attemptId = attempt.attemptId;
      setPendingAttempt(attempt);
      const selected = attempt.selectedPhoneNumberId || '';
      setPhoneChoice(selected);
      setRegistrationPin('');
      setError('');
      setErrorTitle('');
      setErrorHelp('');
      setErrorCode('');
      setErrorStage('');
      setConnectStage(attempt.needsPhoneSelection ? 'Select a WhatsApp number' : 'Finish number registration');
      setBusy(false);
      setPinPromptOpen(true);
      if (session.target !== 'extra') setWa((previous) => previous ? { ...previous, status: previous.status === 'error' && !previous.phoneNumberId ? 'not_connected' : previous.status, lastError: null, lastErrorCode: null, lastErrorStage: null, lastErrorAt: null } : previous);
    } catch (err) {
      const details = showConnectionError(err, 'Could not validate Meta signup.', 'prepare_embedded_signup');
      // OAuth codes are single-use. A failure after code exchange must start a fresh Meta flow.
      sessionRef.current = {};
      setPendingAttempt(null);
      setPinPromptOpen(false);
      if (details.code === 'WHATSAPP_CONNECT_ATTEMPT_EXPIRED') setErrorHelp('Connect with Facebook again.');
      await reload().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const finishIfReady = () => {
    const session = sessionRef.current;
    if (!session.code || !session.wabaId || session.preparationStarted) return;
    void prepareEmbeddedSignup();
  };

  useEffect(() => {
    const listener = (event) => {
      try {
        const eventUrl = new URL(event.origin);
        const host = eventUrl.hostname.toLowerCase();
        if (eventUrl.protocol !== 'https:' || !(host === 'facebook.com' || host.endsWith('.facebook.com'))) return;
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (message?.type !== 'WA_EMBEDDED_SIGNUP') return;
        const data = message.data || {};
        const type = String(message.event || '');
        if (['FINISH', 'FINISH_ONLY_WABA', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'].includes(type)) {
          sessionRef.current.eventType = type;
          sessionRef.current.wabaId = data.waba_id || data.wabaId || sessionRef.current.wabaId;
          sessionRef.current.phoneNumberId = data.phone_number_id || data.phoneNumberId || sessionRef.current.phoneNumberId;
          setConnectStage('Meta signup received. Verifying account…');
          if (!sessionRef.current.wabaId) {
            window.setTimeout(() => {
              const latest = sessionRef.current;
              if (latest.code && !latest.wabaId && !latest.preparationStarted) {
                clearFlowTimer();
                showConnectionError(
                  'Meta signup did not return a WhatsApp Business Account ID.',
                  'Meta signup result is incomplete.',
                  'receive_signup_result',
                );
                setErrorCode('META_SIGNUP_DATA_INCOMPLETE');
                setErrorHelp('Complete the Facebook flow again. If it repeats, contact support.');
              } else {
                finishIfReady();
              }
            }, 1200);
          } else {
            finishIfReady();
          }
        } else if (type === 'CANCEL') {
          clearFlowTimer();
          setBusy(false);
          setConnectStage('');
          const currentStep = data.current_step ? ` (${String(data.current_step).replace(/[_-]+/g, ' ')})` : '';
          setErrorTitle('WhatsApp setup was cancelled');
          setError('No new number was connected.');
          setErrorHelp(`Press Connect again when you are ready${currentStep}.`);
          setErrorCode('META_SIGNUP_CANCELLED');
          setErrorStage('meta_signup');
        } else if (type === 'ERROR') {
          clearFlowTimer();
          showConnectionError(data.error_message || data.error?.message || 'Meta signup returned an error.', 'Meta signup error.', 'meta_signup');
          setErrorCode(data.error_code ? String(data.error_code) : 'META_EMBEDDED_SIGNUP_ERROR');
        }
      } catch { /* Ignore unrelated postMessage payloads from other SDKs. */ }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEmbedded = async (mode = 'new', opts = {}) => {
    const coexistence = mode === 'coexistence';
    const isExtra = opts.target === 'extra';
    clearConnectionError();
    if (!isExtra) setWa((previous) => previous ? {
      ...previous,
      status: previous.status === 'error' && !previous.phoneNumberId ? 'not_connected' : previous.status,
      lastError: null,
      lastErrorCode: null,
      lastErrorStage: null,
      lastErrorAt: null,
    } : previous);
    setSuccessNotice('');
    setConnectStage('Preparing Facebook login…');
    setBusy(true);
    setPendingAttempt(null);
    setPinPromptOpen(false);
    // An extra number never touches the main number: the target travels with the session.
    sessionRef.current = isExtra ? { target: 'extra', label: opts.label || '', reconnectPhoneNumberId: opts.reconnectPhoneNumberId || '' } : {};

    const es = wa?.embeddedSignup;
    if (!es?.available || !es.appId || !es.configId) {
      showConnectionError('Meta Embedded Signup is not configured.', 'Meta signup configuration is missing.', 'platform_configuration');
      setErrorHelp('Visitsly admin must set META_APP_ID and META_ES_CONFIG_ID. This is a platform setup.');
      return;
    }
    if (window.location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      showConnectionError('Facebook signup needs HTTPS.', 'Secure connection required.', 'browser');
      setErrorHelp('Open Visitsly on its HTTPS address, then connect.');
      return;
    }

    try {
      const FB = await loadFacebookSdk(es.appId, es.apiVersion);
      setConnectStage('Authorize your business in the Facebook popup…');
      flowTimerRef.current = window.setTimeout(() => {
        if (sessionRef.current.attemptId || sessionRef.current.preparationStarted) return;
        setBusy(false);
        setConnectStage('');
        setErrorTitle('No response from Meta signup');
        setError('The Facebook popup result did not reach Visitsly.');
        setErrorHelp('Allow pop-ups, finish the Meta flow, and retry. Check cookie or tracking protection if it repeats.');
        setErrorCode('META_SIGNUP_RESPONSE_TIMEOUT');
        setErrorStage('meta_signup');
      }, 90000);

      FB.login((response) => {
        if (sessionRef.current.eventType === 'CANCEL' || sessionRef.current.eventType === 'ERROR') return;
        if (response?.authResponse?.code) {
          sessionRef.current.code = response.authResponse.code;
          setConnectStage('Waiting for Meta authorization…');
          finishIfReady();
        } else {
          // Meta's CANCEL postMessage can race with the FB.login callback.
          window.setTimeout(() => {
            if (sessionRef.current.eventType === 'CANCEL' || sessionRef.current.eventType === 'ERROR') return;
            clearFlowTimer();
            setBusy(false);
            setConnectStage('');
            setErrorTitle('Facebook login did not complete');
            setError(response?.status === 'unknown'
              ? 'Facebook did not return an authorization code.'
              : 'Facebook signup was cancelled or no code was returned.');
            setErrorHelp('Allow pop-ups, use the right Facebook account, approve business access and finish the flow.');
            setErrorCode('META_OAUTH_CODE_MISSING');
            setErrorStage('oauth_callback');
          }, 1000);
        }
      }, {
        config_id: es.configId,
        auth_type: 'rerequest',
        response_type: 'code',
        override_default_response_type: true,
        // Coexistence = number already in the WhatsApp Business app (Embedded Signup v4, Session Info v3).
        extras: coexistence
          ? { setup: es.solutionId ? { solutionID: es.solutionId } : {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' }
          : es.solutionId ? { setup: { solutionID: es.solutionId } } : {},
      });
    } catch (err) {
      clearFlowTimer();
      showConnectionError(err, 'Could not start Facebook signup.', 'load_facebook_sdk');
    }
  };

  const completeEmbeddedSignup = async (event) => {
    event.preventDefault();
    const wasExtra = pendingAttempt?.target === 'extra' || sessionRef.current.target === 'extra';
    clearConnectionError();
    if (!pendingAttempt?.attemptId) {
      showConnectionError('Connection attempt is missing.', 'Connection session expired.', 'complete_signup');
      setErrorHelp('Connect WhatsApp with Facebook again.');
      setPinPromptOpen(false);
      return;
    }
    if (!phoneChoice || !pendingAttempt.phoneNumbers.some((phone) => phone.phoneNumberId === phoneChoice)) {
      showConnectionError('Select a WhatsApp number.', 'Select a phone number.', 'select_phone_number');
      return;
    }
    if (!pendingAttempt.isCoexistence && !/^\d{6}$/.test(registrationPin)) {
      showConnectionError('Enter the 6-digit PIN.', 'Invalid PIN.', 'register_phone_number');
      return;
    }

    setBusy(true);
    setConnectStage('Verifying permissions, webhook and number registration…');
    try {
      await orgApi.completeEmbeddedSignup({
        attemptId: pendingAttempt.attemptId,
        phoneNumberId: phoneChoice,
        ...(pendingAttempt.isCoexistence ? {} : { pin: registrationPin }),
      });
      clearFlowTimer();
      setPinPromptOpen(false);
      setRegistrationPin('');
      setPendingAttempt(null);
      sessionRef.current = {};
      setConnectStage('');
      clearConnectionError();
      setSuccessNotice(wasExtra ? (pendingAttempt.isCoexistence ? 'Number added. Contacts and chats are syncing in the background.' : 'Number added.') : pendingAttempt.isCoexistence ? 'WhatsApp connected. Contacts and chats are syncing in the background.' : 'WhatsApp connected.');
      await reload();
    } catch (err) {
      const details = showConnectionError(err, 'Number registration did not complete.', 'complete_signup');
      // If the backend committed the connection but the HTTP response/audit step
      // failed, re-check state before asking the customer to repeat registration.
      const latest = await reload().catch(() => null);
      if (!wasExtra && latest?.status === 'connected') {
        setPinPromptOpen(false);
        setRegistrationPin('');
        setPendingAttempt(null);
        sessionRef.current = {};
        clearConnectionError();
        setWa((previous) => previous ? { ...previous, lastError: null, lastErrorCode: null, lastErrorStage: null, lastErrorAt: null } : previous);
        setSuccessNotice('WhatsApp connected.');
      } else if (details.code === 'WHATSAPP_CONNECT_ATTEMPT_EXPIRED' || err?.response?.status === 410) {
        setPinPromptOpen(false);
        setPendingAttempt(null);
        sessionRef.current = {};
      }
      // For a wrong PIN or temporary Meta failure, keep the attempt so the
      // user can correct the PIN/retry without exchanging the OAuth code again.
    } finally {
      setBusy(false);
      setConnectStage('');
    }
  };

  const submitManual = async (event) => {
    event.preventDefault();
    clearConnectionError();
    setBusy(true);
    setConnectStage('Verifying credentials…');
    try {
      await orgApi.connectManual(manual);
      setManual({ accessToken: '', phoneNumberId: '', businessAccountId: '' });
      setSuccessNotice('WhatsApp connected.');
      await reload();
    } catch (err) {
      showConnectionError(err, 'Manual connection failed.', 'manual_connect');
      await reload().catch(() => {});
    } finally {
      setManualOpen(false);
      setBusy(false);
      setConnectStage('');
    }
  };

  const disconnect = async () => {
    if (!(await confirmDialog({ title: 'Remove WhatsApp number?', message: 'AI replies and bulk messages will stop. Your chats stay saved.', confirmLabel: 'Remove', danger: true }))) return;
    clearConnectionError();
    setBusy(true);
    try {
      await orgApi.disconnectWhatsapp();
      setSuccessNotice('Disconnected from Visitsly. The number was not deleted in Meta.');
      await reload();
    } catch (err) {
      showConnectionError(err, 'Could not disconnect.', 'disconnect');
    } finally {
      setBusy(false);
    }
  };
  const [errorOpen, setErrorOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const org = useAuthStore((s) => s.org);
  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [manualExtra, setManualExtra] = useState(null);
  const [addError, setAddError] = useState('');

  const startExtra = (mode) => { setAddOpen(false); void startEmbedded(mode, { target: 'extra', label: addLabel.trim() }); setAddLabel(''); };
  const reconnectExtra = (n) => {
    if (n.connectedVia === 'embedded_signup' && wa?.embeddedSignup?.available) {
      void startEmbedded(n.isCoexistence ? 'coexistence' : 'new', { target: 'extra', label: n.label || '', reconnectPhoneNumberId: n.phoneNumberId });
    } else {
      setAddError('');
      setManualExtra({ label: n.label || '', phoneNumberId: n.phoneNumberId, businessAccountId: '', accessToken: '', reconnect: true });
    }
  };
  const removeExtra = async (n) => {
    if (!(await confirmDialog({ title: `Remove ${n.displayPhoneNumber || n.phoneNumberId}?`, message: 'Chats stay saved. The number is not deleted in Meta.', confirmLabel: 'Remove', danger: true }))) return;
    setBusy(true);
    try { const res = await growthApi.removeNumber(n.phoneNumberId); setWa(res.data.whatsapp); void onChange?.(); }
    catch (err) { showConnectionError(err, 'Could not remove the number.', 'remove_number'); }
    finally { setBusy(false); }
  };
  const submitManualExtra = async (event) => {
    event.preventDefault();
    setBusy(true); setAddError('');
    try {
      const payload = { label: manualExtra.label, phoneNumberId: manualExtra.phoneNumberId };
      if (manualExtra.businessAccountId) payload.businessAccountId = manualExtra.businessAccountId;
      if (manualExtra.accessToken) payload.accessToken = manualExtra.accessToken;
      if (manualExtra.reconnect) payload.reconnect = true;
      const res = await growthApi.addNumber(payload);
      setWa(res.data.whatsapp);
      setSuccessNotice(manualExtra.reconnect ? 'Number reconnected.' : 'Number added.');
      setManualExtra(null); setAddOpen(false); setAddLabel('');
      void onChange?.();
    } catch (err) {
      setAddError(err?.response?.data?.message || 'Could not add the number.');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="card flex justify-center py-10"><Loader2 className="animate-spin text-ink-400" /></div>;
  if (!wa) return (
    <section className="card">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 text-amber-600" />
        <div>
          <h2 className="font-semibold text-ink-900 dark:text-white">Could not load WhatsApp status</h2>
          <p className="mt-1 text-sm text-ink-500">{error || 'The server did not return the connection status.'}</p>
          <button type="button" onClick={() => { setLoading(true); clearConnectionError(); orgApi.whatsapp().then((r) => setWa(r.data.whatsapp)).catch((e) => showConnectionError(e, 'Could not load WhatsApp status.', 'load_status')).finally(() => setLoading(false)); }} className="btn-secondary mt-3 gap-2"><RefreshCw size={14} /> Retry</button>
        </div>
      </div>
    </section>
  );

  const connected = wa.status === 'connected';
  // Preserve failed reconnect diagnostics even if the previously connected number remains usable.
  const visibleError = error || wa.lastError || '';
  const visibleErrorDetails = error
    ? { title: errorTitle, help: errorHelp, code: errorCode, stage: errorStage }
    : visibleError
      ? connectionErrorDetails({ message: visibleError, response: { data: { details: { code: wa.lastErrorCode, metaCode: wa.lastErrorCode, stage: wa.lastErrorStage } } } })
      : null;
  const canUseEmbedded = Boolean(wa.embeddedSignup?.available && wa.embeddedSignup?.appId && wa.embeddedSignup?.configId);
  const dismissError = () => {
    clearConnectionError();
    setErrorOpen(false);
    if (wa.status === 'error') setWa((prev) => ({ ...prev, lastError: null, lastErrorCode: null, lastErrorStage: null, lastErrorAt: null }));
  };
  const modeLabel = wa.isCoexistence ? 'Business app + Visitsly' : wa.connectedVia === 'embedded_signup' ? 'Connected with Facebook' : 'Manual setup';
  const extras = wa.extraNumbers || [];
  const numInfo = wa.numbers || { limit: org?.limits?.whatsappNumbers ?? null, used: 1 + extras.length, canAdd: org?.limits?.whatsappNumbers == null || 1 + extras.length < org.limits.whatsappNumbers };
  const spin = busy ? <Loader2 size={16} className="animate-spin shrink-0" /> : null;

  return (
    <div className="space-y-3">
      {visibleError && (
        <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <XCircle size={17} className="shrink-0 text-red-600" />
          <span className="min-w-0 flex-1 truncate font-medium">{visibleErrorDetails?.title || 'WhatsApp connection error'}</span>
          <button type="button" onClick={() => setErrorOpen(true)} aria-label="Error details" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 transition hover:bg-red-200"><Info size={14} /></button>
          <button type="button" onClick={dismissError} aria-label="Dismiss error" className="shrink-0 text-red-400 hover:text-red-700"><X size={16} /></button>
        </div>
      )}
      {successNotice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 size={16} className="shrink-0" /><span className="min-w-0 flex-1">{successNotice}</span>
          <button type="button" onClick={() => setSuccessNotice('')} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      {connectStage && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <Loader2 size={16} className="shrink-0 animate-spin" /><span>{connectStage}</span>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <section className="card min-w-0 !p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink-900 dark:text-white">WhatsApp number</h2>
              {connected
                ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={13} /> Connected</span>
                : wa.status === 'error'
                  ? <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"><XCircle size={13} /> Needs attention</span>
                  : <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-600">Not connected</span>}
            </div>

            {connected ? (
              <div className="mt-3">
                <p className="font-display text-xl font-bold text-ink-900 dark:text-white">{wa.displayPhoneNumber || `ID ${wa.phoneNumberId}`}</p>
                <p className="text-sm text-ink-500">{wa.verifiedName || 'Business name pending'}{wa.qualityRating ? ` · Quality ${wa.qualityRating}` : ''} · {modeLabel}</p>
                {(extras.length > 0 || numInfo.limit > 1) && <p className="mt-0.5 text-xs text-ink-400">Main number · {numInfo.used} of {numInfo.limit ?? '∞'} numbers used</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {canManage && wa.connectedVia !== 'env' && canUseEmbedded && <button onClick={() => startEmbedded(wa.isCoexistence ? 'coexistence' : 'new')} disabled={busy} className="btn-secondary gap-1.5 !py-1.5 text-xs">{busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}Reconnect</button>}
                  {canManage && wa.connectedVia !== 'env' && <button onClick={disconnect} disabled={busy} className="btn-secondary gap-1.5 !py-1.5 text-xs text-red-600"><Unplug size={13} />Remove</button>}
                  {canManage && (numInfo.canAdd
                    ? <button type="button" onClick={() => { setAddError(''); setAddOpen(true); }} disabled={busy} className="btn-secondary gap-1.5 !py-1.5 text-xs"><Plus size={13} />Add number</button>
                    : <span className="self-center text-xs text-ink-500">Upgrade your plan to add more</span>)}
                </div>
              </div>
            ) : !canManage ? (
              <p className="mt-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-500 dark:bg-ink-800/50">Ask your company owner to connect WhatsApp.</p>
            ) : canUseEmbedded ? (
              <div className="mt-3 space-y-2.5">
                <button type="button" onClick={() => startEmbedded('coexistence')} disabled={busy} className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-left transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-900/10">
                  <Smartphone size={20} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink-900 dark:text-white">I use the WhatsApp Business app</span><span className="block text-xs text-ink-500">Keep chatting on your phone. Recommended.</span></span>
                  {spin || <Link2 size={16} className="shrink-0 text-[#1877F2]" />}
                </button>
                <button type="button" onClick={() => startEmbedded('new')} disabled={busy} className="flex w-full items-center gap-3 rounded-xl border border-ink-100 p-3 text-left transition hover:bg-ink-50 disabled:opacity-60 dark:border-ink-800">
                  <KeyRound size={20} className="shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink-900 dark:text-white">New number for Visitsly only</span><span className="block text-xs text-ink-500">Needs a 6-digit PIN you choose.</span></span>
                  {spin || <Link2 size={16} className="shrink-0 text-[#1877F2]" />}
                </button>
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Facebook connect is not set up yet. Contact Visitsly support.</p>
            )}

            {!connected && canManage && pendingAttempt?.attemptId && !pinPromptOpen && (
              <button type="button" className="btn-primary mt-3 gap-2 !py-1.5 text-xs" onClick={() => setPinPromptOpen(true)}><ShieldCheck size={14} />Continue setup</button>
            )}
            {!connected && canManage && (
              <button type="button" onClick={() => setManualOpen(true)} className="mt-3 text-xs font-medium text-ink-500 hover:text-ink-800 hover:underline">Manual setup (advanced)</button>
            )}
          </section>

          {connected && canManage && <TestMessageCard wa={wa} onSent={(next) => { if (next) setWa(next); void reload().catch(() => {}); }} />}
        </div>

        <Checklist canManage={canManage} connected={connected} wa={wa} onConnect={() => startEmbedded('new')} canUseEmbedded={canUseEmbedded} connectBusy={busy} onUpdated={(next) => { if (next) setWa(next); void onChange?.(); }} />
      </div>

      {connected && extras.map((n) => {
        const nOk = n.status ? n.status === 'connected' : true;
        return (
          <div key={n.phoneNumberId} className="grid items-start gap-4 lg:grid-cols-2">
            <ExtraNumberCard n={n} canManage={canManage} busy={busy} onReconnect={reconnectExtra} onRemove={removeExtra} />
            <Checklist
              title={`Setup status · ${n.label || n.displayPhoneNumber || 'Extra number'}`}
              phoneNumberId={n.phoneNumberId} canManage={canManage} connected={nOk} wa={n}
              onConnect={() => reconnectExtra(n)} canUseEmbedded={canUseEmbedded && n.connectedVia === 'embedded_signup'} connectBusy={busy}
              onUpdated={(next) => { if (next) setWa(next); void onChange?.(); }}
            />
          </div>
        );
      })}
      {connected && canManage && pendingAttempt?.attemptId && pendingAttempt.target === 'extra' && !pinPromptOpen && (
        <button type="button" className="btn-primary gap-2 !py-1.5 text-xs" onClick={() => setPinPromptOpen(true)}><ShieldCheck size={14} />Continue adding number</button>
      )}

      {errorOpen && visibleErrorDetails && (
        <Modal title={visibleErrorDetails.title || 'WhatsApp connection error'} onClose={() => setErrorOpen(false)} wide>
          <p className="mt-3 break-words text-sm leading-6 text-ink-700 dark:text-ink-200">{visibleError}</p>
          {visibleErrorDetails.help && <p className="mt-2 text-sm leading-6 text-ink-700 dark:text-ink-200"><strong>Next step:</strong> {visibleErrorDetails.help}</p>}
          {(visibleErrorDetails.code || visibleErrorDetails.stage || visibleErrorDetails.fbtraceId || wa.lastErrorAt) && (
            <details className="mt-3 text-xs text-ink-500">
              <summary className="cursor-pointer font-semibold">Technical details</summary>
              <div className="mt-1 space-y-1 font-mono">
                <p>Stage: {visibleErrorDetails.stage || wa.lastErrorStage || 'connection'}</p>
                {(visibleErrorDetails.code || wa.lastErrorCode) && <p>Code: {visibleErrorDetails.code || wa.lastErrorCode}</p>}
                {visibleErrorDetails.fbtraceId && <p>Meta trace: {visibleErrorDetails.fbtraceId}</p>}
                {wa.lastErrorAt && <p>Recorded: {new Date(wa.lastErrorAt).toLocaleString()}</p>}
              </div>
            </details>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={async () => { clearConnectionError(); setErrorOpen(false); await reload().catch((err) => showConnectionError(err, 'Could not refresh status.', 'load_status')); }}>Refresh status</button>
            {!connected && canManage && canUseEmbedded && <button type="button" className="btn-primary !bg-[#1877F2] !py-1.5 text-xs" disabled={busy} onClick={() => { setErrorOpen(false); startEmbedded('new'); }}>Try again</button>}
            <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setErrorOpen(false)}>Close</button>
          </div>
        </Modal>
      )}

      {manualOpen && (
        <Modal title="Manual setup" onClose={() => setManualOpen(false)} wide>
          <form onSubmit={async (e) => { await submitManual(e); }} className="mt-3 space-y-3">
            <p className="text-xs leading-5 text-ink-500">For support and technical users only. Use the token, Phone Number ID and WABA ID that Visitsly support verified.</p>
            <label className="block text-sm"><span className="mb-1 block font-medium">System User access token</span><input className="input-field font-mono" type="password" autoComplete="off" required value={manual.accessToken} onChange={(e) => setManual({ ...manual, accessToken: e.target.value.trim() })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm"><span className="mb-1 block font-medium">Phone Number ID</span><input className="input-field font-mono" inputMode="numeric" required value={manual.phoneNumberId} onChange={(e) => setManual({ ...manual, phoneNumberId: e.target.value.trim() })} /></label>
              <label className="block text-sm"><span className="mb-1 block font-medium">WhatsApp Business Account ID</span><input className="input-field font-mono" inputMode="numeric" required value={manual.businessAccountId} onChange={(e) => setManual({ ...manual, businessAccountId: e.target.value.trim() })} /></label>
            </div>
            <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setManualOpen(false)}>Cancel</button><button className="btn-primary gap-2" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Verify and connect</button></div>
          </form>
        </Modal>
      )}

      {addOpen && connected && (
        <Modal title="Add a WhatsApp number" onClose={() => { setAddOpen(false); setManualExtra(null); setAddError(''); }} wide>
          {!manualExtra ? (
            <div className="mt-3 space-y-2.5">
              <p className="text-xs text-ink-500">{numInfo.used} of {numInfo.limit ?? '∞'} numbers used. Your main number is not changed.</p>
              <input className="input-field" placeholder="Label (e.g. Project 2)" maxLength={60} value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
              {canUseEmbedded && (<>
                <button type="button" onClick={() => startExtra('coexistence')} disabled={busy} className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-left transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-900/10">
                  <Smartphone size={20} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink-900 dark:text-white">I use the WhatsApp Business app (recommended)</span><span className="block text-xs text-ink-500">Keep chatting on your phone. No PIN.</span></span>
                  <Link2 size={16} className="shrink-0 text-[#1877F2]" />
                </button>
                <button type="button" onClick={() => startExtra('new')} disabled={busy} className="flex w-full items-center gap-3 rounded-xl border border-ink-100 p-3 text-left transition hover:bg-ink-50 disabled:opacity-60 dark:border-ink-800">
                  <KeyRound size={20} className="shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink-900 dark:text-white">New number with Facebook</span><span className="block text-xs text-ink-500">Needs a 6-digit PIN you choose.</span></span>
                  <Link2 size={16} className="shrink-0 text-[#1877F2]" />
                </button>
              </>)}
              <button type="button" onClick={() => { setAddError(''); setManualExtra({ label: addLabel, phoneNumberId: '', businessAccountId: '', accessToken: '' }); }} className="flex w-full items-center gap-3 rounded-xl border border-ink-100 p-3 text-left transition hover:bg-ink-50 dark:border-ink-800">
                <Info size={20} className="shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink-900 dark:text-white">Manual (Phone Number ID)</span><span className="block text-xs text-ink-500">For support and technical users.</span></span>
              </button>
            </div>
          ) : (
            <form onSubmit={submitManualExtra} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input className="input-field" placeholder="Label (e.g. Project 2)" maxLength={60} value={manualExtra.label} onChange={(e) => setManualExtra({ ...manualExtra, label: e.target.value })} />
              <input className="input-field font-mono" placeholder="Phone Number ID" required inputMode="numeric" readOnly={manualExtra.reconnect} value={manualExtra.phoneNumberId} onChange={(e) => setManualExtra({ ...manualExtra, phoneNumberId: e.target.value.trim() })} />
              <input className="input-field font-mono" placeholder="WABA ID (if different)" inputMode="numeric" value={manualExtra.businessAccountId} onChange={(e) => setManualExtra({ ...manualExtra, businessAccountId: e.target.value.trim() })} />
              <input className="input-field font-mono" type="password" autoComplete="off" placeholder="Token (if different)" value={manualExtra.accessToken} onChange={(e) => setManualExtra({ ...manualExtra, accessToken: e.target.value.trim() })} />
              {addError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{addError}</p>}
              <p className="text-xs text-ink-400 sm:col-span-2">For a number in the same WhatsApp Business account, the Phone Number ID is enough.</p>
              <div className="flex gap-2 sm:col-span-2"><button className="btn-primary gap-2" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}{manualExtra.reconnect ? 'Reconnect' : 'Add'}</button><button type="button" className="btn-secondary" onClick={() => { setManualExtra(null); if (manualExtra.reconnect) setAddOpen(false); }}>Back</button></div>
            </form>
          )}
        </Modal>
      )}
      {manualExtra?.reconnect && !addOpen && (
        <Modal title="Reconnect number" onClose={() => setManualExtra(null)} wide>
          <form onSubmit={submitManualExtra} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input className="input-field font-mono sm:col-span-2" readOnly value={manualExtra.phoneNumberId} />
            <input className="input-field font-mono" placeholder="WABA ID (if different)" inputMode="numeric" value={manualExtra.businessAccountId} onChange={(e) => setManualExtra({ ...manualExtra, businessAccountId: e.target.value.trim() })} />
            <input className="input-field font-mono" type="password" autoComplete="off" placeholder="Token (if different)" value={manualExtra.accessToken} onChange={(e) => setManualExtra({ ...manualExtra, accessToken: e.target.value.trim() })} />
            {addError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{addError}</p>}
            <div className="flex gap-2 sm:col-span-2"><button className="btn-primary gap-2" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Reconnect</button><button type="button" className="btn-secondary" onClick={() => setManualExtra(null)}>Cancel</button></div>
          </form>
        </Modal>
      )}

      {pinPromptOpen && pendingAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="presentation">
          <form onSubmit={completeEmbeddedSignup} role="dialog" aria-modal="true" aria-labelledby="wa-pin-title" className="my-6 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-ink-900">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck size={20} /></span>
              <div><h3 id="wa-pin-title" className="text-base font-semibold text-ink-900 dark:text-white">Finish number setup</h3><p className="mt-1 text-sm text-ink-500">Meta authorization is done. Confirm the number below.</p></div>
            </div>
            {pendingAttempt.phoneNumbers.length > 1 && <label className="mt-4 block text-sm font-medium text-ink-800 dark:text-ink-100">Which number should Visitsly use?
              <select className="input-field mt-1.5" required value={phoneChoice} onChange={(event) => setPhoneChoice(event.target.value)}><option value="">Select phone number</option>{pendingAttempt.phoneNumbers.map((phone) => <option key={phone.phoneNumberId} value={phone.phoneNumberId}>{phone.displayPhoneNumber || `Phone ID ${phone.phoneNumberId}`}{phone.verifiedName ? ` · ${phone.verifiedName}` : ''}</option>)}</select>
            </label>}
            {pendingAttempt.phoneNumbers.length === 1 && <div className="mt-4 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/60"><p className="font-semibold text-ink-900 dark:text-white">{pendingAttempt.phoneNumbers[0].displayPhoneNumber || `Phone ID ${pendingAttempt.phoneNumbers[0].phoneNumberId}`}</p>{pendingAttempt.phoneNumbers[0].verifiedName && <p className="text-xs text-ink-500">{pendingAttempt.phoneNumbers[0].verifiedName}</p>}</div>}
            {pendingAttempt.isCoexistence ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">This number stays on the WhatsApp Business app. No PIN needed.</p> : (<><label className="mt-4 block text-sm font-medium text-ink-800 dark:text-ink-100">6-digit PIN
              <input className="input-field mt-1.5 text-center font-mono text-lg tracking-[0.4em]" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={registrationPin} onChange={(event) => setRegistrationPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" />
            </label>
            <p className="mt-2 text-xs leading-5 text-ink-400">Choose any 6 digits and remember them. For a number already on WhatsApp, enter its current two-step PIN. Visitsly does not store the PIN.</p></>)}
            {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p className="font-semibold">{errorTitle || 'Setup error'}</p><p className="mt-1">{error}</p>{errorHelp && <p className="mt-1 leading-5">Next step: {errorHelp}</p>}{errorCode && <p className="mt-2 font-mono text-xs">Code: {errorCode}{errorStage ? ` · Stage: ${errorStage}` : ''}</p>}</div>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={busy} className="btn-secondary" onClick={() => { setPinPromptOpen(false); setRegistrationPin(''); setConnectStage(''); clearConnectionError(); }}>Do later</button>
              <button type="submit" disabled={busy || (!pendingAttempt.isCoexistence && registrationPin.length !== 6) || !phoneChoice} className="btn-primary gap-2">{busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}Verify and connect</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
