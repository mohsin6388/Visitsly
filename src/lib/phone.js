const DEFAULT_CC = '91';

// Country codes accepted WITHOUT a leading "+", with the allowed total digit counts.
// Anything else from outside India must be written with "+" (e.g. +94771234567).
const OPEN_CC = [
  ['971', [12]], ['966', [12]], ['974', [11]], ['968', [11]], ['965', [11]], ['973', [11]],
  ['44', [12, 13]], ['61', [11]], ['65', [10]], ['64', [10, 11, 12]], ['49', [11, 12, 13, 14]], ['1', [11]],
];

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email || email.length > 254 || /\.\./.test(email)) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/.test(email)
    && !/^\.|\.@/.test(email);
}

/**
 * Normalises any typed/uploaded mobile number to WhatsApp format (digits only,
 * country code first). 10-digit Indian numbers get 91 added automatically.
 * Returns { ok, phone, error, empty }.
 */
export function normalizePhone(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, empty: true, phone: '', error: 'Number likhein' };
  if (/^\d(\.\d+)?e\+?\d+$/i.test(raw)) {
    return { ok: false, phone: '', error: 'Number Excel ke scientific format (E+) mein hai. Sheet mein mobile column ko Text format karke dobara daalein.' };
  }
  if (/[a-z]/i.test(raw.replace(/ext\.?\s*\d+$/i, ''))) return { ok: false, phone: '', error: 'Number mein sirf digits hone chahiye' };

  const hasPlus = raw.startsWith('+');
  const hasDoubleZero = !hasPlus && /^00\d/.test(raw.replace(/[\s().-]/g, ''));
  let digits = raw.replace(/\D/g, '');
  if (hasDoubleZero) digits = digits.slice(2);
  if (!digits) return { ok: false, phone: '', error: 'Number mein digits nahi hain' };
  if (/^(\d)\1+$/.test(digits)) return { ok: false, phone: '', error: 'Ye number sahi nahi lagta' };

  const finishIndian = (national) => (INDIAN_MOBILE.test(national)
    ? { ok: true, phone: `${DEFAULT_CC}${national}`, national }
    : { ok: false, phone: '', error: national.length === 10 ? 'Indian mobile number 6, 7, 8 ya 9 se shuru hota hai' : 'Mobile number 10 digit ka hona chahiye' });

  if (hasPlus || hasDoubleZero) {
    if (digits.length < 8 || digits.length > 15) return { ok: false, phone: '', error: 'Country code ke saath number 8 se 15 digit ka hona chahiye' };
    if (digits.startsWith(DEFAULT_CC)) {
      const result = finishIndian(digits.slice(DEFAULT_CC.length));
      return result.ok ? result : { ok: false, phone: '', error: 'India (+91) ka number 10 digit ka hona chahiye' };
    }
    return { ok: true, phone: digits };
  }

  if (digits.length === 10) return finishIndian(digits);
  if (digits.length === 11 && digits.startsWith('0')) return finishIndian(digits.slice(1));
  if (digits.length === 12 && digits.startsWith(DEFAULT_CC)) {
    const result = finishIndian(digits.slice(2));
    return result.ok ? result : { ok: false, phone: '', error: 'India (+91) ka number 10 digit ka hona chahiye' };
  }
  const open = OPEN_CC.find(([cc, lengths]) => digits.startsWith(cc) && lengths.includes(digits.length));
  if (open) return { ok: true, phone: digits };

  if (digits.length < 10) return { ok: false, phone: '', error: `Number 10 digit ka hona chahiye (abhi ${digits.length} digit hai)` };
  return { ok: false, phone: '', error: `Number galat hai (${digits.length} digit). India ka number 10 digit ka hota hai; dusre desh ka number + country code ke saath likhein.` };
}

/** Stored variants of the same number (older rows may lack the 91 prefix). */
export function phoneVariants(phone) {
  const value = String(phone || '');
  const list = [value];
  if (value.startsWith(DEFAULT_CC) && value.length === 12) list.push(value.slice(2));
  return list;
}

/** "919876543210" -> "+91 98765 43210" (for display only). */
export function formatPhone(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  if (!p) return '';
  if (p.length === 12 && p.startsWith('91')) return `+91 ${p.slice(2, 7)} ${p.slice(7)}`;
  return `+${p}`;
}

/** True when a stored number is not a clean, WhatsApp-ready number (old/bad data). */
export function isBadStoredPhone(phone) {
  if (!phone) return false;
  const n = normalizePhone(phone);
  return !n.ok || n.phone !== String(phone);
}
