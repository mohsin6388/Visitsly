import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { authApi } from '../../api/authApi.js';
import { publicApi } from '../../api/saasApi.js';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const verifiedAlready = params.get('verified') === '1';
  const [email, setEmail] = useState(params.get('email') || '');
  const [trialDays, setTrialDays] = useState(7);
  const [busy, setBusy] = useState(Boolean(token));
  const [resending, setResending] = useState(false);
  const [state, setState] = useState(verifiedAlready
    ? { type: 'success', message: `Email verify ho gaya. Ab login karke apna ${trialDays}-day trial shuru karein.` }
    : null);
  const tokenAttempted = useRef(false);

  useEffect(() => {
    publicApi.plans().then((response) => setTrialDays(response?.data?.trialDays || 7)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token || tokenAttempted.current) return;
    tokenAttempted.current = true;
    setBusy(true);
    authApi.verifyEmail({ token })
      .then((response) => {
        setState({ type: 'success', message: response.message || 'Email verify ho gaya. Ab login karein.' });
        navigate('/verify-email?verified=1', { replace: true });
      })
      .catch((err) => setState({
        type: 'error',
        message: err?.response?.data?.message || 'Verification link invalid ya expire ho gayi hai. Naya link mangwayein.',
      }))
      .finally(() => setBusy(false));
  }, [token, navigate]);

  const resend = async (event) => {
    event.preventDefault();
    setState(null);
    setResending(true);
    try {
      const response = await authApi.resendVerification({ email: email.trim().toLowerCase() });
      setState({ type: 'success', message: response.message || 'Agar verification pending hai, naya link bhej diya jayega.' });
    } catch (err) {
      setState({ type: 'error', message: err?.response?.data?.message || 'Verification email resend nahi ho paayi. Dobara try karein.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-900">
        {busy ? <Loader2 size={24} className="animate-spin" /> : state?.type === 'success' ? <CheckCircle2 size={24} /> : <MailCheck size={24} />}
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-blue-800">VISITSLY CRM</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">
        {busy ? 'Email verify ho raha hai…' : state?.type === 'success' && verifiedAlready ? 'Email verified' : 'Apna email verify karein'}
      </h1>
      <p className="mt-3 text-sm leading-6 text-ink-600">
        {verifiedAlready
          ? `Aapka workspace ready hai. Login karte hi aapka ${trialDays}-day free trial start ho jayega.`
          : `Account secure rakhne ke liye hum inbox verify karte hain. Verification complete hone ke baad hi workspace aur ${trialDays}-day free trial activate hoga.`}
      </p>

      {state && (
        <div role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${state.type === 'success' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {state.message}
        </div>
      )}

      {verifiedAlready ? (
        <Link to="/login" className="btn-primary mt-6 flex w-full items-center justify-center gap-2 !rounded-xl !bg-blue-950 !py-3.5 text-base hover:!bg-blue-900">
          Login karein <ArrowRight size={18} />
        </Link>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={resend}>
          <div>
            <label htmlFor="verification-email" className="mb-1.5 block text-sm font-semibold text-ink-800">Email address</label>
            <input
              id="verification-email"
              type="email"
              autoComplete="email"
              required
              className="input-field !rounded-xl !py-3"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <button type="submit" disabled={resending || busy} className="btn-primary flex w-full items-center justify-center gap-2 !rounded-xl !bg-blue-950 !py-3.5 hover:!bg-blue-900">
            {resending ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            {resending ? 'Link bheja ja raha hai…' : 'Verification link resend karein'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-500">
        <ShieldCheck size={15} className="mr-1 inline" /> Email verify nahi hua? Inbox ke Spam/Junk folder ko bhi check karein.
      </p>
      <p className="mt-4 text-center text-sm text-ink-600">Already verified? <Link to="/login" className="font-semibold text-blue-900 hover:text-blue-700">Login</Link>{!verifiedAlready && <> · <Link to="/signup" className="font-semibold text-blue-900 hover:text-blue-700">Sign up again</Link></>}</p>
    </div>
  );
}
