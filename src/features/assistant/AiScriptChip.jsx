import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { settingsApi } from '../../api/settingsApi.js';

/** Tiny "AI script: Default/Custom" chip. Hidden if the settings request fails (e.g. agents). */
export default function AiScriptChip() {
  const [custom, setCustom] = useState(null);
  useEffect(() => {
    let live = true;
    settingsApi.get().then((r) => { if (live) setCustom(Boolean(String(r?.data?.settings?.assistant?.instructions || '').trim())); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (custom === null) return null;
  return (
    <Link to="/whatsapp/ai-script" className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300">
      <Bot size={11} /> AI script: {custom ? 'Custom' : 'Default'}
    </Link>
  );
}
