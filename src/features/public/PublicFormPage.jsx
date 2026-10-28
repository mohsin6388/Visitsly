import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { publicApi } from '../../api/saasApi.js';

/** /f/:key — shareable enquiry form (Instagram bio, WhatsApp status, QR code). */
export default function PublicFormPage() {
  const { key } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', project: '', budget: '', message: '', website: '' });
  const [state, setState] = useState('idle');

  useEffect(() => {
    publicApi.formInfo(key).then((r) => setInfo(r.data)).catch(() => setError('Ye form ab available nahi hai.'));
  }, [key]);

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    try {
      await publicApi.submitForm(key, { ...form, source: 'hosted_form', page: window.location.href });
      setState('done');
    } catch (err) {
      setState('idle');
      setError(err?.response?.data?.message || 'Submit nahi hua, dobara try karein.');
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-[#fcfbf8] px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3">
          {info?.logoUrl ? <img src={info.logoUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1 shadow-card" /> : <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-950 text-white"><Building2 size={22} /></span>}
          <div><p className="font-display text-xl font-bold text-emerald-950">{info?.company || ' '}</p>{info?.city && <p className="text-sm text-ink-500">{info.city}</p>}</div>
        </div>
        <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          {state === 'done' ? (
            <div className="py-6 text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-600" />
              <p className="mt-3 font-display text-xl font-bold text-ink-900">Shukriya!</p>
              <p className="mt-1 text-sm text-ink-600">Hum aapko WhatsApp par jald contact karenge.</p>
            </div>
          ) : !info && !error ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ink-400" /></div> : (
            <form onSubmit={submit} className="space-y-3">
              <h1 className="font-display text-lg font-bold text-ink-900">Property enquiry</h1>
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <input className="input-field" placeholder="Aapka naam" required autoComplete="name" value={form.name} onChange={set('name')} />
              <input className="input-field" placeholder="Mobile (WhatsApp)" required inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
              <input className="input-field" placeholder="Email (optional)" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
              {info?.projects?.length > 0 && (
                <select className="input-field" value={form.project} onChange={set('project')} aria-label="Project">
                  <option value="">Kaunsa project? (optional)</option>
                  {info.projects.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <input className="input-field" placeholder="Budget (jaise 60 lakh)" value={form.budget} onChange={set('budget')} />
              <textarea className="input-field" rows={3} placeholder="Requirement (2/3 BHK, location…)" value={form.message} onChange={set('message')} />
              <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} aria-hidden="true" />
              <button className="btn-primary w-full !bg-emerald-950 !py-3 hover:!bg-emerald-900" disabled={state === 'sending' || !info}>{state === 'sending' ? 'Bhej rahe hain…' : 'Submit'}</button>
              <p className="text-center text-xs text-ink-400">Submit karke aap WhatsApp/call par contact ki anumati dete hain.</p>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-ink-400">Powered by Visitsly</p>
      </div>
    </div>
  );
}
