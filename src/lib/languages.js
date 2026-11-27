/**
 * Chat languages supported by the AI (same list as the backend's
 * services/language/languages.js). Hindi (Devanagari) and Hinglish (Roman
 * Hindi) are separate languages.
 *   waCode — WhatsApp template language code
 */
export const LANGUAGES = [
  { name: 'English', native: 'English', waCode: 'en_US' },
  { name: 'Hindi', native: 'हिंदी', waCode: 'hi' },
  { name: 'Hinglish', native: 'Roman Hindi', waCode: null },
  { name: 'Urdu', native: 'اردو', waCode: 'ur', rtl: true },
  { name: 'Arabic', native: 'العربية', waCode: 'ar', rtl: true },
  { name: 'Bangla', native: 'বাংলা', waCode: 'bn' },
  { name: 'Marathi', native: 'मराठी', waCode: 'mr' },
  { name: 'Gujarati', native: 'ગુજરાતી', waCode: 'gu' },
  { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', waCode: 'pa' },
  { name: 'Tamil', native: 'தமிழ்', waCode: 'ta' },
  { name: 'Telugu', native: 'తెలుగు', waCode: 'te' },
  { name: 'Kannada', native: 'ಕನ್ನಡ', waCode: 'kn' },
  { name: 'Malayalam', native: 'മലയാളം', waCode: 'ml' },
];

/** "Hindi" → "Hindi · हिंदी" */
export function languageLabel(name) {
  const l = LANGUAGES.find((x) => x.name === name);
  if (!l) return name || '';
  return l.native && l.native !== l.name ? `${l.name} · ${l.native}` : l.name;
}

/** How the saved language was decided, in words for the team. */
export function languageSourceLabel(source, language) {
  if (!language) return 'Not known yet';
  if (source === 'agent') return 'Set by your team';
  if (source === 'detected') return 'Detected from their messages';
  return 'Chosen by the customer';
}
