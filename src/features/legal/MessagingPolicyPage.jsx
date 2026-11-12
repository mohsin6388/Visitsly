import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Loader2, ShieldCheck } from 'lucide-react';
import { publicApi } from '../../api/saasApi.js';

/** Public Bulk Messaging & Acceptable Use Policy (text comes from the API). */
export default function MessagingPolicyPage() {
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    publicApi.messagingPolicy().then((r) => setPolicy(r.data)).catch(() => setError('Policy load nahi hui. Thodi der baad try karein.'));
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f8ff] text-ink-900">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/pricing" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><Building2 size={20} /></span>
          <span className="font-display text-lg font-bold">Visitsly</span>
        </Link>
        <Link to="/login" className="text-sm font-semibold text-brand-700">Login</Link>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!policy && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" /></div>}
        {policy && (
          <article className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-10">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-700"><ShieldCheck size={16} /> Version {policy.version} · updated {policy.updated}</p>
            <h1 className="mt-2 font-display text-3xl font-bold">{policy.title}</h1>
            <p className="mt-4 leading-7 text-ink-600">{policy.intro}</p>
            {policy.sections.map((sec) => (
              <section key={sec.heading} className="mt-8">
                <h2 className="font-display text-lg font-bold">{sec.heading}</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-ink-700">
                  {sec.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </section>
            ))}
            <p className="mt-10 rounded-xl bg-brand-50 p-4 text-sm text-ink-700">When you launch a campaign you confirm: “{policy.acceptanceText}”</p>
          </article>
        )}
      </main>
    </div>
  );
}
