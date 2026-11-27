import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Send, Bot, UserCog, X, MessageCircleMore, AlertTriangle, Filter, Check, Paperclip,
  ArrowLeft, Info, RefreshCw, FileText, Image as ImageIcon, Loader2, Lock, ChevronDown, MessagesSquare,
} from 'lucide-react';
import { conversationApi } from '../../api/conversationApi.js';
import { propertyApi } from '../../api/propertyApi.js';
import { getSocket } from '../../lib/socket.js';
import { errText } from '../../lib/saas.jsx';
import { useOrgRole, useCan } from '../../store/authStore.js';
import { toast, showDialog, SkeletonRows, EmptyState, Modal, confirmDialog } from '../../components/ui/index.jsx';
import MessageBubble from './MessageBubble.jsx';
import { WindowClosedBar, WindowOpenHint, TemplateSendModal } from '../../components/WhatsAppWindow.jsx';
import AiLimitBar from '../saas/AiLimitBar.jsx';
import AiScriptChip from '../assistant/AiScriptChip.jsx';
import InsightsPanel, { leadTypeOf } from './InsightsPanel.jsx';
import { useWhatsappNumbers, NumberBadge } from '../../lib/whatsappNumbers.jsx';
import { uploadErrorMessage } from '../../lib/uploadError.js';

const FILTERS = [
  { key: '', label: 'All chats' },
  { key: 'unread', label: 'Unread messages' },
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'direct', label: 'Direct WhatsApp' },
  { key: 'hot', label: 'Hot leads 🔥' },
  { key: 'warm', label: 'Warm leads' },
  { key: 'site_visit', label: 'Site visit' },
  { key: 'closed', label: 'Closed leads' },
  { key: 'manual', label: 'AI paused (you reply)' },
  { key: 'lost', label: 'Lost' },
];

const PAGE = 30;

function timeLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dayLabel(value) {
  const d = new Date(value);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function mergeMessages(existing, incoming) {
  const seen = new Set(existing.map((m) => String(m._id)));
  const add = incoming.filter((m) => m && !seen.has(String(m._id)));
  if (!add.length) return existing;
  return [...existing, ...add].sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));
}

