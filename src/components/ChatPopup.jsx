import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Send, Loader2, CheckCheck, Bot, UserRound } from 'lucide-react';
import { conversationApi } from '../api/conversationApi.js';
import { getSocket } from '../lib/socket.js';
import MessageBubble from '../features/conversations/MessageBubble.jsx';

/**
 * Lead ki chat usi page par popup me kholta hai (AI inbox par redirect nahi).
 * leadId ya conversationId do. Messages padh sakte ho aur khud reply bhi kar sakte ho.
 */
export default function ChatPopup({ leadId, conversationId, name, onClose }) {
  const [active, setActive] = useState(null); // { conversation, messages }
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    setError('');
    try {
      let id = conversationId;
      if (!id) {
        const res = await conversationApi.list({ leadId, limit: 1 });
        id = res.data.conversations?.[0]?._id;
      }
      if (!id) { setError('Is lead ki abhi koi chat nahi hai.'); return; }
      const res = await conversationApi.get(id);
      setActive(res.data);
      if (res.data.conversation.unreadCount > 0) conversationApi.markRead(id).catch(() => {});
    } catch (e) {
      setError(e?.response?.data?.message || 'Chat load nahi ho payi');
    }
  }, [leadId, conversationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages]);

  // Naye messages turant dikhao
  useEffect(() => {
    const id = active?.conversation?._id;
    if (!id) return undefined;
    const socket = getSocket();
    const onNew = ({ conversationId: cid, message }) => {
      if (cid === id) setActive((p) => (p && !p.messages.some((m) => m._id === message._id) ? { ...p, messages: [...p.messages, message] } : p));
    };
    socket.on('conversation:newMessage', onNew);
    return () => socket.off('conversation:newMessage', onNew);
  }, [active?.conversation?._id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !active) return;
    setSending(true);
    setError('');
    try {
      const res = await conversationApi.sendMessage(active.conversation._id, body);
      setText('');
      const sent = res?.data?.message;
      if (sent) setActive((p) => (p && !p.messages.some((m) => m._id === sent._id) ? { ...p, messages: [...p.messages, sent] } : p));
    } catch (err) {
      setError(err?.response?.data?.message || 'Message nahi ja paya');
    } finally {
      setSending(false);
    }
  };

  const manual = active?.conversation?.status === 'manual';
  const toggleAI = async () => {
    const id = active.conversation._id;
    try {
      const res = await (manual ? conversationApi.resumeAI(id) : conversationApi.takeover(id));
      setActive((p) => ({ ...p, conversation: { ...res.data.conversation, aiLimit: p.conversation?.aiLimit } }));
    } catch (err) {
      setError(err?.response?.data?.message || 'Ho nahi paya');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-[min(80vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900" role="dialog" aria-label="Chat">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-ink-800">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900 dark:text-white">{name || active?.conversation?.leadId?.name || 'Chat'}</p>
            {active && <p className="text-xs text-ink-500">{manual ? 'Aap khud reply kar rahe hain' : 'AI reply kar raha hai'}</p>}
          </div>
          <div className="flex items-center gap-2">
            {active && (
              <button type="button" onClick={toggleAI} className="btn-secondary flex items-center gap-1.5 !px-2.5 !py-1.5 text-xs">
                {manual ? <><Bot size={13} /> AI chalu karein</> : <><UserRound size={13} /> Main sambhalta hoon</>}
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Band karein"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-ink-50/60 p-4 dark:bg-ink-950/30">
          {!active && !error && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ink-400" /></div>}
          {!active && error && <p className="py-10 text-center text-sm text-ink-500">{error}</p>}
          {active?.messages.map((m) => <MessageBubble key={m._id} conversationId={active.conversation._id} message={m} onOpenImage={(url) => window.open(url, '_blank', 'noopener')} />)}
          <div ref={bottomRef} />
        </div>

        {active && (
          <form onSubmit={send} className="border-t border-ink-100 p-3 dark:border-ink-800">
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message likhein…" className="input-field flex-1" />
              <button type="submit" disabled={sending || !text.trim()} className="btn-primary flex items-center gap-1.5">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
