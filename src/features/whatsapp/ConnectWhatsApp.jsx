import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Link2, KeyRound, Unplug, ShieldCheck, RefreshCw, XCircle } from 'lucide-react';
import { orgApi, growthApi } from '../../api/saasApi.js';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';

/**
 * Lets a company connect ITS OWN WhatsApp Business number to Visitsly.
 *  - "Connect with Facebook" = Meta Embedded Signup (needs Visitsly's Tech
 *    Provider app + configuration id on the backend).
 *  - "Manual" = paste System User token + Phone Number ID + WABA ID.
 */
function loadFacebookSdk(appId, version) {
  if (!appId) return Promise.reject(new Error('Visitsly ka Meta App ID configure nahi hai. Support team ko contact karein.'));
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
    catch (error) { return Promise.reject(new Error(`Facebook SDK initialize nahi hua: ${error.message}`)); }
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
      finish(reject, new Error('Facebook SDK load hone mein der ho rahi hai. Internet, ad-blocker aur browser tracking protection check karke dobara try karein.'));
    }, 15000);

    window.fbAsyncInit = () => {
      try { finish(resolve, initialize(window.FB)); }
      catch (error) { finish(reject, new Error(`Facebook SDK initialize nahi hua: ${error.message}`)); }
    };

    let script = document.querySelector('script[data-propai-facebook-sdk="true"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.dataset.propaiFacebookSdk = 'true';
      script.onerror = () => finish(reject, new Error('Facebook SDK download nahi ho saka. Network, firewall ya ad-blocker check karein.'));
      document.body.appendChild(script);
    } else {
      script.onerror = () => finish(reject, new Error('Facebook SDK load nahi hua. Page refresh karke dobara try karein.'));
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

/** Extra numbers (Builder: 2, Enterprise: many) — e.g. one number per project. */
function ExtraNumbers({ wa, onUpdated, canManage }) {
  const org = useAuthStore((s) => s.org);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const limit = org?.limits?.whatsappNumbers;
  const used = 1 + (wa.extraNumbers || []).length;
  const canAdd = limit == null || used < limit;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { label: form.label, phoneNumberId: form.phoneNumberId };
      if (form.businessAccountId) payload.businessAccountId = form.businessAccountId;
      if (form.accessToken) payload.accessToken = form.accessToken;
      const res = await growthApi.addNumber(payload);
      onUpdated(res.data.whatsapp);
      setForm(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Number add nahi hua');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (n) => {
    if (!window.confirm(`${n.displayPhoneNumber || n.phoneNumberId} hata dein?`)) return;
    const res = await growthApi.removeNumber(n.phoneNumberId);
    onUpdated(res.data.whatsapp);
  };
  return (
    <div className="mt-5 border-t border-ink-100 pt-4 dark:border-ink-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Aur numbers <span className="font-normal text-ink-400">({used}/{limit ?? '∞'} is plan mein)</span></p>
        {canManage && (canAdd
          ? <button className="btn-secondary !py-1.5 text-xs" onClick={() => setForm({ label: '', phoneNumberId: '', businessAccountId: '', accessToken: '' })}>+ Number add karein</button>
          : <span className="text-xs text-ink-500">Aur number ke liye Builder plan ya add-on lein</span>)}
      </div>
      <ul className="mt-2 space-y-2">
        {(wa.extraNumbers || []).map((n) => (
          <li key={n.phoneNumberId} className="flex items-center justify-between gap-3 rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800/60">
            <span><strong>{n.displayPhoneNumber || n.phoneNumberId}</strong>{n.label ? <span className="text-ink-500"> · {n.label}</span> : null}{n.verifiedName ? <span className="block text-xs text-ink-400">{n.verifiedName}</span> : null}</span>
            {canManage && <button className="text-xs font-semibold text-red-600" onClick={() => remove(n)}>Remove</button>}
          </li>
        ))}
      </ul>
      {form && (
        <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-800 sm:grid-cols-2">
          <input className="input-field" placeholder="Label (jaise Project 2)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input className="input-field font-mono" placeholder="Phone Number ID" required inputMode="numeric" value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value.trim() })} />
          <input className="input-field font-mono" placeholder="WABA ID (alag ho to)" inputMode="numeric" value={form.businessAccountId} onChange={(e) => setForm({ ...form, businessAccountId: e.target.value.trim() })} />
          <input className="input-field font-mono" type="password" autoComplete="off" placeholder="Token (alag ho to)" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value.trim() })} />
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2"><button className="btn-primary" disabled={busy}>Add</button><button type="button" className="btn-secondary" onClick={() => setForm(null)}>Cancel</button></div>
          <p className="text-xs text-ink-400 sm:col-span-2">Usi WhatsApp Business account ka number ho to sirf Phone Number ID kaafi hai. Jis number par customer message karega, AI usi number se jawab dega.</p>
        </form>
      )}
    </div>
  );
}

