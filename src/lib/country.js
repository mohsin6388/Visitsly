/** Best guess of the visitor's country from the browser (no network call). */
const TZ_COUNTRY = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Muscat': 'OM',
  'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH', 'Europe/London': 'GB', 'Asia/Singapore': 'SG', 'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'Asia/Kathmandu': 'NP',
  'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL', 'Europe/Dublin': 'IE',
};

export function guessCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    if (tz.startsWith('America/')) return 'US';
    const lang = (navigator.language || '').split('-')[1];
    return lang ? lang.toUpperCase() : 'IN';
  } catch {
    return 'IN';
  }
}

export const COUNTRY_OPTIONS = [
  ['IN', 'India (₹ INR)'], ['AE', 'UAE (AED)'], ['SA', 'Saudi Arabia (SAR)'], ['QA', 'Qatar (QAR)'], ['OM', 'Oman (OMR)'], ['KW', 'Kuwait (KWD)'], ['BH', 'Bahrain (BHD)'],
  ['GB', 'United Kingdom (GBP)'], ['US', 'United States (USD)'], ['CA', 'Canada (CAD)'], ['AU', 'Australia (AUD)'], ['SG', 'Singapore (SGD)'], ['NZ', 'New Zealand (NZD)'],
  ['DE', 'Germany (EUR)'], ['FR', 'France (EUR)'], ['IT', 'Italy (EUR)'], ['ES', 'Spain (EUR)'], ['NL', 'Netherlands (EUR)'], ['IE', 'Ireland (EUR)'],
  ['NP', 'Nepal (USD)'], ['BD', 'Bangladesh (USD)'], ['LK', 'Sri Lanka (USD)'], ['OTHER', 'Other country (USD)'],
];