/* ------------------------------------------------------------------ */
/* Send brochure / photos of a project in one click                    */
/* ------------------------------------------------------------------ */
function PropertyMediaModal({ open, onClose, conversation, onSent }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => {
      setLoading(true);
      propertyApi.list({ search: query || undefined, limit: 20, page: 1 })
        .then((r) => setItems(r.data?.properties || r.data?.items || []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, query]);
  const recommended = (conversation?.recommendedProperties || []).map((p) => String(p._id || p));
  const sorted = [...items].sort((a, b) => recommended.includes(String(b._id)) - recommended.includes(String(a._id)));
  const send = async (p, kind) => {
    setBusy(`${p._id}:${kind}`);
    try {
      const r = await conversationApi.sendPropertyMedia(conversation._id, p._id, kind);
      toast.success(r.message || 'Sent');
      onSent?.(r.data?.messages || []);
      onClose();
    } catch (err) {
      showDialog({ title: 'Could not send', message: errText(err) });
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Send brochure / photos">
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input autoFocus className="input-field !pl-9" placeholder="Search project name" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {loading ? <SkeletonRows rows={4} /> : !sorted.length ? <p className="py-8 text-center text-sm text-ink-500">No properties found. Add one on the Properties page.</p> : (
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {sorted.map((p) => (
            <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">{p.projectName}{recommended.includes(String(p._id)) && <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">AI pick</span>}</p>
                <p className="text-xs text-ink-500">{[p.bhk && `${p.bhk} BHK`, p.location, p.city].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex gap-1.5">
                <button type="button" disabled={!!busy || !p.brochureUrl} title={p.brochureUrl ? '' : 'No brochure uploaded'} onClick={() => send(p, 'brochure')} className="btn-secondary gap-1 !px-2.5 !py-1.5 text-xs disabled:opacity-40">{busy === `${p._id}:brochure` ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Brochure</button>
                <button type="button" disabled={!!busy || !(p.images || []).length} title={(p.images || []).length ? '' : 'No photos uploaded'} onClick={() => send(p, 'photos')} className="btn-secondary gap-1 !px-2.5 !py-1.5 text-xs disabled:opacity-40">{busy === `${p._id}:photos` ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} Photos</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
export default function ConversationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [templateOpen, setTemplateOpen] = useState(false);
  const role = useOrgRole();
  const canReply = useCan()('chatReply'); // agents need the "reply to chats" permission to send / take over / close

  // List
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState(searchParams.get('filter') || '');
  const [filterOpen, setFilterOpen] = useState(false);
  const { numbers: waNumbers, multi: multiNumbers } = useWhatsappNumbers();
  const [numberFilter, setNumberFilter] = useState('');
  const [counts, setCounts] = useState({});
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Thread
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null); // { conversation, messages, insights, hasMoreMessages }
  const [threadLoading, setThreadLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [upload, setUpload] = useState(null); // { name, progress }
  const [mediaOpen, setMediaOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const activeIdRef = useRef(null);
  const cursorRef = useRef(null);
  const listReqRef = useRef(0);
  const fileRef = useRef(null);
  const filterRef = useRef(null);
  activeIdRef.current = activeId;

  /* ---------------- list ---------------- */
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchCounts = useCallback(() => {
    conversationApi.counts().then((r) => setCounts(r.data.counts || {})).catch(() => {});
  }, []);

  const fetchList = useCallback(async ({ append = false } = {}) => {
    const reqId = ++listReqRef.current;
    if (append) setLoadingMore(true); else { setListLoading(true); setListError(''); }
    try {
      const res = await conversationApi.list({
        limit: PAGE,
        ...(filter ? { filter } : {}),
        ...(numberFilter ? { phoneNumberId: numberFilter } : {}),
        ...(search ? { search } : {}),
        ...(append && cursorRef.current ? { before: cursorRef.current } : {}),
      });
      if (reqId !== listReqRef.current) return; // a newer request replaced this one
      const rows = res.data.conversations || [];
      setConversations((prev) => (append ? [...prev, ...rows.filter((r) => !prev.some((p) => p._id === r._id))] : rows));
      cursorRef.current = res.data.nextCursor || null;
      setHasMore(Boolean(res.data.hasMore));
      if (res.data.counts?.unread != null) setCounts((c) => ({ ...c, unread: res.data.counts.unread }));
    } catch (err) {
      if (reqId === listReqRef.current) {
        setListError(errText(err, 'Could not load chats'));
        if (!append) toast.error(errText(err, 'Could not load chats'));
      }
    } finally {
      if (reqId === listReqRef.current) { setListLoading(false); setLoadingMore(false); }
    }
  }, [filter, search, numberFilter]);

  // Reload from the top whenever filter/search changes.
  useEffect(() => {
    cursorRef.current = null;
    fetchList();
  }, [fetchList]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  useEffect(() => {
    if (!filterOpen) return undefined;
    const close = (e) => { if (!filterRef.current?.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [filterOpen]);

  const onListScroll = (e) => {
    const el = e.currentTarget;
    if (hasMore && !loadingMore && el.scrollTop + el.clientHeight > el.scrollHeight - 200) fetchList({ append: true });
  };

  /* ---------------- thread ---------------- */
  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  const openConversation = useCallback(async (id) => {
    if (!id) return;
    setActiveId(id);
    setShowInfo(false);
    setThreadLoading(true);
    setActive((prev) => (prev?.conversation?._id === id ? prev : null));
    try {
      const res = await conversationApi.get(id, { limit: 40 });
      if (activeIdRef.current !== id) return;
      setActive({ ...res.data, messages: res.data.messages || [] });
      atBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom());
      if (res.data.conversation.unreadCount > 0) {
        conversationApi.markRead(id).catch(() => {});
        setConversations((list) => list.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c)));
        setCounts((c) => ({ ...c, unread: Math.max(0, (c.unread || 1) - 1) }));
      }
    } catch (err) {
      showDialog({ title: 'Could not open chat', message: errText(err), actionLabel: 'Retry', onAction: () => openConversation(id) });
      setActiveId(null);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // On wide screens open the newest chat straight away.
  useEffect(() => {
    if (activeId || !conversations.length || searchParams.get('id') || searchParams.get('lead')) return;
    if (window.matchMedia('(min-width: 1024px)').matches) openConversation(conversations[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // Deep links: ?id=<conversationId> or ?lead=<leadId>
  useEffect(() => {
    const id = searchParams.get('id');
    const leadId = searchParams.get('lead');
    if (!id && !leadId) return;
    (async () => {
      try {
        if (id) await openConversation(id);
        else {
          const res = await conversationApi.list({ leadId, limit: 1 });
          const match = res.data.conversations?.[0];
          if (match) await openConversation(match._id);
          else toast.info('No WhatsApp chat with this lead yet.');
        }
      } finally {
        setSearchParams({}, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOlder = async () => {
    if (!active?.messages?.length || olderLoading) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight || 0;
    setOlderLoading(true);
    try {
      const oldest = active.messages[0];
      const res = await conversationApi.get(active.conversation._id, { before: oldest.timestamp || oldest.createdAt, limit: 40 });
      setActive((p) => (p ? { ...p, messages: [...(res.data.messages || []), ...p.messages], hasMoreMessages: res.data.hasMoreMessages } : p));
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    } catch (err) {
      toast.error(errText(err, 'Could not load older messages'));
    } finally {
      setOlderLoading(false);
    }
  };

  const onThreadScroll = (e) => {
    const el = e.currentTarget;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && active?.hasMoreMessages && !olderLoading) loadOlder();
  };

  useLayoutEffect(() => {
    if (atBottomRef.current) scrollToBottom(true);
  }, [active?.messages?.length]);

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    const socket = getSocket();
    const onNewMessage = (payload) => {
      const { conversationId, message, preview } = payload || {};
      if (!conversationId || !message) return;
      const isOpen = conversationId === activeIdRef.current;
      const inbound = message.direction === 'inbound';

      setConversations((list) => {
        const idx = list.findIndex((c) => c._id === conversationId);
        if (idx === -1) {
          // New chat (or not loaded yet) → refresh the top of the list.
          setTimeout(() => fetchList(), 0);
          return list;
        }
        const row = {
          ...list[idx],
          lastMessageAt: message.timestamp || new Date().toISOString(),
          lastMessagePreview: preview || message.text,
          lastMessageDirection: message.direction,
          lastMessageSender: message.sender,
          ...(inbound ? { lastInboundAt: message.timestamp, windowOpen: true } : {}),
          unreadCount: inbound && !isOpen ? (list[idx].unreadCount || 0) + 1 : isOpen ? 0 : list[idx].unreadCount,
        };
        return [row, ...list.slice(0, idx), ...list.slice(idx + 1)];
      });

      if (isOpen) {
        setActive((prev) => (prev ? {
          ...prev,
          conversation: inbound ? { ...prev.conversation, lastInboundAt: message.timestamp, windowOpen: true } : prev.conversation,
          messages: mergeMessages(prev.messages, [message]),
        } : prev));
        if (inbound) conversationApi.markRead(conversationId).catch(() => {});
      } else if (inbound) {
        setCounts((c) => ({ ...c, unread: (c.unread || 0) + 1 }));
      }
    };
    const onAiLimit = ({ conversationId, limit, replies, reached, planName }) => {
      if (conversationId === activeIdRef.current) {
        setActive((prev) => (prev ? { ...prev, conversation: { ...prev.conversation, aiLimit: { limit, replies, reached, planName } } } : prev));
      }
    };
    const onScored = ({ leadId, score, level }) => {
      setConversations((list) => list.map((c) => (String(c.leadId?._id) === String(leadId) ? { ...c, currentLeadScore: score, leadId: { ...c.leadId, leadScore: score, status: ['site_visit', 'closed', 'lost'].includes(c.leadId?.status) ? c.leadId.status : level } } : c)));
    };
    // Chat language detected / chosen / switched by the customer → keep the side panel current.
    const onUpdated = ({ conversationId, ...changes } = {}) => {
      if (!conversationId || conversationId !== activeIdRef.current) return;
      const keep = ['language', 'languageSource', 'status'].filter((k) => k in changes);
      if (!keep.length) return;
      setActive((prev) => (prev ? { ...prev, conversation: { ...prev.conversation, ...Object.fromEntries(keep.map((k) => [k, changes[k]])) } } : prev));
    };
    const onReconnect = () => { fetchList(); fetchCounts(); if (activeIdRef.current) openConversation(activeIdRef.current); };
    socket.on('conversation:updated', onUpdated);
    socket.on('conversation:newMessage', onNewMessage);
    socket.on('conversation:aiLimit', onAiLimit);
    socket.on('lead:scored', onScored);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('conversation:updated', onUpdated);
      socket.off('conversation:newMessage', onNewMessage);
      socket.off('conversation:aiLimit', onAiLimit);
      socket.off('lead:scored', onScored);
      socket.io.off('reconnect', onReconnect);
    };
  }, [fetchList, fetchCounts, openConversation]);

  /* ---------------- actions ---------------- */
  const sendFailed = (err) => {
    const code = err?.response?.data?.details?.code;
    if (code === 'WHATSAPP_24H_WINDOW_CLOSED') {
      showDialog({
        tone: 'warning',
        title: 'WhatsApp 24-hour window is closed',
        message: 'The customer has not messaged in the last 24 hours, so WhatsApp only allows an approved template.\n\nSend a template — once they reply, you can chat here again.',
        actionLabel: 'Send template',
        onAction: () => setTemplateOpen(true),
      });
    } else {
      showDialog({ title: 'Message not sent', message: errText(err) });
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending || !activeId) return;
    setSending(true);
    try {
      const res = await conversationApi.sendMessage(activeId, body);
      setText('');
      atBottomRef.current = true;
      if (res.data?.message) setActive((p) => (p ? { ...p, messages: mergeMessages(p.messages, [res.data.message]) } : p));
    } catch (err) {
      sendFailed(err);
    } finally {
      setSending(false);
    }
  };

  const handleFile = async (file) => {
    if (!file || !activeId) return;
    if (file.size > 100 * 1024 * 1024) { showDialog({ title: 'File too large', message: 'WhatsApp allows up to 100 MB (photos 5 MB, videos 16 MB).' }); return; }
    const caption = text.trim();
    setUpload({ name: file.name, progress: 0 });
    try {
      const res = await conversationApi.sendMedia(activeId, file, caption, (progress) => setUpload({ name: file.name, progress }));
      if (caption) setText('');
      atBottomRef.current = true;
      if (res.data?.message) setActive((p) => (p ? { ...p, messages: mergeMessages(p.messages, [res.data.message]) } : p));
      toast.success('File sent');
    } catch (err) {
      if (err?.response?.status === 413) showDialog({ title: 'File too large', message: uploadErrorMessage(err) });
      else sendFailed(err);
    } finally {
      setUpload(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Chat language changed from the side panel (only the language fields).
  const updateChatLanguage = ({ language = null, languageSource = null } = {}) => {
    setActive((p) => (p ? { ...p, conversation: { ...p.conversation, language, languageSource } } : p));
  };

  const updateConversation = (conversation) => {
    setActive((p) => (p ? { ...p, conversation: { ...p.conversation, ...conversation, leadId: p.conversation.leadId, aiLimit: p.conversation.aiLimit, windowOpen: p.conversation.windowOpen, recommendedProperties: p.conversation.recommendedProperties } } : p));
    setConversations((list) => list.map((c) => (c._id === conversation._id ? { ...c, status: conversation.status } : c)));
  };

  const toggleAI = async () => {
    try {
      const res = active.conversation.status === 'manual' ? await conversationApi.resumeAI(activeId) : await conversationApi.takeover(activeId);
      updateConversation(res.data.conversation);
      toast.success(res.message || 'Done');
    } catch (err) {
      toast.error(errText(err));
    }
  };

  const handleClose = async () => {
    const closed = active.conversation.status === 'closed';
    if (!closed && !(await confirmDialog({ title: 'Close this chat?', message: 'AI will stop replying to this customer.', confirmLabel: 'Close chat' }))) return;
    try {
      const res = closed ? await conversationApi.reopen(activeId) : await conversationApi.close(activeId);
      updateConversation(res.data.conversation);
      toast.success(res.message || 'Done');
    } catch (err) {
      toast.error(errText(err));
    }
  };

  /* ---------------- render helpers ---------------- */
  const grouped = useMemo(() => {
    const out = [];
    let lastDay = '';
    for (const m of active?.messages || []) {
      const day = new Date(m.timestamp || m.createdAt).toDateString();
      if (day !== lastDay) { out.push({ divider: true, key: `d-${day}`, label: dayLabel(m.timestamp || m.createdAt) }); lastDay = day; }
      out.push(m);
    }
    return out;
  }, [active?.messages]);

  const currentFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const conv = active?.conversation;
  const lead = conv?.leadId || {};
  const windowOpen = conv ? (conv.windowOpen ?? Boolean(conv.lastInboundAt && Date.now() - new Date(conv.lastInboundAt).getTime() < 86400000)) : false;
  const showThreadOnMobile = Boolean(activeId);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[520px] gap-4">
      {/* ---------- Left: list ---------- */}
      <div className={`${showThreadOnMobile ? 'hidden lg:flex' : 'flex'} w-full flex-shrink-0 flex-col overflow-hidden rounded-xl border border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900 lg:w-[300px]`}>
        <div className="space-y-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-lg font-bold text-ink-900 dark:text-white">AI Inbox</h1>
            <button type="button" onClick={() => { cursorRef.current = null; fetchList(); fetchCounts(); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Refresh"><RefreshCw size={15} className={listLoading ? 'animate-spin' : ''} /></button>
          </div>
          <AiScriptChip />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" size={15} />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name, number or message…" className="w-full rounded-lg border border-ink-200 py-2 pl-8 pr-7 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white" />
              {searchInput && <button type="button" onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400" aria-label="Clear search"><X size={14} /></button>}
            </div>
            <div className="relative" ref={filterRef}>
              <button type="button" onClick={() => { setFilterOpen((v) => !v); if (!filterOpen) fetchCounts(); }} className={`flex h-full items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${filter ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800'}`} aria-haspopup="menu" aria-expanded={filterOpen}>
                <Filter size={15} /> Filter{counts.unread > 0 && !filter && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{counts.unread}</span>}
              </button>
              {filterOpen && (
                <div role="menu" className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-xl dark:border-ink-700 dark:bg-ink-900">
                  {FILTERS.map((f) => (
                    <button key={f.key || 'all'} role="menuitemradio" aria-checked={filter === f.key} type="button" onClick={() => { setFilter(f.key); setFilterOpen(false); }} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-800 ${filter === f.key ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-ink-700 dark:text-ink-200'}`}>
                      <span className="flex items-center gap-2">{filter === f.key ? <Check size={14} /> : <span className="w-[14px]" />}{f.label}</span>
                      {counts[f.key || 'all'] != null && <span className="rounded-full bg-ink-100 px-2 text-[11px] font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">{counts[f.key || 'all']}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {multiNumbers && (
            <select value={numberFilter} onChange={(e) => setNumberFilter(e.target.value)} aria-label="Filter by WhatsApp number" className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs dark:border-ink-700 dark:bg-ink-800 dark:text-white">
              <option value="">All numbers</option>
              {waNumbers.map((n) => <option key={n.phoneNumberId} value={n.isMain ? 'main' : n.phoneNumberId}>{n.isMain ? 'Main' : n.label}{n.displayPhoneNumber ? ` · ${n.displayPhoneNumber}` : ''}</option>)}
            </select>
          )}
          {filter && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-500">Filter:</span>
              <button type="button" onClick={() => setFilter('')} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{currentFilter.label} <X size={12} /></button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto" onScroll={onListScroll}>
          {listLoading && !conversations.length ? <SkeletonRows rows={8} /> : listError && !conversations.length ? (
            <EmptyState icon={AlertTriangle} title="Could not load chats" action={<button type="button" className="btn-secondary" onClick={() => fetchList()}>Retry</button>}>{listError}</EmptyState>
          ) : !conversations.length ? (
            <EmptyState icon={MessagesSquare} title={filter || search || numberFilter ? 'No chats match' : 'No chats yet'}>
              {filter || search ? 'Try clearing the filter.' : 'Chats appear here when customers reply on WhatsApp.'}
            </EmptyState>
          ) : conversations.map((c) => {
            const l = c.leadId || {};
            const type = leadTypeOf(l, Number(l.leadScore ?? c.currentLeadScore ?? 0));
            const unread = c.unreadCount > 0;
            return (
              <button key={c._id} type="button" onClick={() => openConversation(c._id)} className={`flex w-full gap-3 border-b border-ink-50 px-3 py-3 text-left transition dark:border-ink-800 ${activeId === c._id ? 'bg-brand-50 dark:bg-ink-800' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50'}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">{(l.name || '?').trim().charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${unread ? 'font-bold text-ink-900 dark:text-white' : 'font-semibold text-ink-800 dark:text-ink-100'}`}>{l.name || l.phone || 'Unknown'}</span>
                    <span className={`shrink-0 text-[11px] ${unread ? 'font-bold text-emerald-600' : 'text-ink-400'}`}>{timeLabel(c.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={`truncate text-xs ${unread ? 'font-semibold text-ink-700 dark:text-ink-200' : 'text-ink-500 dark:text-ink-400'}`}>
                      {c.lastMessageDirection === 'outbound' && <span className="text-ink-400">{c.lastMessageSender === 'ai' ? 'AI: ' : 'You: '}</span>}
                      {c.lastMessagePreview || l.phone}
                    </span>
                    {unread && <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unreadCount}</span>}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${type.className}`}>{type.label}</span>
                    {l.source === 'whatsapp_inbound' && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><MessageCircleMore size={10} /> Direct</span>}
                    {multiNumbers && <NumberBadge numbers={waNumbers} phoneNumberId={c.phoneNumberId} />}
                    {c.status === 'manual' && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">AI paused</span>}
                    {c.optedOut && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">STOP</span>}
                    {c.aiLimit?.reached && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">AI limit</span>}
                  </span>
                </span>
              </button>
            );
          })}
          {loadingMore && <div className="flex justify-center py-3 text-ink-400"><Loader2 size={18} className="animate-spin" /></div>}
          {hasMore && !loadingMore && conversations.length > 0 && <button type="button" onClick={() => fetchList({ append: true })} className="w-full py-3 text-xs font-semibold text-brand-600">Load more</button>}
        </div>
      </div>

      {/* ---------- Middle: thread ---------- */}
      <div className={`${showThreadOnMobile && !showInfo ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-ink-100 bg-[#f4f1ec] dark:border-ink-800 dark:bg-ink-950`}>
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center p-6"><EmptyState icon={MessagesSquare} title="Select a chat">Pick a chat from the list.</EmptyState></div>
        ) : threadLoading && !active ? (
          <div className="flex-1 bg-white dark:bg-ink-900"><SkeletonRows rows={7} /></div>
        ) : active && (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-white px-3 py-2.5 dark:border-ink-800 dark:bg-ink-900">
              <div className="flex min-w-0 items-center gap-2">
                <button type="button" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden" onClick={() => setActiveId(null)} aria-label="Back to chats"><ArrowLeft size={18} /></button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">{(lead.name || '?').charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900 dark:text-white">{lead.name || lead.phone}</p>
                  {multiNumbers && <p className="mb-0.5"><NumberBadge numbers={waNumbers} phoneNumberId={conv.phoneNumberId} /></p>}
                  <p className="truncate text-xs text-ink-500 dark:text-ink-400">{lead.phone} · {conv.status === 'manual' ? 'You are replying' : conv.status === 'closed' ? 'Chat closed' : conv.optedOut ? 'Opted out (STOP)' : 'AI is replying'}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {canReply && <button type="button" onClick={toggleAI} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${conv.status === 'manual' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-ink-200 text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200'}`} title={conv.status === 'manual' ? 'Turn AI back on' : 'Pause AI and reply yourself'}>
                  {conv.status === 'manual' ? <Bot size={14} /> : <UserCog size={14} />}
                  <span className="hidden sm:inline">{conv.status === 'manual' ? 'Resume AI' : 'Take over'}</span>
                </button>}
                <button type="button" onClick={() => setShowInfo(true)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 xl:hidden dark:hover:bg-ink-800" aria-label="Lead details"><Info size={16} /></button>
                {canReply && <button type="button" onClick={handleClose} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800" title={conv.status === 'closed' ? 'Reopen chat' : 'Close chat'}>{conv.status === 'closed' ? 'Reopen' : <X size={16} />}</button>}
              </div>
            </div>

            <div ref={scrollRef} onScroll={onThreadScroll} className="flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5">
              {active.hasMoreMessages && (
                <div className="flex justify-center">
                  <button type="button" onClick={loadOlder} disabled={olderLoading} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-600 shadow-sm dark:bg-ink-800 dark:text-ink-200">{olderLoading ? <Loader2 size={13} className="inline animate-spin" /> : 'Load older messages'}</button>
                </div>
              )}
              {!active.messages.length && <p className="py-10 text-center text-sm text-ink-500">No messages yet.</p>}
              {grouped.map((item) => (item.divider ? (
                <div key={item.key} className="flex justify-center py-1"><span className="rounded-full bg-white/80 px-3 py-0.5 text-[11px] font-semibold text-ink-500 shadow-sm dark:bg-ink-800 dark:text-ink-300">{item.label}</span></div>
              ) : (
                <MessageBubble key={item._id} conversationId={conv._id} message={item} onOpenImage={setLightbox} />
              )))}
            </div>

            <AiLimitBar aiLimit={conv.aiLimit} />

            {conv.aiSkipReason && !conv.aiLimit?.reached && conv.status !== 'manual' && conv.status !== 'closed' && !conv.optedOut && (
              <div role="status" className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span><b>AI skipped the last reply:</b> {conv.aiSkipReason}</span>
              </div>
            )}
            {!canReply ? (
              <div className="border-t border-ink-100 bg-white px-4 py-3 text-center text-xs text-ink-500 dark:border-ink-800 dark:bg-ink-900">View only — you don’t have permission to reply to chats.</div>
            ) : !windowOpen ? (
              <WindowClosedBar neverReplied={!conv.lastInboundAt} onTemplate={() => setTemplateOpen(true)} className="bg-white dark:bg-ink-900" />
            ) : (
              <form onSubmit={handleSend} className="border-t border-ink-100 bg-white p-2.5 dark:border-ink-800 dark:bg-ink-900">
                <WindowOpenHint lastInboundAt={conv.lastInboundAt} />
                {upload && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                    <Loader2 size={14} className="animate-spin" /> <span className="truncate">{upload.name}</span>
                    <span className="ml-auto font-semibold">{upload.progress}%</span>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={fileRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4,video/3gpp,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(e) => handleFile(e.target.files?.[0])} />
                  <button type="button" disabled={!!upload} onClick={() => fileRef.current?.click()} className="rounded-lg p-2.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800" title="Send photo, video or PDF" aria-label="Attach file"><Paperclip size={18} /></button>
                  <button type="button" disabled={!!upload} onClick={() => setMediaOpen(true)} className="hidden rounded-lg px-2.5 py-2.5 text-xs font-semibold text-ink-600 hover:bg-ink-100 sm:block dark:text-ink-300 dark:hover:bg-ink-800" title="Property brochure / photos">
                    <FileText size={16} className="inline" /> Brochure <ChevronDown size={12} className="inline" />
                  </button>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={1}
                    placeholder={conv.status === 'manual' ? 'Type a message…' : 'Type a message (AI is on)…'}
                    className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-ink-200 px-3 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                  />
                  <button type="submit" disabled={sending || !text.trim()} className="btn-primary flex h-[42px] w-[42px] items-center justify-center !p-0 disabled:opacity-50" aria-label="Send">
                    {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* ---------- Right: lead insights ---------- */}
      {active && activeId && (
        <>
          <InsightsPanel active={active} className="hidden xl:flex" onConversationChange={updateChatLanguage} />
          {showInfo && (
            <div className="fixed inset-0 z-40 flex justify-end bg-black/40 xl:hidden" onMouseDown={(e) => e.target === e.currentTarget && setShowInfo(false)}>
              <div className="h-full w-full max-w-sm overflow-y-auto bg-ink-50 p-3 dark:bg-ink-950">
                <button type="button" onClick={() => setShowInfo(false)} className="mb-2 flex items-center gap-1 text-sm font-semibold text-ink-600"><ArrowLeft size={16} /> Back to chat</button>
                <InsightsPanel active={active} onConversationChange={updateChatLanguage} />
              </div>
            </div>
          )}
        </>
      )}

      {templateOpen && conv && <TemplateSendModal leadId={lead._id || conv.leadId} leadName={lead.name} onClose={() => setTemplateOpen(false)} onSent={() => setTimeout(() => setTemplateOpen(false), 900)} />}

      <PropertyMediaModal open={mediaOpen} onClose={() => setMediaOpen(false)} conversation={conv} onSent={(msgs) => setActive((p) => (p ? { ...p, messages: mergeMessages(p.messages, msgs) } : p))} />

      {lightbox && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white" aria-label="Close"><X size={20} /></button>
        </div>
      )}
    </div>
  );
}
