import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailX } from 'lucide-react';
import api from '../../api/axios.js';

/**
 * Fallback unsubscribe page (used when PUBLIC_API_URL is not set, so email
 * links point at the app). Never unsubscribes on page load — the person
 * clicks the button, so mail scanners opening the link don't unsubscribe anyone.
 */
export default function UnsubscribePage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | done | error | busy

  useEffect(() => {
    api.get(`/public/unsubscribe/${token}/status`)
      .then((r) => { setInfo(r.data.data); setState(r.data.data.unsubscribed ? 'done' : 'ready'); })
      .catch(() => setState('error'));
  }, [token]);

  const confirm = async () => {
    setState('busy');
    try {
      await api.post(`/public/unsubscribe/${token}`, {}, { headers: { Accept: 'application/json' } });
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f8ff] p-4">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-7 text-center shadow-card">
        {state === 'loading' && <Loader2 className="mx-auto animate-spin text-ink-400" />}
        {state === 'error' && <><MailX className="mx-auto text-red-500" size={32} /><h1 className="mt-3 text-lg font-bold">Link not valid</h1><p className="mt-2 text-sm text-ink-500">This unsubscribe link is invalid or expired.</p></>}
        {(state === 'ready' || state === 'busy') && (
          <>
            <MailX className="mx-auto text-brand-600" size={32} />
            <h1 className="mt-3 text-lg font-bold">Unsubscribe from emails?</h1>
            <p className="mt-2 text-sm text-ink-500">Stop marketing emails{info?.company ? ` from ${info.company}` : ''} to {info?.email || 'this address'}.</p>
            <button onClick={confirm} disabled={state === 'busy'} className="btn-primary mt-5 w-full">{state === 'busy' ? 'Please wait…' : 'Yes, unsubscribe me'}</button>
          </>
        )}
        {state === 'done' && <><CheckCircle2 className="mx-auto text-green-600" size={32} /><h1 className="mt-3 text-lg font-bold">You are unsubscribed</h1><p className="mt-2 text-sm text-ink-500">You will no longer receive marketing emails{info?.company ? ` from ${info.company}` : ''}.</p></>}
      </div>
    </div>
  );
}
