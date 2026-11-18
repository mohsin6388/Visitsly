import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { create } from 'zustand';
import { explainSendError } from '../../lib/sendErrors.js';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, Loader2, Trash2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Toasts + error popups (one global store, mounted once in the layout) */
/* ------------------------------------------------------------------ */
let seq = 0;
export const useToastStore = create((set) => ({
  toasts: [],
  dialog: null, // { tone, title, message, actionLabel, onAction, links: [{ label, href, external }] }
  confirm: null, // { title, message, confirmLabel, cancelLabel, danger, resolve }
  push: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, ...t }] }));
    if (t.duration !== 0) setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.duration || 4500);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  openConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
}));

export const toast = {
  success: (message, opts = {}) => useToastStore.getState().push({ tone: 'success', message, ...opts }),
  error: (message, opts = {}) => useToastStore.getState().push({ tone: 'error', message, duration: 7000, ...opts }),
  info: (message, opts = {}) => useToastStore.getState().push({ tone: 'info', message, ...opts }),
};

/** Blocking popup for errors the user must read (e.g. WhatsApp 24h window, payment failed). */
export function showDialog({ tone = 'error', title, message, actionLabel, onAction, links = [] }) {
  useToastStore.getState().openDialog({ tone, title, message, actionLabel, onAction, links });
}

/** Popup for a failed WhatsApp send: plain-language reason + links that fix it. */
export function showSendError(message, code) {
  const e = explainSendError(message, code);
  showDialog({ tone: 'error', title: e.title, message: e.message, links: e.links });
}

/**
 * Replacement for window.confirm(). Usage: `if (!(await confirmDialog({ title, message }))) return;`
 * Set danger: true for delete-type actions (red button).
 */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Yes, continue', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const prev = useToastStore.getState().confirm;
    prev?.resolve(false);
    useToastStore.getState().openConfirm({ title, message, confirmLabel, cancelLabel, danger, resolve });
  });
}
/** Shortcut for delete confirmations. */
export const confirmDelete = (what, message = 'This cannot be undone.') => confirmDialog({ title: `Delete ${what}?`, message, confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });

const TONE = {
  success: ['border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100', CheckCircle2],
  error: ['border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/80 dark:text-red-100', XCircle],
  info: ['border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/80 dark:text-sky-100', Info],
  warning: ['border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-100', AlertTriangle],
};

export function Toaster() {
  const { toasts, dismiss, dialog, closeDialog, confirm: confirmState, closeConfirm } = useToastStore();
  const answer = (value) => { confirmState?.resolve(value); closeConfirm(); };
  useEffect(() => {
    if (!confirmState) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { confirmState.resolve(false); closeConfirm(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);
  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeDialog();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, closeDialog]);
  const DialogIcon = dialog ? (TONE[dialog.tone] || TONE.error)[1] : null;
  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const [cls, Icon] = TONE[t.tone] || TONE.info;
          return (
            <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-lg ${cls}`}>
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 leading-5">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Close" className="shrink-0 opacity-60 hover:opacity-100"><X size={15} /></button>
            </div>
          );
        })}
      </div>
      {confirmState && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
          <div role="alertdialog" aria-modal="true" aria-label={confirmState.title} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-ink-900">
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${confirmState.danger ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}>
                {confirmState.danger ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-ink-900 dark:text-white">{confirmState.title}</h2>
                {confirmState.message && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-600 [overflow-wrap:anywhere] dark:text-ink-300">{confirmState.message}</p>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary !py-2" onClick={() => answer(false)} autoFocus>{confirmState.cancelLabel}</button>
              <button type="button" onClick={() => answer(true)} className={confirmState.danger ? 'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700' : 'btn-primary !py-2'}>{confirmState.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
      {dialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && closeDialog()}>
          <div role="alertdialog" aria-modal="true" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-ink-900">
            <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${dialog.tone === 'success' ? 'bg-emerald-100 text-emerald-600' : dialog.tone === 'warning' ? 'bg-amber-100 text-amber-600' : dialog.tone === 'info' ? 'bg-sky-100 text-sky-600' : 'bg-red-100 text-red-600'}`}>
              <DialogIcon size={30} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-ink-900 dark:text-white">{dialog.title}</h2>
            {dialog.message && <p className="mt-2 whitespace-pre-line text-left text-sm leading-6 text-ink-600 [overflow-wrap:anywhere] dark:text-ink-300 sm:text-center">{dialog.message}</p>}
            {dialog.links?.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {dialog.links.map((l) => (l.external
                  ? <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="btn-secondary !py-2 text-sm">{l.label} ↗</a>
                  : <Link key={l.href} to={l.href} onClick={closeDialog} className="btn-secondary !py-2 text-sm">{l.label}</Link>))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {dialog.actionLabel && <button type="button" className="btn-primary" onClick={() => { const fn = dialog.onAction; closeDialog(); fn?.(); }}>{dialog.actionLabel}</button>}
              <button type="button" className={dialog.actionLabel ? 'btn-secondary' : 'btn-primary'} onClick={closeDialog} autoFocus>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Skeleton({ className = '', style }) {
  return <div style={style} className={`skeleton-shimmer rounded-lg bg-ink-100 dark:bg-ink-800 ${className}`} />;
}

/** Card-grid placeholder while a list of cards loads. */
export function SkeletonCards({ count = 6, className = 'h-28' }) {
  return <>{Array.from({ length: count }).map((_, i) => <Skeleton key={i} className={className} />)}</>;
}

/** Full-section loader: thin progress bar + soft skeleton lines. */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="space-y-3 py-6" role="status" aria-label={label}>
      <div className="top-loadbar rounded-full bg-emerald-100 dark:bg-ink-800" />
      <Skeleton className="h-6 w-1/3" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-40" />
    </div>
  );
}

/** Small red "i" button that opens the full error text in a popup. */
export function ErrorInfo({ message, title = 'Why it failed', label }) {
  if (!message) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); const x = explainSendError(message); showDialog({ tone: 'error', title: x.title === 'Why it failed' ? title : x.title, message: x.message || String(message), links: x.links }); }}
      title="View error"
      aria-label="View error details"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-200 transition hover:bg-red-100 dark:bg-red-950/40 dark:ring-red-900"
    >
      <Info size={12} />{label}
    </button>
  );
}

export function SkeletonRows({ rows = 6 }) {
  return (
    <div className="space-y-3 p-3" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 !rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800"><Icon size={22} /></span>
      <p className="mt-3 font-semibold text-ink-700 dark:text-ink-200">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ size = 16, className = '' }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

/** Simple centered modal shell. */
export function Modal({ open, onClose, title, children, footer, size = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" className={`flex max-h-[92vh] w-full ${size} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900`}>
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3 dark:border-ink-800">{footer}</div>}
      </div>
    </div>
  );
}
