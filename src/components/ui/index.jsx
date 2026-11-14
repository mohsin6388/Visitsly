import { useEffect } from 'react';
import { create } from 'zustand';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Toasts + error popups (one global store, mounted once in the layout) */
/* ------------------------------------------------------------------ */
let seq = 0;
export const useToastStore = create((set) => ({
  toasts: [],
  dialog: null, // { tone, title, message, actionLabel, onAction }
  push: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, ...t }] }));
    if (t.duration !== 0) setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.duration || 4500);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
}));

export const toast = {
  success: (message, opts = {}) => useToastStore.getState().push({ tone: 'success', message, ...opts }),
  error: (message, opts = {}) => useToastStore.getState().push({ tone: 'error', message, duration: 7000, ...opts }),
  info: (message, opts = {}) => useToastStore.getState().push({ tone: 'info', message, ...opts }),
};

/** Blocking popup for errors the user must read (e.g. WhatsApp 24h window, payment failed). */
export function showDialog({ tone = 'error', title, message, actionLabel, onAction }) {
  useToastStore.getState().openDialog({ tone, title, message, actionLabel, onAction });
}

const TONE = {
  success: ['border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100', CheckCircle2],
  error: ['border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/80 dark:text-red-100', XCircle],
  info: ['border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/80 dark:text-sky-100', Info],
  warning: ['border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-100', AlertTriangle],
};

export function Toaster() {
  const { toasts, dismiss, dialog, closeDialog } = useToastStore();
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
      {dialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && closeDialog()}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-ink-900">
            <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${dialog.tone === 'success' ? 'bg-emerald-100 text-emerald-600' : dialog.tone === 'warning' ? 'bg-amber-100 text-amber-600' : dialog.tone === 'info' ? 'bg-sky-100 text-sky-600' : 'bg-red-100 text-red-600'}`}>
              <DialogIcon size={30} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-ink-900 dark:text-white">{dialog.title}</h2>
            {dialog.message && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-600 dark:text-ink-300">{dialog.message}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {dialog.actionLabel && <button type="button" className="btn-primary" onClick={() => { const fn = dialog.onAction; closeDialog(); fn?.(); }}>{dialog.actionLabel}</button>}
              <button type="button" className={dialog.actionLabel ? 'btn-secondary' : 'btn-primary'} onClick={closeDialog} autoFocus>Theek hai</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-ink-100 dark:bg-ink-800 ${className}`} />;
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
