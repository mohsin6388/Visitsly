import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, LifeBuoy, Loader2, Plus, Send, Star } from 'lucide-react';
import { supportApi } from '../../api/saasApi.js';
import { toast, EmptyState, PageLoader } from '../../components/ui/index.jsx';

const CATEGORIES = [
  ['billing', 'Billing & plan'], ['whatsapp', 'WhatsApp connection'], ['ai', 'AI chat / replies'], ['leads', 'Leads & contacts'],
  ['campaigns', 'Campaigns / bulk send'], ['account', 'Account & team'], ['bug', 'Something is broken'], ['feature', 'Feature request'], ['other', 'Other'],
];
const PRIORITIES = [['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent — blocking my work']];
const STATUS = {
  open: ['Open', 'bg-sky-50 text-sky-700 ring-sky-200'],
  in_progress: ['In progress', 'bg-amber-50 text-amber-700 ring-amber-200'],
  waiting_customer: ['Waiting for you', 'bg-violet-50 text-violet-700 ring-violet-200'],
  resolved: ['Resolved', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  closed: ['Closed', 'bg-slate-100 text-slate-600 ring-slate-200'],
};
const errText = (e) => e?.response?.data?.message || 'Something went wrong';
const when = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function StatusPill({ status }) {
  const [label, cls] = STATUS[status] || STATUS.open;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>{label}</span>;
}

export default function SupportTicketsPage() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const selected = params.get('ticket');
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['support-tickets'], queryFn: () => supportApi.list(), refetchInterval: 45_000 });
  const tickets = data?.data?.items || [];

  const open = (id) => { setCreating(false); setParams(id ? { ticket: id } : {}); };
  const refresh = () => { qc.invalidateQueries({ queryKey: ['support-tickets'] }); qc.invalidateQueries({ queryKey: ['support-unread'] }); };
  const showRight = creating || selected;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Support</h1>
          <p className="mt-0.5 text-sm text-slate-500">Koi problem ya sawal ho to ticket raise karein — hamari team yahin reply karegi.</p>
        </div>
        <button className="btn-primary" onClick={() => { setCreating(true); setParams({}); }}><Plus size={16} className="mr-1.5" /> New ticket</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className={`${showRight ? 'hidden lg:block' : ''} card !p-0 overflow-hidden`}>
          {isLoading ? <PageLoader /> : !tickets.length ? (
            <div className="p-6"><EmptyState icon={LifeBuoy} title="Abhi koi ticket nahi">Problem aaye to "New ticket" dabayein.</EmptyState></div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto dark:divide-ink-800">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button onClick={() => open(t.id)} className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-ink-800 ${selected === t.id ? 'bg-emerald-50/70 dark:bg-ink-800' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-400">{t.number}</span>
                      <StatusPill status={t.status} />
                    </div>
                    <p className={`mt-1 truncate text-sm ${t.unread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-ink-200'}`}>{t.unread && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />}{t.subject}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{when(t.lastMessageAt)} · {t.lastReplyBy === 'admin' ? 'Support replied' : 'You wrote last'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${showRight ? '' : 'hidden lg:block'}`}>
          {creating ? (
            <NewTicket onBack={() => setCreating(false)} onCreated={(t) => { refresh(); open(t.id); }} />
          ) : selected ? (
            <Thread key={selected} id={selected} onBack={() => open(null)} onChanged={refresh} />
          ) : (
            <div className="card hidden py-16 lg:block"><EmptyState icon={LifeBuoy} title="Ticket chunein">Left se koi ticket kholein ya naya banayein.</EmptyState></div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewTicket({ onBack, onCreated }) {
  const [f, setF] = useState({ subject: '', category: 'other', priority: 'normal', message: '' });
  const create = useMutation({
    mutationFn: () => supportApi.create(f),
    onSuccess: (r) => { toast.success('Ticket raised. Hum jaldi reply karenge.'); onCreated(r.data.ticket); },
    onError: (e) => toast.error(errText(e)),
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="card space-y-4">
      <div className="flex items-center gap-2"><button type="button" className="rounded-lg p-1.5 hover:bg-slate-100 lg:hidden" onClick={onBack}><ArrowLeft size={18} /></button><h2 className="text-lg font-bold">Raise a ticket</h2></div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
        <input className="input-field" required minLength={3} maxLength={200} value={f.subject} onChange={set('subject')} placeholder="Short summary, e.g. WhatsApp number connect nahi ho raha" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Topic</label>
          <select className="input-field" value={f.category} onChange={set('category')}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</label>
          <select className="input-field" value={f.priority} onChange={set('priority')}>{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Describe the problem</label>
        <textarea className="input-field min-h-[160px]" required minLength={5} maxLength={5000} value={f.message} onChange={set('message')} placeholder="Kya ho raha hai, kab se, kaunsa error dikh raha hai — jitna detail me likhenge utni jaldi solve hoga." />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onBack}>Cancel</button>
        <button className="btn-primary" disabled={create.isPending}>{create.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} className="mr-1.5" /> Submit ticket</>}</button>
      </div>
    </form>
  );
}

function Thread({ id, onBack, onChanged }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['support-ticket', id], queryFn: () => supportApi.get(id), refetchInterval: 30_000 });
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const end = useRef(null);
  const t = data?.data?.ticket;

  useEffect(() => { onChanged(); }, [t?.unread]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [t?.messages?.length]);

  const after = (r) => { qc.setQueryData(['support-ticket', id], r); onChanged(); };
  const reply = useMutation({ mutationFn: () => supportApi.reply(id, text), onSuccess: (r) => { setText(''); after(r); }, onError: (e) => toast.error(errText(e)) });
  const close = useMutation({ mutationFn: () => supportApi.close(id, rating || undefined), onSuccess: (r) => { toast.success('Ticket closed. Thanks!'); after(r); }, onError: (e) => toast.error(errText(e)) });

  if (isLoading) return <div className="card"><PageLoader /></div>;
  if (error || !t) return <div className="card text-sm text-red-600">{errText(error)} <button className="ml-2 underline" onClick={onBack}>Back</button></div>;
  const closed = t.status === 'closed';

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-ink-800">
        <div className="flex min-w-0 items-center gap-2">
          <button className="rounded-lg p-1.5 hover:bg-slate-100 lg:hidden" onClick={onBack}><ArrowLeft size={18} /></button>
          <div className="min-w-0"><p className="font-mono text-[11px] text-slate-400">{t.number} · {CATEGORIES.find((c) => c[0] === t.category)?.[1]}</p><h2 className="truncate text-base font-bold">{t.subject}</h2></div>
        </div>
        <StatusPill status={t.status} />
      </div>

      <div className="max-h-[52vh] min-h-[240px] space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-ink-950">
        {t.messages.map((m) => (
          <div key={m.id} className={`flex ${m.authorType === 'customer' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.authorType === 'customer' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-800 shadow-card dark:bg-ink-800 dark:text-ink-100'}`}>
              <p className={`mb-1 text-[11px] font-semibold ${m.authorType === 'customer' ? 'text-emerald-100' : 'text-slate-400'}`}>{m.authorType === 'customer' ? 'You' : m.authorName} · {when(m.createdAt)}</p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {closed ? (
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500"><CheckCircle2 size={16} className="text-emerald-600" /> Ye ticket closed hai. Nayi problem ke liye naya ticket raise karein.</div>
      ) : (
        <div className="border-t border-slate-100 p-4 dark:border-ink-800">
          <textarea className="input-field min-h-[80px]" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} placeholder={t.status === 'resolved' ? 'Problem phir aa rahi hai? Yahin likhein, ticket dobara khul jayega…' : 'Reply likhein…'} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <button type="button" className="btn-secondary !py-1.5 text-xs" disabled={close.isPending} onClick={() => close.mutate()}><CheckCircle2 size={14} className="mr-1" /> Mark as solved</button>
              <span className="flex items-center" title="Optional rating when you close">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} className="p-0.5"><Star size={15} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} /></button>)}
              </span>
            </div>
            <button className="btn-primary" disabled={!text.trim() || reply.isPending} onClick={() => reply.mutate()}>{reply.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} className="mr-1.5" /> Send</>}</button>
          </div>
        </div>
      )}
    </div>
  );
}
