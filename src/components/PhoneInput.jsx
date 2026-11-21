import { ChevronDown } from 'lucide-react';
import { DIAL_OPTIONS, DIAL_CODE } from '../lib/country.js';

/** 🇮🇳-style flag from an ISO code (falls back to letters where flags aren't supported). */
export function flagOf(code) {
  const c = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}

/**
 * Full international number from a dial-code country + what the user typed.
 * A number typed with "+" (or 00) is kept as is.
 */
export function toInternational(country, national) {
  const raw = String(national || '').trim();
  if (/^\+/.test(raw)) return `+${raw.replace(/\D/g, '')}`;
  if (/^00\d/.test(raw.replace(/[\s-]/g, ''))) return `+${raw.replace(/\D/g, '').slice(2)}`;
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  const dial = DIAL_CODE[country] || '';
  return digits ? `+${dial}${digits}` : '';
}

/**
 * Mobile number with a country dial-code selector. The visible part is a
 * small "🇮🇳 +91" chip; a native <select> sits on top of it (invisible) so
 * the picker is accessible and works well on phones.
 */
export default function PhoneInput({ id = 'phone', country, onCountryChange, value, onChange, placeholder = 'Mobile number', invalid = false, inputClassName = 'auth-input' }) {
  const dial = DIAL_CODE[country] ? `+${DIAL_CODE[country]}` : '+';
  return (
    <div className="flex gap-2">
      <div className={`relative flex shrink-0 items-center gap-1.5 rounded-xl border bg-white px-3 text-sm font-semibold text-lp-ink shadow-sm ${invalid ? 'border-red-300' : 'border-[#dbe3f5]'} focus-within:border-lp-teal focus-within:ring-4 focus-within:ring-lp-teal/15`}>
        <span aria-hidden="true" className="text-base leading-none">{flagOf(country)}</span>
        <span aria-hidden="true">{dial}</span>
        <ChevronDown size={14} aria-hidden="true" className="text-slate-400" />
        <select
          aria-label="Country dialling code"
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {DIAL_OPTIONS.map(([code, d, name]) => (
            <option key={code} value={code}>{`${name} (${d})`}</option>
          ))}
        </select>
      </div>
      <input
        id={id}
        type="tel"
        required
        inputMode="tel"
        autoComplete="tel-national"
        className={`${inputClassName} min-w-0 flex-1 px-4`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
      />
    </div>
  );
}
