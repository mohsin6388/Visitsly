import { memo, useEffect, useRef, useState } from 'react';
import { CheckCheck, Check, Clock3, Download, FileText, MapPin, AlertCircle, Image as ImageIcon, Film, Mic, Loader2 } from 'lucide-react';
import { conversationApi } from '../../api/conversationApi.js';
import { Formatted } from '../../components/WhatsAppPreview.jsx';

// Small in-memory cache so scrolling back up doesn't re-download photos.
const blobCache = new Map();

function useMediaUrl(conversationId, message, { enabled }) {
  const direct = message.media?.url && /^https:\/\//.test(message.media.url) ? message.media.url : null;
  const [url, setUrl] = useState(direct || blobCache.get(message._id) || null);
  const [state, setState] = useState(url ? 'ready' : 'idle');
  useEffect(() => {
    if (!enabled || url || !message.media?.id) return undefined;
    let cancelled = false;
    setState('loading');
    conversationApi
      .mediaBlob(conversationId, message._id)
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        blobCache.set(message._id, objectUrl);
        setUrl(objectUrl);
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => { cancelled = true; };
  }, [enabled, url, conversationId, message._id, message.media?.id]);
  return { url, state };
}

/** Only fetch media once the bubble scrolls into view. */
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [inView]);
  return [ref, inView];
}

async function downloadFile(conversationId, message) {
  try {
    let href = message.media?.url;
    if (!href || !/^https:\/\//.test(href)) {
      const blob = await conversationApi.mediaBlob(conversationId, message._id, { download: true });
      href = URL.createObjectURL(blob);
    }
    const a = document.createElement('a');
    a.href = href;
    a.download = message.media?.filename || `${message.type || 'file'}-${String(message._id).slice(-6)}`;
    a.target = '_blank';
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.alert('File download nahi ho paayi. WhatsApp files ~30 din tak hi available rehti hain.');
  }
}

function MediaBlock({ conversationId, message, onOpenImage }) {
  const [ref, inView] = useInView();
  const isVisual = ['image', 'sticker', 'video', 'audio'].includes(message.type);
  const { url, state } = useMediaUrl(conversationId, message, { enabled: inView && isVisual });
  const caption = message.media?.caption;

  if (message.type === 'image' || message.type === 'sticker') {
    return (
      <div ref={ref} className="mb-1">
        {url ? (
          <button type="button" onClick={() => onOpenImage(url)} className="block overflow-hidden rounded-xl">
            <img src={url} alt={caption || 'Photo'} loading="lazy" className={`${message.type === 'sticker' ? 'h-28 w-28 object-contain' : 'max-h-72 w-full max-w-[280px] object-cover'} rounded-xl bg-black/5`} />
          </button>
        ) : (
          <div className="flex h-40 w-[240px] items-center justify-center rounded-xl bg-black/5 text-xs opacity-70">
            {state === 'error' ? <span className="flex items-center gap-1"><AlertCircle size={14} /> Photo available nahi</span> : <span className="flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> <ImageIcon size={14} /> Photo load ho rahi hai…</span>}
          </div>
        )}
        <button type="button" onClick={() => downloadFile(conversationId, message)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold opacity-75 hover:opacity-100"><Download size={12} /> Download</button>
      </div>
    );
  }
  if (message.type === 'video') {
    return (
      <div ref={ref} className="mb-1">
        {url ? <video src={url} controls preload="metadata" className="max-h-72 w-full max-w-[300px] rounded-xl bg-black" /> : <div className="flex h-36 w-[240px] items-center justify-center rounded-xl bg-black/10 text-xs opacity-70">{state === 'error' ? 'Video available nahi' : <><Film size={14} className="mr-1" /> Video load ho raha hai…</>}</div>}
        <button type="button" onClick={() => downloadFile(conversationId, message)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold opacity-75 hover:opacity-100"><Download size={12} /> Download</button>
      </div>
    );
  }
  if (message.type === 'audio') {
    return (
      <div ref={ref} className="mb-1 min-w-[220px]">
        {url ? <audio src={url} controls preload="metadata" className="w-full" /> : <div className="flex items-center gap-1 text-xs opacity-70"><Mic size={14} /> {state === 'error' ? 'Voice note available nahi' : 'Voice note load ho raha hai…'}</div>}
      </div>
    );
  }
  if (message.type === 'document') {
    const name = message.media?.filename || 'Document';
    const isPdf = /pdf/i.test(message.media?.mimeType || '') || /\.pdf$/i.test(name);
    return (
      <button type="button" onClick={() => downloadFile(conversationId, message)} className="mb-1 flex w-full min-w-[220px] items-center gap-3 rounded-xl bg-black/5 px-3 py-2.5 text-left hover:bg-black/10 dark:bg-white/10">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isPdf ? 'bg-red-500 text-white' : 'bg-sky-500 text-white'}`}><FileText size={18} /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="text-[11px] opacity-70">{isPdf ? 'PDF' : 'File'}{message.media?.size ? ` · ${(message.media.size / 1024 / 1024).toFixed(1)} MB` : ''} · Download karne ke liye dabaiye</span></span>
        <Download size={16} className="shrink-0 opacity-70" />
      </button>
    );
  }
  if (message.type === 'location' && message.media?.latitude != null) {
    const href = `https://www.google.com/maps?q=${message.media.latitude},${message.media.longitude}`;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2.5 text-sm font-semibold hover:bg-black/10">
        <MapPin size={16} /> {message.media.address || 'Location dekhein (Google Maps)'}
      </a>
    );
  }
  return null;
}

function StatusTick({ status }) {
  if (status === 'read') return <CheckCheck size={12} className="text-sky-400" />;
  if (status === 'delivered') return <CheckCheck size={12} />;
  if (status === 'failed') return <AlertCircle size={12} className="text-red-500" />;
  if (status === 'pending') return <Clock3 size={12} />;
  return <Check size={12} />;
}

function MessageBubble({ conversationId, message: m, onOpenImage }) {
  const fromCustomer = m.sender === 'customer';
  const hasMedia = m.media && ['image', 'video', 'audio', 'document', 'sticker', 'location'].includes(m.type);
  // For media, the text is "[Photo] caption" — show only the caption under the media.
  const text = hasMedia ? m.media?.caption || '' : m.text;
  return (
    <div className={`flex ${fromCustomer ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${
          fromCustomer
            ? 'rounded-tl-sm bg-white text-ink-900 dark:bg-ink-800 dark:text-white'
            : m.sender === 'ai'
              ? 'rounded-tr-sm bg-emerald-50 text-ink-900 dark:bg-emerald-900/40 dark:text-emerald-50'
              : 'rounded-tr-sm bg-brand-600 text-white'
        }`}
      >
        {hasMedia && <MediaBlock conversationId={conversationId} message={m} onOpenImage={onOpenImage} />}
        {text && <p className="whitespace-pre-wrap break-words leading-relaxed"><Formatted text={text} /></p>}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
          {m.sender === 'ai' && <span>AI ·</span>}
          {m.sender === 'broker' && <span>Aap ·</span>}
          {new Date(m.timestamp || m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          {!fromCustomer && <StatusTick status={m.status} />}
        </div>
        {m.status === 'failed' && m.errorMessage && <p className="mt-1 text-[11px] text-red-600 dark:text-red-300">Deliver nahi hua: {m.errorMessage}</p>}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
