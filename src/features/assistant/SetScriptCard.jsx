import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, X } from 'lucide-react';
import { settingsApi } from '../../api/settingsApi.js';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';

const KEY = 'visitsly_ai_script_card_dismissed';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Dismissible hint on the WhatsApp page: shown once a number is connected and no custom script is set. */
export default function SetScriptCard() {
  const org = useAuthStore((s) => s.org);
  const role = useOrgRole();
  const connected = org?.whatsapp?.status === 'connected' && Boolean(org?.whatsapp?.phoneNumberId);
  const [dismissed, setDismissed] = useState(read);
  const [empty, setEmpty] = useState(false);
  const eligible = connected && !dismissed && role === 'owner';
  useEffect(() => {
    if (!eligible) return undefined;
    let live = true;
    settingsApi.get().then((r) => { if (live) setEmpty(!String(r?.data?.settings?.assistant?.instructions || '').trim()); }).catch(() => {});
    return () => { live = false; };
  }, [eligible]);
  if (!eligible || !empty) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } setDismissed(true); };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <Bot size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">Set how your AI talks to customers (2 min)</span>
      <Link to="/whatsapp/ai-script" className="btn-primary !py-1 text-xs">Set it up</Link>
      <button type="button" onClick={close} aria-label="Dismiss" className="rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"><X size={14} /></button>
    </div>
  );
}