function connectionErrorDetails(errorOrMessage, fallback = 'WhatsApp connection complete nahi ho paaya.') {
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
  let title = 'WhatsApp connect nahi ho paaya';
  let help = 'Connection ko dobara try karein. Agar same error aaye, error code aur time note karke Visitsly support ko share karein.';

  if (codeKey === 'WHATSAPP_CONNECT_ATTEMPT_EXPIRED' || status === 410 || text.includes('session expire')) {
    title = 'Connection session expire ho gaya';
    help = 'Security ke liye Meta authorization limited time ke liye valid hoti hai. “Connect with Facebook” dobara press karein.';
  } else if (codeKey === 'META_APP_CONFIGURATION_MISSING' || text.includes('meta_app_id') || text.includes('meta_es_config_id') || text.includes('embedded signup configuration complete nahi hai') || (text.includes('platform par') && text.includes('meta'))) {
    title = 'Visitsly ka Meta setup abhi complete nahi hai';
    help = 'Yeh platform-side configuration issue hai, aapke business number ki galti nahi. Visitsly support ko contact karein; baar-baar apna number add/delete na karein.';
  } else if (codeKey === 'META_SIGNUP_DATA_INCOMPLETE' || codeKey === 'META_TOKEN_UNREADABLE') {
    title = 'Meta signup ka result incomplete hai';
    help = 'Meta flow ko poora finish karein aur Facebook se dobara connect karein. OAuth authorization code one-time hota hai, isliye purane popup ko reuse nahi kiya ja sakta.';
  } else if (codeKey === 'META_PHONE_NUMBER_NOT_FOUND' || codeKey === 'META_PHONE_WABA_MISMATCH' || codeKey === 'META_PHONE_SELECTION_INVALID') {
    title = 'WhatsApp number Business Account se match nahi hua';
    help = 'Meta signup mein sahi WhatsApp Business Account aur uske andar wala phone number select karein. Agar list empty hai, number verify/activate karein aur Business permissions check karein.';
  } else if (numericCode === 190 || text.includes('oauth') || text.includes('access token') || text.includes('authorization')) {
    title = 'Meta authorization issue';
    help = 'Facebook se dobara connect karein. Agar problem continue ho, Visitsly admin ko Meta App permissions, configuration ID aur token exchange check karna hoga.';
  } else if (numericCode === 10 || numericCode === 200 || text.includes('permission') || text.includes('not authorized') || text.includes('access denied')) {
    title = 'Meta permissions missing hain';
    help = 'Facebook par us Business Portfolio ko select karein jiske aap admin hain. Agar permissions ka error repeat ho, Visitsly Meta App ke App Review/Advanced Access aur Embedded Signup configuration check karni hogi.';
  } else if (text.includes('pin') || text.includes('two-step') || text.includes('two step') || text.includes('security code')) {
    title = 'Phone registration PIN accept nahi hua';
    help = 'Number ka current 6-digit WhatsApp two-step verification PIN use karein. Naya PIN set kar rahe hain to Meta ke prompt ke mutabik enter karein; repeated guesses na karein. PIN Visitsly mein save nahi hota.';
  } else if (text.includes('already') && (text.includes('number') || text.includes('registered') || text.includes('connected'))) {
    title = 'Ye number pehle se registered ya connected hai';
    help = 'WhatsApp Manager mein check karein ki number kis WABA mein hai. Agar WhatsApp Business App ko bhi saath rakhna hai, number delete na karein—Meta Coexistence eligibility/configuration check karein. Agar number kisi aur Visitsly workspace se linked hai to support se contact karein.';
  } else if (text.includes('restricted') || text.includes('business verification') || text.includes('business is not verified') || text.includes('business is not allowed')) {
    title = 'Meta Business ko verification chahiye';
    help = 'Meta Business Suite / Business Manager mein business restrictions, verification, required two-factor authentication aur number status complete karein; phir retry karein.';
  } else if (text.includes('rate limit') || status === 429) {
    title = 'Meta ne temporarily requests limit ki hain';
    help = 'Kuch der wait karke ek baar dobara try karein. Bar-bar button click na karein.';
  } else if (text.includes('timeout') || text.includes('network') || text.includes('sdk') || text.includes('popup') || text.includes('pop-up')) {
    title = 'Facebook signup window nahi khul paayi';
    help = 'Pop-ups allow karein, ad-blocker/tracking protection temporarily check karein, stable internet use karein aur HTTPS site se retry karein.';
  } else if (text.includes('template')) {
    title = 'WhatsApp template issue';
    help = 'Meta WhatsApp Manager mein correct WABA ke andar template status Approved ho aur selected language/variables match karte hon.';
  } else if (status >= 500 || status === 502 || text.includes('temporarily unavailable')) {
    title = 'Meta ya server temporary unavailable hai';
    help = 'Status refresh karke thodi der baad retry karein. Agar Meta signup complete tha lekin Visitsly ne connect nahi kiya, same flow restart karein; OAuth code reuse nahi hota.';
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
  const canManage = role === 'owner' || role === 'manager';

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
      .catch((e) => { if (active) showConnectionError(e, 'WhatsApp status load nahi hua.', 'load_status'); })
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
    setConnectStage('Meta authorization verify kar rahe hain…');
    clearConnectionError();
    try {
      const response = await orgApi.prepareEmbeddedSignup({
        code: session.code,
        wabaId: String(session.wabaId),
        ...(session.phoneNumberId ? { phoneNumberId: String(session.phoneNumberId) } : {}),
        ...(session.eventType ? { eventType: session.eventType } : {}),
      });
      const attempt = response?.data?.attempt;
      if (!attempt?.attemptId || !Array.isArray(attempt.phoneNumbers) || !attempt.phoneNumbers.length) {
        throw new Error('Meta account verify hua, lekin phone number details nahi mili. Signup dobara start karein.');
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
      setConnectStage(attempt.needsPhoneSelection ? 'WhatsApp number select karein' : 'Phone number registration complete karein');
      setBusy(false);
      setPinPromptOpen(true);
      setWa((previous) => previous ? { ...previous, status: previous.status === 'error' && !previous.phoneNumberId ? 'not_connected' : previous.status, lastError: null, lastErrorCode: null, lastErrorStage: null, lastErrorAt: null } : previous);
    } catch (err) {
      const details = showConnectionError(err, 'Meta signup validate nahi ho paaya.', 'prepare_embedded_signup');
      // OAuth codes are single-use. A failure after code exchange must start a fresh Meta flow.
      sessionRef.current = {};
      setPendingAttempt(null);
      setPinPromptOpen(false);
      if (details.code === 'WHATSAPP_CONNECT_ATTEMPT_EXPIRED') setErrorHelp('Facebook se dobara connect karein.');
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
          setConnectStage('Meta signup result receive hua. Account verify kar rahe hain…');
          if (!sessionRef.current.wabaId) {
            window.setTimeout(() => {
              const latest = sessionRef.current;
              if (latest.code && !latest.wabaId && !latest.preparationStarted) {
                clearFlowTimer();
                showConnectionError(
                  'Meta signup event mein WhatsApp Business Account ID nahi mila.',
                  'Meta signup result incomplete hai.',
                  'receive_signup_result',
                );
                setErrorCode('META_SIGNUP_DATA_INCOMPLETE');
                setErrorHelp('Meta Embedded Signup v4 configuration aur app permissions check karke Facebook flow dobara complete karein.');
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
          setErrorTitle('Aapne WhatsApp setup beech mein band kar diya');
          setError('Meta ne connection complete nahi kiya; abhi koi naya number Visitsly mein activate nahi hua.');
          setErrorHelp(`Jab ready hon, Connect with Facebook dobara press karein${currentStep}. Aap is screen se bahar jaakar baad mein bhi continue kar sakte hain.`);
          setErrorCode('META_SIGNUP_CANCELLED');
          setErrorStage('meta_signup');
        } else if (type === 'ERROR') {
          clearFlowTimer();
          showConnectionError(data.error_message || data.error?.message || 'Meta Embedded Signup ne error return kiya.', 'Meta signup error.', 'meta_signup');
          setErrorCode(data.error_code ? String(data.error_code) : 'META_EMBEDDED_SIGNUP_ERROR');
        }
      } catch { /* Ignore unrelated postMessage payloads from other SDKs. */ }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEmbedded = async () => {
    clearConnectionError();
    setWa((previous) => previous ? {
      ...previous,
      status: previous.status === 'error' && !previous.phoneNumberId ? 'not_connected' : previous.status,
      lastError: null,
      lastErrorCode: null,
      lastErrorStage: null,
      lastErrorAt: null,
    } : previous);
    setSuccessNotice('');
    setConnectStage('Facebook login tayyar kar rahe hain…');
    setBusy(true);
    setPendingAttempt(null);
    setPinPromptOpen(false);
    sessionRef.current = {};

    const es = wa?.embeddedSignup;
    if (!es?.available || !es.appId || !es.configId) {
      showConnectionError('Visitsly ka Meta Embedded Signup configuration complete nahi hai.', 'Meta signup configuration missing hai.', 'platform_configuration');
      setErrorHelp('Visitsly admin ko META_APP_ID aur META_ES_CONFIG_ID configure karne honge. Ye platform-level setup hai; customer ko apne tokens paste karne ki zaroorat nahi honi chahiye.');
      return;
    }
    if (window.location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      showConnectionError('Facebook Embedded Signup ke liye HTTPS required hai.', 'Secure connection required.', 'browser');
      setErrorHelp('Visitsly ko HTTPS domain par open karein, phir Facebook se connect karein.');
      return;
    }

    try {
      const FB = await loadFacebookSdk(es.appId, es.apiVersion);
      setConnectStage('Facebook popup mein business authorize karein…');
      flowTimerRef.current = window.setTimeout(() => {
        if (sessionRef.current.attemptId || sessionRef.current.preparationStarted) return;
        setBusy(false);
        setConnectStage('');
        setErrorTitle('Meta signup ka response nahi mila');
        setError('Facebook popup ka connection result Visitsly tak nahi pahuncha.');
        setErrorHelp('Popup block na ho, Meta flow ko poora finish karein, aur agar ab bhi issue ho to third-party cookie/tracking protection check karke retry karein.');
        setErrorCode('META_SIGNUP_RESPONSE_TIMEOUT');
        setErrorStage('meta_signup');
      }, 90000);

      FB.login((response) => {
        if (sessionRef.current.eventType === 'CANCEL' || sessionRef.current.eventType === 'ERROR') return;
        if (response?.authResponse?.code) {
          sessionRef.current.code = response.authResponse.code;
          setConnectStage('Meta authorization result ka wait kar rahe hain…');
          finishIfReady();
        } else {
          // Meta's CANCEL postMessage can race with the FB.login callback.
          window.setTimeout(() => {
            if (sessionRef.current.eventType === 'CANCEL' || sessionRef.current.eventType === 'ERROR') return;
            clearFlowTimer();
            setBusy(false);
            setConnectStage('');
            setErrorTitle('Facebook login complete nahi hua');
            setError(response?.status === 'unknown'
              ? 'Facebook ne authorization code return nahi kiya.'
              : 'Facebook signup cancel hua ya authorization code nahi mila.');
            setErrorHelp('Popup allow karein, sahi Facebook account use karein, aur business access approve karke flow ko poora finish karein. Agar Meta ne permission error dikhaya tha to uska code note karein.');
            setErrorCode('META_OAUTH_CODE_MISSING');
            setErrorStage('oauth_callback');
          }, 1000);
        }
      }, {
        config_id: es.configId,
        auth_type: 'rerequest',
        response_type: 'code',
        override_default_response_type: true,
        extras: es.solutionId ? { setup: { solutionID: es.solutionId } } : {},
      });
    } catch (err) {
      clearFlowTimer();
      showConnectionError(err, 'Facebook signup start nahi ho paaya.', 'load_facebook_sdk');
    }
  };

  const completeEmbeddedSignup = async (event) => {
    event.preventDefault();
    clearConnectionError();
    if (!pendingAttempt?.attemptId) {
      showConnectionError('Connection attempt missing hai.', 'Connection session expire ho gaya.', 'complete_signup');
      setErrorHelp('Security ke liye Facebook se WhatsApp dobara connect karein.');
      setPinPromptOpen(false);
      return;
    }
    if (!phoneChoice || !pendingAttempt.phoneNumbers.some((phone) => phone.phoneNumberId === phoneChoice)) {
      showConnectionError('WhatsApp number select karna zaroori hai.', 'Phone number select karein.', 'select_phone_number');
      return;
    }
    if (!/^\d{6}$/.test(registrationPin)) {
      showConnectionError('Meta registration ke liye 6-digit PIN enter karein.', 'Invalid registration PIN.', 'register_phone_number');
      return;
    }

    setBusy(true);
    setConnectStage('Meta permissions, webhook subscription aur phone registration verify kar rahe hain…');
    try {
      await orgApi.completeEmbeddedSignup({
        attemptId: pendingAttempt.attemptId,
        phoneNumberId: phoneChoice,
        pin: registrationPin,
      });
      clearFlowTimer();
      setPinPromptOpen(false);
      setRegistrationPin('');
      setPendingAttempt(null);
      sessionRef.current = {};
      setConnectStage('');
      clearConnectionError();
      setSuccessNotice('WhatsApp number successfully connected. Ab leads aur properties setup kar sakte hain.');
      await reload();
    } catch (err) {
      const details = showConnectionError(err, 'Number registration complete nahi ho paayi.', 'complete_signup');
      // If the backend committed the connection but the HTTP response/audit step
      // failed, re-check state before asking the customer to repeat registration.
      const latest = await reload().catch(() => null);
      if (latest?.status === 'connected') {
        setPinPromptOpen(false);
        setRegistrationPin('');
        setPendingAttempt(null);
        sessionRef.current = {};
        clearConnectionError();
        setWa((previous) => previous ? { ...previous, lastError: null, lastErrorCode: null, lastErrorStage: null, lastErrorAt: null } : previous);
        setSuccessNotice('WhatsApp successfully connected. Server response mein temporary issue tha, lekin connection verify ho gaya hai.');
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
    setConnectStage('Manual Meta credentials verify kar rahe hain…');
    try {
      await orgApi.connectManual(manual);
      setManual({ accessToken: '', phoneNumberId: '', businessAccountId: '' });
      setSuccessNotice('WhatsApp number successfully connected.');
      await reload();
    } catch (err) {
      showConnectionError(err, 'Manual connect nahi hua.', 'manual_connect');
      await reload().catch(() => {});
    } finally {
      setBusy(false);
      setConnectStage('');
    }
  };

  const disconnect = async () => {
    if (!window.confirm('WhatsApp number Visitsly se hata dein? AI replies aur bulk messages ruk jayenge. Chats ka data safe rahega.')) return;
    clearConnectionError();
    setBusy(true);
    try {
      await orgApi.disconnectWhatsapp();
      setSuccessNotice('WhatsApp Visitsly se disconnect ho gaya. Meta mein number delete nahi kiya gaya.');
      await reload();
    } catch (err) {
      showConnectionError(err, 'Disconnect request complete nahi hui.', 'disconnect');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="card flex justify-center py-10"><Loader2 className="animate-spin text-ink-400" /></div>;
  if (!wa) return <section className="card"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 text-amber-600" /><div><h2 className="font-semibold text-ink-900 dark:text-white">WhatsApp status load nahi hua</h2><p className="mt-1 text-sm text-ink-500">{error || 'Server se current connection status nahi mil paaya.'}</p><button type="button" onClick={() => { setLoading(true); clearConnectionError(); orgApi.whatsapp().then((r) => setWa(r.data.whatsapp)).catch((e) => showConnectionError(e, 'WhatsApp status load nahi hua.', 'load_status')).finally(() => setLoading(false)); }} className="btn-secondary mt-3 gap-2"><RefreshCw size={14} /> Retry status check</button></div></div></section>;

  const connected = wa.status === 'connected';
  // Preserve failed reconnect diagnostics even if the previously connected number remains usable.
  const visibleError = error || wa.lastError || '';
  const visibleErrorDetails = error
    ? { title: errorTitle, help: errorHelp, code: errorCode, stage: errorStage }
    : visibleError
      ? connectionErrorDetails({ message: visibleError, response: { data: { details: { code: wa.lastErrorCode, metaCode: wa.lastErrorCode, stage: wa.lastErrorStage } } } })
      : null;
  const canUseEmbedded = Boolean(wa.embeddedSignup?.available && wa.embeddedSignup?.appId && wa.embeddedSignup?.configId);

  return (
    <section className="card min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Aapka WhatsApp Business number</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">Apna business number Meta ke official signup se connect karein. AI aur campaigns isi connected number se chalenge; WhatsApp message charges Meta ke account par honge.</p>
        </div>
        {connected
          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={14} /> Connected</span>
          : wa.status === 'error'
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={14} /> Needs attention</span>
            : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Not connected</span>}
      </div>

      {visibleError && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <div className="flex items-start gap-2.5"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1">
            <p className="font-semibold">{visibleErrorDetails?.title || 'WhatsApp connection error'}</p>
            <p className="mt-1 break-words">{visibleError}</p>
            {visibleErrorDetails?.help && <p className="mt-2 leading-5"><strong>Next step:</strong> {visibleErrorDetails.help}</p>}
            {(visibleErrorDetails?.code || visibleErrorDetails?.stage || visibleErrorDetails?.fbtraceId || wa.lastErrorAt) && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Technical details (support ke liye)</summary><div className="mt-1 space-y-1 font-mono"><p>Stage: {visibleErrorDetails?.stage || wa.lastErrorStage || 'connection'}</p>{(visibleErrorDetails?.code || wa.lastErrorCode) && <p>Code: {visibleErrorDetails?.code || wa.lastErrorCode}</p>}{visibleErrorDetails?.fbtraceId && <p>Meta trace: {visibleErrorDetails.fbtraceId}</p>}{wa.lastErrorAt && <p>Last recorded: {new Date(wa.lastErrorAt).toLocaleString()}</p>}</div></details>}
          </div><button type="button" className="text-red-500 hover:text-red-700" onClick={() => { clearConnectionError(); if (wa.status === 'error') setWa((prev) => ({ ...prev, lastError: null, lastErrorCode: null, lastErrorStage: null, lastErrorAt: null })); }} aria-label="Dismiss error"><XCircle size={17} /></button></div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className="btn-secondary !py-1.5 text-xs" onClick={async () => { clearConnectionError(); await reload().catch((err) => showConnectionError(err, 'Status refresh nahi ho paaya.', 'load_status')); }}>Refresh status</button>{!connected && canManage && canUseEmbedded && <button type="button" className="btn-primary !py-1.5 text-xs !bg-[#1877F2]" onClick={startEmbedded} disabled={busy}>Try Facebook connection again</button>}</div>
        </div>
      )}

      {successNotice && <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 size={17} className="mt-0.5 shrink-0" /><span className="flex-1">{successNotice}</span><button type="button" onClick={() => setSuccessNotice('')} aria-label="Dismiss success notice"><XCircle size={16} /></button></div>}

      {connectStage && <div role="status" aria-live="polite" className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"><Loader2 size={17} className="mt-0.5 shrink-0 animate-spin" /><div><p className="font-semibold">Setup in progress</p><p className="mt-0.5">{connectStage}</p><p className="mt-1 text-xs opacity-80">Is dauran page close ya Connect button ko baar-baar click na karein.</p></div></div>}

      {connected ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-ink-50 p-4 dark:bg-ink-800/60">
          <div>
            <p className="font-display text-xl font-bold text-ink-900 dark:text-white">{wa.displayPhoneNumber || `Phone Number ID ${wa.phoneNumberId}`}</p>
            <p className="text-sm text-ink-500">{wa.verifiedName || 'Business name pending'}{wa.qualityRating ? ` · Quality ${wa.qualityRating}` : ''} · {wa.connectedVia === 'embedded_signup' ? 'Facebook se connected' : 'Manual setup'}</p>
            {wa.connectedAt && <p className="mt-1 text-xs text-ink-400">Connected {new Date(wa.connectedAt).toLocaleString()}</p>}
          </div>
          {canManage && wa.connectedVia !== 'env' && <div className="flex flex-wrap gap-2">
            {canUseEmbedded && <button onClick={startEmbedded} disabled={busy} className="btn-secondary gap-2">{busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}Reconnect with Meta</button>}
            <button onClick={disconnect} disabled={busy} className="btn-secondary gap-2 text-red-600"><Unplug size={15} />Remove connection</button>
          </div>}
        </div>
      ) : !canManage ? (
        <p className="mt-4 rounded-lg bg-ink-50 p-3 text-sm text-ink-500 dark:bg-ink-800/50">Company owner ya manager WhatsApp number connect kar sakte hain. Unse connection complete karne ko kahein.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {canUseEmbedded ? (
            <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
              <p className="font-semibold text-ink-900 dark:text-white">Step 1 — Meta se WhatsApp connect karein</p>
              <p className="mt-1 text-sm leading-5 text-ink-500 dark:text-ink-400">Business Portfolio ke admin Facebook account se login karein. Meta flow mein apna WABA aur phone number choose karke permissions aur number verification complete karein. Existing WhatsApp Business App number ko saath use karna hai to ye Meta Coexistence eligibility/configuration par depend karta hai.</p>
              <button onClick={startEmbedded} disabled={busy} className="btn-primary mt-4 gap-2 !bg-[#1877F2] hover:!bg-[#166FE5]">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}Connect with Facebook
              </button>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400"><ShieldCheck size={13} /> Visitsly aapka Facebook password nahi dekhta. Access token browser mein expose nahi hota.</p>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-ink-400"><Info size={13} className="mt-0.5 shrink-0" /> Agar popup close ho jaaye ya Meta error dikhaye, neeche exact error aur next step show hoga. Connection ke liye aapko Meta App ka admin banna zaroori nahi, lekin apne business assets ka access hona chahiye.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">Facebook connect abhi platform par configure nahi hai</p>
              <p className="mt-1 leading-5">Visitsly admin ko Meta App ID aur current Embedded Signup configuration ID configure karni hogi. Ye platform setup hai, customer ki galti nahi. Support team se setup karwayein.</p>
            </div>
          )}

          {pendingAttempt?.attemptId && !pinPromptOpen && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><p className="font-semibold">WhatsApp number setup pending hai</p><p className="mt-1">Meta authorization securely temporary save hai aur 15 minute mein expire hoga. Resume karke phone number/PIN complete karein.</p><button type="button" className="btn-primary mt-2 gap-2" onClick={() => setPinPromptOpen(true)}><ShieldCheck size={15} />Continue setup</button></div>}

          <details className="rounded-xl border border-ink-100 dark:border-ink-800">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink-800 dark:text-ink-100"><span className="inline-flex items-center gap-2"><KeyRound size={16} /> Advanced manual setup (support/technical users)</span></summary>
            <form onSubmit={submitManual} className="space-y-3 border-t border-ink-100 p-4 dark:border-ink-800">
              <p className="text-xs leading-5 text-ink-500">Normal users should use Connect with Facebook. Manual setup sirf tab karein jab Visitsly support ne System User token, Phone Number ID aur WABA ID provide/verify ki ho. Token sirf HTTPS par paste karein.</p>
              <label className="block text-sm"><span className="mb-1 block font-medium">System User access token</span><input className="input-field font-mono" type="password" autoComplete="off" required value={manual.accessToken} onChange={(e) => setManual({ ...manual, accessToken: e.target.value.trim() })} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="mb-1 block font-medium">Phone Number ID</span><input className="input-field font-mono" inputMode="numeric" required value={manual.phoneNumberId} onChange={(e) => setManual({ ...manual, phoneNumberId: e.target.value.trim() })} /></label>
                <label className="block text-sm"><span className="mb-1 block font-medium">WhatsApp Business Account ID</span><input className="input-field font-mono" inputMode="numeric" required value={manual.businessAccountId} onChange={(e) => setManual({ ...manual, businessAccountId: e.target.value.trim() })} /></label>
              </div>
              <button className="btn-primary gap-2" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Verify & connect</button>
            </form>
          </details>
        </div>
      )}

      {connected && <ExtraNumbers wa={wa} canManage={canManage} onUpdated={(next) => { setWa(next); void onChange?.(); }} />}

      {pinPromptOpen && pendingAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="presentation">
          <form onSubmit={completeEmbeddedSignup} role="dialog" aria-modal="true" aria-labelledby="wa-pin-title" className="my-6 w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-ink-900">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"><ShieldCheck size={20} /></span>
              <div><h3 id="wa-pin-title" className="text-base font-semibold text-ink-900 dark:text-white">Finish WhatsApp number setup</h3><p className="mt-1 text-sm leading-5 text-ink-500 dark:text-ink-400">Meta authorization complete hai. Ab selected number register aur verify hoga. Temporary authorization 15 minute tak valid hai.</p></div>
            </div>
            {pendingAttempt.phoneNumbers.length > 1 && <label className="mt-4 block text-sm font-medium text-ink-800 dark:text-ink-100">Kaunsa WhatsApp number Visitsly se connect karna hai?
              <select className="input-field mt-1.5" required value={phoneChoice} onChange={(event) => setPhoneChoice(event.target.value)}><option value="">Select phone number</option>{pendingAttempt.phoneNumbers.map((phone) => <option key={phone.phoneNumberId} value={phone.phoneNumberId}>{phone.displayPhoneNumber || `Phone ID ${phone.phoneNumberId}`}{phone.verifiedName ? ` · ${phone.verifiedName}` : ''}</option>)}</select>
              <span className="mt-1 block text-xs text-ink-400">Sirf wahi number select karein jise aap is workspace mein use karna chahte hain.</span>
            </label>}
            {pendingAttempt.phoneNumbers.length === 1 && <div className="mt-4 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/60"><p className="text-xs text-ink-500">Selected number</p><p className="mt-1 font-semibold text-ink-900 dark:text-white">{pendingAttempt.phoneNumbers[0].displayPhoneNumber || `Phone ID ${pendingAttempt.phoneNumbers[0].phoneNumberId}`}</p>{pendingAttempt.phoneNumbers[0].verifiedName && <p className="text-xs text-ink-500">{pendingAttempt.phoneNumbers[0].verifiedName}</p>}</div>}
            <label className="mt-4 block text-sm font-medium text-ink-800 dark:text-ink-100">6-digit WhatsApp registration PIN
              <input className="input-field mt-1.5 text-center font-mono text-lg tracking-[0.4em]" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={registrationPin} onChange={(event) => setRegistrationPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" />
            </label>
            <p className="mt-2 text-xs leading-5 text-ink-400">Fresh Cloud API registration ke liye Meta ke mutabik PIN set/enter karein; already registered number ke liye current two-step verification PIN use ho sakta hai. Visitsly PIN database mein save nahi karta. Agar PIN ka sure nahi hai, repeated guesses na karein.</p>
            {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><p className="font-semibold">{errorTitle || 'Setup error'}</p><p className="mt-1">{error}</p>{errorHelp && <p className="mt-1 leading-5">Next step: {errorHelp}</p>}{errorCode && <p className="mt-2 font-mono text-xs">Code: {errorCode}{errorStage ? ` · Stage: ${errorStage}` : ''}</p>}</div>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={busy} className="btn-secondary" onClick={() => { setPinPromptOpen(false); setRegistrationPin(''); setConnectStage(''); clearConnectionError(); }}>Do later</button>
              <button type="submit" disabled={busy || registrationPin.length !== 6 || !phoneChoice} className="btn-primary gap-2">{busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}Verify & connect</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
