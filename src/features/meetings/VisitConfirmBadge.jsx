import { PhoneCall, PhoneOff, PhoneForwarded, ShieldCheck } from 'lucide-react';

/**
 * Chhota badge jo batata hai ki AI confirmation call ka kya hua.
 *   doubleConfirmed          -> customer ne call par haan bola      (green)
 *   voiceConfirm calling     -> call chal rahi / lagne wali hai      (blue)
 *   callback_requested       -> customer ko callback chahiye         (amber)
 *   unreachable / error      -> call se confirm nahi ho paya         (amber)
 * Manual visit ya jahan call feature use hi nahi hua, wahan kuch nahi dikhta.
 */
export function visitConfirmState(m) {
  if (!m) return null;
  if (m.doubleConfirmed) return 'confirmed';
  const s = m.voiceConfirm?.status;
  if (s === 'requested' || s === 'calling') return 'calling';
  if (s === 'callback_requested') return 'callback';
  if (s === 'unreachable' || s === 'error') return 'unverified';
  return null;
}

const LOOK = {
  confirmed: { label: 'Confirmed ✓ (AI call)', title: 'Customer ne call par visit confirm ki', Icon: ShieldCheck, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  calling: { label: 'Confirmation call', title: 'AI agent customer ko confirm karne ke liye call kar raha hai', Icon: PhoneCall, cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  callback: { label: 'Callback chahiye', title: 'Customer ne callback maanga hai', Icon: PhoneForwarded, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  unverified: { label: 'Call se confirm nahi hua', title: 'Customer call par nahi mila — visit sirf chat ke basis par book hai', Icon: PhoneOff, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

export default function VisitConfirmBadge({ meeting, compact = false }) {
  const state = visitConfirmState(meeting);
  if (!state) return null;
  const { label, title, Icon, cls } = LOOK[state];
  return (
    <span title={meeting?.voiceConfirm?.note || title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon size={10} className={state === 'calling' ? 'animate-pulse' : ''} /> {compact ? label.replace(' (AI call)', '') : label}
    </span>
  );
}
