import { useEffect, useState } from 'react';
import { orgApi } from '../api/saasApi.js';

let cache = null; // { at, numbers }

/** The company's WhatsApp numbers (main + extras). Names only, safe for every team member. */
export function useWhatsappNumbers() {
  const [numbers, setNumbers] = useState(() => (cache && Date.now() - cache.at < 60000 ? cache.numbers : []));
  useEffect(() => {
    let active = true;
    if (cache && Date.now() - cache.at < 60000) return undefined;
    orgApi.whatsappNumberLabels()
      .then((r) => { const list = r.data.numbers || []; cache = { at: Date.now(), numbers: list }; if (active) setNumbers(list); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return { numbers, multi: numbers.length >= 2 };
}

/** "+91 98765 43210" -> "+91 98xxx 43210"-style short form is not needed; show the saved display number. */
export function numberLabel(numbers, phoneNumberId) {
  const main = numbers.find((n) => n.isMain);
  const n = phoneNumberId ? numbers.find((x) => x.phoneNumberId === String(phoneNumberId)) : main;
  const hit = n || main;
  if (!hit) return '';
  return [hit.label, hit.displayPhoneNumber].filter(Boolean).join(' · ');
}

export function NumberBadge({ numbers, phoneNumberId, className = '' }) {
  const text = numberLabel(numbers, phoneNumberId);
  if (!text) return null;
  return <span title="WhatsApp number" className={`inline-flex max-w-full items-center truncate rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 ${className}`}>{text}</span>;
}
