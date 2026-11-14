import { useEffect, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, SkipForward, Pencil, Save, X, Phone, Trash2, Send, MessageSquare, Settings2, Loader2, AlertTriangle } from 'lucide-react';
import { followUpApi } from '../../api/followUpApi.js';
import ChatPopup from '../../components/ChatPopup.jsx';
import FollowUpSetup from './FollowUpSetup.jsx';
import { Notice, errText } from '../../lib/saas.jsx';

const TABS = [['today', 'Aaj / baaki'], ['upcoming', 'Aane wale'], ['history', 'Ho chuke']];
const TEMP = {
  hot: ['Hot', 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'],
  warm: ['Warm', 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'],
  cold: ['Cold', 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'],
};
const HISTORY_LABEL = { sent: 'Bheja gaya', done: 'Ho gaya', skipped: 'Chhoda' };

const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
const fmt = (v) => new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const toLocalInput = (v) => { const d = new Date(v); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export default function FollowUpsPage() {
  const [tab, setTab] = useState('today');
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [chat, setChat] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, d, k] = await Promise.all(['pending', 'sent', 'done', 'skipped'].map((status) => followUpApi.list({ status, limit: 100 })));
      setPending(p.data.followUps);
      setHistory([...s.data.followUps, ...d.data.followUps, ...k.data.followUps].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 100));
    } catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const lists = useMemo(() => {
    const end = endOfToday().getTime();
    return {
      today: pending.filter((f) => new Date(f.nextFollowUpDate).getTime() <= end),
      upcoming: pending.filter((f) => new Date(f.nextFollowUpDate).getTime() > end),
      history,
    };
  }, [pending, history]);
  const items = lists[tab];

  const act = async (id, fn, okText) => {
    setBusy(id); setMsg(null);
    try { const r = await fn(); setMsg({ ok: true, text: okText || r?.message || 'Ho gaya' }); } catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setBusy(''); load(); }
  };
  const sendNow = (f) => {
    if (!window.confirm(`${f.leadId?.name || 'Lead'} ko abhi WhatsApp par bhejein?`)) return;
    act(f._id, () => followUpApi.send(f._id), 'Follow-up bhej diya');
  };
  const remove = (id) => { if (window.confirm('Ye follow-up hata dein?')) act(id, () => followUpApi.remove(id), 'Hata diya'); };
  const startEdit = (f) => { setEditingId(f._id); setEditDate(toLocalInput(f.nextFollowUpDate)); setEditMessage(f.nextFollowUpMessage); };
  const saveEdit = (id) => act(id, async () => { await followUpApi.update(id, { nextFollowUpDate: new Date(editDate).toISOString(), nextFollowUpMessage: editMessage }); setEditingId(null); }, 'Save ho gaya');

  const overdue = (f) => new Date(f.nextFollowUpDate).getTime() < Date.now() - 60 * 60 * 1000;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Follow-ups</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Kis lead ko kab message karna hai, yahan dikhega.</p>
        </div>
        <button type="button" onClick={() => setSetupOpen((v) => !v)} className={`flex items-center gap-2 ${setupOpen ? 'btn-primary' : 'btn-secondary'}`}><Settings2 size={15} /> Follow-up setup</button>
      </div>

      {setupOpen && <FollowUpSetup onSaved={() => { load(); }} />}
      <Notice msg={msg} />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === k ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>
            {l}{k !== 'history' && <span className="ml-1.5 opacity-80">{lists[k].length}</span>}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-ink-50 p-0 dark:divide-ink-800">
        {loading && !items.length && <p className="flex items-center gap-2 p-5 text-sm text-ink-400"><Loader2 size={15} className="animate-spin" /> Load ho raha hai…</p>}
        {!loading && !items.length && <p className="p-8 text-center text-sm text-ink-400">{tab === 'today' ? 'Aaj kisi ko follow-up nahi karna. 👍' : tab === 'upcoming' ? 'Aage koi follow-up nahi hai.' : 'Abhi tak kuch nahi hua.'}</p>}

        {items.map((f) => {
          const temp = TEMP[f.leadTemperature || 'warm'];
          const isPending = f.status === 'pending';
          const editing = editingId === f._id;
          return (
            <div key={f._id} className="space-y-2.5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-900 dark:text-white">{f.leadId?.name || 'Lead'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${temp[1]}`}>{temp[0]}</span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">{f.kind === 'sequence' ? `Reply nahi aaya, follow-up ${f.step || 1}` : 'AI suggestion'}</span>
                    {!isPending && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">{HISTORY_LABEL[f.status]}</span>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ink-500">
                    {f.leadId?.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {f.leadId.phone}</span>}
                    <span className={isPending && overdue(f) ? 'font-semibold text-red-600' : ''}>{isPending ? (overdue(f) ? 'Der ho gayi: ' : 'Time: ') : 'Time: '}{fmt(f.status === 'sent' && f.sentAt ? f.sentAt : f.nextFollowUpDate)}</span>
                  </p>
                </div>
                {isPending && !editing && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button disabled={busy === f._id} onClick={() => sendNow(f)} className="btn-primary flex items-center gap-1.5 !px-3 !py-1.5 text-xs">{busy === f._id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Abhi bhejo</button>
                    <button onClick={() => setChat(f)} className="btn-secondary flex items-center gap-1.5 !px-2.5 !py-1.5 text-xs"><MessageSquare size={13} /> Chat</button>
                    <button onClick={() => startEdit(f)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" title="Edit"><Pencil size={15} /></button>
                    <button onClick={() => act(f._id, () => followUpApi.update(f._id, { status: 'done' }), 'Done mark kiya')} className="rounded-lg p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" title="Maine kar diya"><CheckCircle2 size={15} /></button>
                    <button onClick={() => act(f._id, () => followUpApi.update(f._id, { status: 'skipped' }), 'Chhod diya')} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" title="Chhodo"><SkipForward size={15} /></button>
                    <button onClick={() => remove(f._id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Hatao"><Trash2 size={15} /></button>
                  </div>
                )}
                {!isPending && <button onClick={() => setChat(f)} className="btn-secondary flex items-center gap-1.5 !px-2.5 !py-1.5 text-xs"><MessageSquare size={13} /> Chat</button>}
              </div>

              {isPending && f.conversation?.aiSummary && <p className="rounded-lg bg-brand-50/70 p-2.5 text-xs leading-5 text-ink-700 dark:bg-brand-950/20 dark:text-ink-200"><span className="font-semibold">Ab tak: </span>{f.conversation.aiSummary}</p>}

              {editing ? (
                <div className="space-y-2">
                  <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="rounded-lg border border-ink-200 px-2 py-1 text-xs dark:border-ink-700 dark:bg-ink-800 dark:text-white" />
                  <textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={3} className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(f._id)} className="btn-primary flex items-center gap-1 px-3 py-1 text-xs"><Save size={12} /> Save</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary flex items-center gap-1 px-3 py-1 text-xs"><X size={12} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-ink-50 p-2.5 text-sm text-ink-700 dark:bg-ink-800/50 dark:text-ink-300">{f.nextFollowUpMessage}</p>
              )}

              {isPending && f.lastError && <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Apne aap nahi ja paya: {f.lastError}</p>}
            </div>
          );
        })}
      </div>

      {chat && <ChatPopup leadId={chat.leadId?._id} conversationId={chat.conversation?._id} name={chat.leadId?.name} onClose={() => setChat(null)} />}
    </div>
  );
}
