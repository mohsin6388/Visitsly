import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, PhoneCall, Search, Trash2, X, CheckCircle2, PhoneOff, PhoneIncoming, FileText, ListChecks, History, Save, CalendarCheck, Clock3, Users,
} from 'lucide-react';
import { voiceApi } from '../../api/saasApi.js';
import { toast, Skeleton, confirmDialog, ErrorInfo } from '../../components/ui/index.jsx';
import { errText, showUpgrade } from '../../lib/saas.jsx';
import { getSocket } from '../../lib/socket.js';

const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

const QUEUE_CHIP = {
  queued: ['Queued', 'bg-amber-50 text-amber-700 ring-amber-200'],
  calling: ['Calling now', 'bg-sky-50 text-sky-700 ring-sky-200'],
  done: ['Called', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  missed: ['Missed', 'bg-red-50 text-red-700 ring-red-200'],
  failed: ['Failed', 'bg-red-50 text-red-700 ring-red-200'],
};
const LEAD_RESULT = {
  visit_booked: ['Site visit booked', 'text-emerald-700', CalendarCheck],
  follow_up: ['Follow-up added', 'text-sky-700', Clock3],
  callback_later: ['Busy — call back', 'text-amber-700', Clock3],
  not_interested: ['Not interested', 'text-red-600', X],
  declined: ['Declined', 'text-red-600', X],
  unclear: ['Unclear', 'text-ink-500', null],
};

const RATING_CHIP = {
  hot: ['Hot', 'bg-red-50 text-red-700 ring-red-200'],
  warm: ['Warm', 'bg-amber-50 text-amber-700 ring-amber-200'],
  cold: ['Cold', 'bg-sky-50 text-sky-700 ring-sky-200'],
  not_interested: ['Not interested', 'bg-ink-100 text-ink-600 ring-ink-200'],
};

const DEFAULT_SCRIPT_HINT = `Leave empty to use the default script. The AI will:
1. Greet the customer by name and ask if they prefer Hindi or English.
2. Ask what they are looking for (buy or rent, flat / villa / plot, BHK).
3. Ask which city and area they are looking in.
4. Tell them about the matching properties from your Properties list.
5. Check how interested they are and rate the lead Hot / Warm / Cold.
6. If interested, fix a site visit day and time (it appears in Site visits).

Or write your own script, for example:
1. Introduce yourself from {company}.
2. Ask if they are still looking for a 2 or 3 BHK in {city}.
3. Mention our new project Omega (₹85 lakh onwards, ready to move).
4. Invite them for a site visit this weekend and take a day and time.`;

// Contacts per calling batch (same limit as the server).
const MAX_BATCH = 100;

/** "To call": contacts from Upload Data → select → add to the calling queue. */
function ToCall({ planAllows, onQueued, minutesFinished = false, paused = false }) {
  const [state, setState] = useState('to_call');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    voiceApi.leads({ state, search: q, page, limit: 50 }).then((r) => setData(r.data)).catch((e) => { setData({ items: [], total: 0, pages: 1 }); toast.error(errText(e)); });
  }, [state, q, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    const socket = getSocket();
    const onCall = () => load();
    socket.on('call:updated', onCall);
    const t = state === 'queued' ? setInterval(load, 15000) : null;
    return () => { socket.off('call:updated', onCall); if (t) clearInterval(t); };
  }, [load, state]);

  const items = data?.items || [];
  const ids = Object.keys(selected).filter((k) => selected[k]);
  const allOnPage = items.length > 0 && items.every((l) => selected[l._id]);

  const queue = async () => {
    if (!planAllows) { showUpgrade('AI calling is available on Growth and above. Upgrade to call your contacts with AI.'); return; }
    if (!ids.length) return;
    if (ids.length > MAX_BATCH) { toast.error(`You can call up to ${MAX_BATCH} contacts in one batch. ${ids.length} are selected — unselect ${ids.length - MAX_BATCH}.`); return; }
    if (!(await confirmDialog({ title: `Call ${ids.length} contact${ids.length === 1 ? '' : 's'} with AI?`, message: 'They are called one by one during your calling hours. Each answered minute counts toward your plan’s calling minutes.', confirmLabel: 'Start calling' }))) return;
    setBusy(true);
    try {
      const r = await voiceApi.queue(ids);
      toast.success(r.message);
      setSelected({});
      onQueued?.();
      load();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const cancel = async (leadIds) => {
    setBusy(true);
    try { const r = await voiceApi.cancelQueue(leadIds); toast.success(r.message); setSelected({}); load(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-3 dark:border-ink-800">
        <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-ink-700">
          {[['to_call', 'Not called yet'], ['queued', 'In queue'], ['all', 'All contacts']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setState(k); setPage(1); setSelected({}); }} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${state === k ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{l}</button>
          ))}
        </div>
        <div className="relative min-w-[160px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number" className="input-field !py-1.5 !pl-8 text-sm" />
        </div>
        {state === 'queued' ? (
          <button type="button" disabled={busy || !items.length} onClick={() => cancel(ids.length ? ids : undefined)} className="btn-secondary gap-1.5 !py-1.5 text-xs"><X size={13} /> {ids.length ? `Remove ${ids.length}` : 'Clear queue'}</button>
        ) : (
          <button type="button" disabled={busy || !ids.length || minutesFinished || paused} title={minutesFinished ? 'AI calling minutes finished. Recharge to continue.' : paused ? 'AI calling is switched off' : undefined} onClick={queue} className="btn-primary gap-1.5 !py-1.5 text-xs">{busy ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />} Call {ids.length || ''} selected{ids.length > MAX_BATCH ? ` (max ${MAX_BATCH})` : ''}</button>
        )}
      </div>
      {(minutesFinished || paused) && <p className="border-b border-ink-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 dark:border-ink-800 dark:bg-red-950/30 dark:text-red-300">{minutesFinished ? 'AI calling minutes finished. Recharge to continue.' : 'AI calling is switched off. Turn it on above to call.'}</p>}
      <div className="max-h-[440px] overflow-y-auto">
        {data === null ? <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div> : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-400">
            {state === 'queued' ? 'Nobody is waiting to be called.' : <>No contacts here. <Link to="/leads" className="font-semibold text-brand-600 hover:underline">Upload data</Link></>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-50 text-left text-[11px] uppercase tracking-wide text-ink-500 dark:bg-ink-800">
              <tr>
                <th className="w-10 px-4 py-2"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={(e) => setSelected((s) => ({ ...s, ...Object.fromEntries(items.map((l) => [l._id, e.target.checked])) }))} /></th>
                <th className="px-2 py-2">Contact</th>
                <th className="hidden px-2 py-2 sm:table-cell">Added</th>
                <th className="px-4 py-2 text-right">AI call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {items.map((l) => {
                const chip = QUEUE_CHIP[l.aiCall?.status];
                return (
                  <tr key={l._id} className={selected[l._id] ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}>
                    <td className="px-4 py-2"><input type="checkbox" aria-label={`Select ${l.name}`} checked={Boolean(selected[l._id])} onChange={(e) => setSelected((s) => ({ ...s, [l._id]: e.target.checked }))} /></td>
                    <td className="min-w-0 px-2 py-2"><p className="truncate font-medium text-ink-900 dark:text-white">{l.name || 'Contact'}</p><p className="text-[11px] text-ink-400">{l.phone}</p></td>
                    <td className="hidden px-2 py-2 text-xs text-ink-500 sm:table-cell">{when(l.createdAt)}</td>
                    <td className="px-4 py-2 text-right">
                      {chip ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${chip[1]}`}>{l.aiCall.status === 'calling' && <Loader2 size={10} className="animate-spin" />}{chip[0]}</span> : <span className="text-[11px] text-ink-400">Not called</span>}
                      {l.aiCall?.error && ['failed', 'missed'].includes(l.aiCall.status) && <span className="ml-1"><ErrorInfo message={l.aiCall.error} title="Why the call didn’t go through" /></span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between border-t border-ink-100 px-4 py-2 text-xs text-ink-500 dark:border-ink-800">
          <span>{data.total.toLocaleString('en-IN')} contacts · page {data.page} / {data.pages}</span>
          <div className="flex gap-1.5"><button type="button" className="btn-secondary !px-2 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button type="button" className="btn-secondary !px-2 !py-1 text-xs" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button></div>
        </div>
      )}
    </div>
  );
}

/** "Called": history of AI lead calls, what came out of each, with delete. */
function Called({ days, onOpen }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => voiceApi.history({ section: 'leads', days }).then((r) => setData(r.data)).catch(() => setData({ items: [], summary: {} })), [days]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const s = getSocket(); s.on('call:updated', load); return () => s.off('call:updated', load); }, [load]);
  const remove = async (c) => {
    if (!(await confirmDialog({ title: 'Delete this call?', message: 'It is removed from the call history. Visits and follow-ups it created stay.', confirmLabel: 'Delete', danger: true }))) return;
    try { await voiceApi.deleteCall(c.id); setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== c.id) })); } catch (e) { toast.error(errText(e)); }
  };
  const clear = async () => {
    if (!(await confirmDialog({ title: 'Clear lead call history?', message: 'All finished lead calls are removed from this list.', confirmLabel: 'Clear history', danger: true }))) return;
    try { const r = await voiceApi.clearHistory('leads'); toast.success(r.message); load(); } catch (e) { toast.error(errText(e)); }
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3 text-xs text-ink-500 dark:border-ink-800">
        <span>{data?.summary ? `${data.summary.total || 0} calls · ${data.summary.answered || 0} answered · ${data.summary.missed || 0} missed` : '…'}</span>
        {data?.items?.length > 0 && <button type="button" onClick={clear} className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline"><Trash2 size={12} /> Clear history</button>}
      </div>
      <ul className="max-h-[440px] divide-y divide-ink-100 overflow-y-auto dark:divide-ink-800">
        {data === null ? [1, 2, 3].map((i) => <li key={i} className="px-4 py-3"><Skeleton className="h-9" /></li>) : data.items.map((c) => {
          const r = c.leadResult ? LEAD_RESULT[c.leadResult] : null; const RIcon = r?.[2];
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-900 dark:text-white">{c.lead.name} <span className="font-normal text-ink-400">{c.lead.phone}</span></p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700"><CheckCircle2 size={10} />Call gayi hai</span>
                  <span className="text-ink-400">{when(c.at)}</span>
                  {c.status === 'answered' ? <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 font-semibold text-sky-700"><PhoneIncoming size={10} />Answered · {dur(c.durationSec)}</span>
                    : c.status === 'missed' ? <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 font-semibold text-red-700"><PhoneOff size={10} />Missed</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-1.5 py-0.5 font-semibold text-ink-600"><Loader2 size={10} className="animate-spin" />In progress</span>}
                  {r && <span className={`inline-flex items-center gap-1 font-semibold ${r[1]}`}>{RIcon && <RIcon size={11} />}{r[0]}</span>}
                  {c.rating && RATING_CHIP[c.rating] && <span className={`rounded-full px-1.5 py-0.5 font-semibold ring-1 ring-inset ${RATING_CHIP[c.rating][1]}`}>{RATING_CHIP[c.rating][0]}</span>}
                  <ErrorInfo message={c.error} title="Call error" />
                  {c.whatsappNote && <ErrorInfo message={c.whatsappNote} title="WhatsApp after the call was not sent" />}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {(c.summary || c.transcript?.length > 1) && <button type="button" onClick={() => onOpen(c)} title="View call" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-700 dark:hover:bg-ink-800"><FileText size={15} /></button>}
                {c.status !== 'in_progress' && <button type="button" onClick={() => remove(c)} title="Delete from history" className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={15} /></button>}
              </div>
            </li>
          );
        })}
        {data && data.items.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-400">No lead calls yet</li>}
      </ul>
    </div>
  );
}

/** Calling script for lead calls (optional). */
function ScriptCard({ voice, onSaved }) {
  const [text, setText] = useState(voice?.script || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(voice?.script || ''); }, [voice?.script]);
  const save = async () => {
    if (voice?.planAllows === false) { showUpgrade('AI calling is available on Growth and above.'); return; }
    setBusy(true);
    try { await voiceApi.update({ script: text }); toast.success(text.trim() ? 'Calling script saved' : 'Using the default script'); onSaved?.(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <section className="card space-y-2 !p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white"><FileText size={15} className="text-brand-600" /> Calling script <span className="text-xs font-normal text-ink-400">(optional)</span></h3>
        <span className="text-[11px] text-ink-400">{text.trim() ? 'Your script' : 'Default script in use'}</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={5} className="input-field resize-y text-sm" placeholder={DEFAULT_SCRIPT_HINT} aria-label="Calling script" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-ink-400">The AI follows these steps in natural words, in the customer’s language. Visits it books show in Site visits; call-backs go to Follow-ups.</p>
        <div className="flex gap-2">
          {text && <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setText('')}>Use default</button>}
          <button type="button" className="btn-primary gap-1.5 !py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save script</button>
        </div>
      </div>
    </section>
  );
}

/** AI calling → Leads: "To call" and "Called" boxes, plus the calling script. */
export default function LeadCallingPanel({ voice, days, onOpen, onChanged }) {
  const [box, setBox] = useState(null); // nothing is listed until a box is clicked
  const queued = (voice?.queue?.queued || 0) + (voice?.queue?.calling || 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['to_call', 'New leads — not called yet', 'Pick contacts from Upload Data and start calling', ListChecks, queued ? `${queued} in queue` : null],
          ['called', 'Already called', 'Who was called, with call history and summary', History, null],
        ].map(([k, title, sub, Icon, badge]) => (
          <button key={k} type="button" onClick={() => setBox((b) => (b === k ? null : k))} aria-pressed={box === k} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${box === k ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/15 dark:bg-brand-950/30' : 'border-ink-100 bg-white hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900'}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${box === k ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}><Icon size={18} /></span>
            <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white">{title}{badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{badge}</span>}</span><span className="mt-0.5 block text-xs text-ink-500">{sub}</span></span>
          </button>
        ))}
      </div>
      {box && <section className="card min-w-0 !p-0">
        {box === 'to_call' ? <ToCall planAllows={voice?.planAllows !== false} onQueued={onChanged} minutesFinished={Boolean(voice?.minutesFinished)} paused={Boolean(voice?.paused)} /> : <Called days={days} onOpen={onOpen} />}
      </section>}
      {box === 'to_call' && <ScriptCard voice={voice} onSaved={onChanged} />}
      {box === 'to_call' && <p className="flex items-center gap-1.5 text-[11px] text-ink-400"><Users size={12} /> Opted-out contacts (STOP) and contacts without a number are never called.</p>}
      {box === 'called' && <p className="flex items-center gap-1.5 text-[11px] text-ink-400"><CheckCircle2 size={12} /> Booked visits appear in <Link to="/site-visits" className="font-semibold text-brand-600 hover:underline">Site visits</Link>; call-backs in <Link to="/follow-ups" className="font-semibold text-brand-600 hover:underline">Follow-ups</Link>.</p>}
    </div>
  );
}
