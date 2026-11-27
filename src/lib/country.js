import api from '../api/axios.js';
import { COUNTRY_LIST, DIAL_CODE, COUNTRY_NAME, isCountryCode } from './countries.js';

/**
 * Visitor country, in three levels:
 *   1. IP-based — GET /api/public/geo (Cloudflare / Vercel header or IP lookup)
 *   2. Browser guess — timezone / language (no network), only if 1 returns null
 *   3. The user confirms it (signup dial code, onboarding country, pricing dropdown)
 * The result is cached in sessionStorage for the tab.
 */

const TZ_COUNTRY = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Muscat': 'OM',
  'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH', 'Europe/London': 'GB', 'Asia/Singapore': 'SG', 'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Pacific/Auckland': 'NZ', 'America/Toronto': 'CA',
  'America/Vancouver': 'CA', 'Asia/Kathmandu': 'NP', 'Asia/Katmandu': 'NP', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Karachi': 'PK',
  'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Dublin': 'IE',
  'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG', 'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH',
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Bangkok': 'TH', 'Asia/Hong_Kong': 'HK', 'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN',
};

const CACHE_KEY = 'visitsly.country';

export function guessCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    if (tz.startsWith('America/')) return 'US';
    const lang = (navigator.language || '').split('-')[1];
    const c = lang ? lang.toUpperCase() : '';
    return isCountryCode(c) ? c : 'IN';
  } catch {
    return 'IN';
  }
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && isCountryCode(v.country) ? v : null;
  } catch {
    return null;
  }
}

function writeCache(country, source) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ country, source }));
  } catch {
    /* storage blocked */
  }
}

let inflight = null;

/**
 * Resolves to { country, source: 'ip' | 'browser' }. Never rejects; the geo
 * request is capped at ~2 s so signup / pricing are never blocked.
 */
export function detectCountry() {
  const cached = readCache();
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = api
    .get('/public/geo', { timeout: 2500 })
    .then((r) => {
      const c = String(r.data?.data?.country || r.data?.country || '').toUpperCase();
      return isCountryCode(c) ? { country: c, source: 'ip' } : null;
    })
    .catch(() => null)
    .then((hit) => {
      const result = hit || { country: guessCountry(), source: 'browser' };
      writeCache(result.country, result.source);
      inflight = null;
      return result;
    });
  return inflight;
}

/** Synchronous best guess for the first render (cache → browser). */
export function initialCountry() {
  return readCache()?.country || guessCountry();
}

/** Billing currency for a country: India → INR, UAE → AED, everyone else → USD. */
export function currencyForCountry(country) {
  const c = String(country || '').toUpperCase();
  if (c === 'IN') return 'INR';
  if (c === 'AE') return 'AED';
  return 'USD';
}

const CURRENCY_HINT = { INR: '₹ INR', AED: 'AED', USD: 'USD' };

export function countryLabel(code) {
  const name = COUNTRY_NAME[code] || code;
  return `${name} (${CURRENCY_HINT[currencyForCountry(code)]})`;
}

/** Every country, India / UAE / US first: [code, "India (₹ INR)"]. */
const PINNED = ['IN', 'AE', 'US'];
export const COUNTRY_OPTIONS = [
  ...PINNED.map((c) => [c, countryLabel(c)]),
  ...COUNTRY_LIST.filter(([c]) => !PINNED.includes(c)).map(([c]) => [c, countryLabel(c)]),
];

/** Dial-code options: [code, "+91", "India"]. */
export const DIAL_OPTIONS = [
  ...PINNED.map((c) => [c, `+${DIAL_CODE[c]}`, COUNTRY_NAME[c]]),
  ...COUNTRY_LIST.filter(([c]) => !PINNED.includes(c)).map(([c, name, dial]) => [c, `+${dial}`, name]),
];

export { DIAL_CODE, COUNTRY_NAME, isCountryCode };
