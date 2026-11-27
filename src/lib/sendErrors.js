/**
 * Turns a raw WhatsApp / Meta send error into something a customer can act on:
 * a short title, the full text, and links that fix it (Meta payment settings,
 * WhatsApp setup, templates …).
 */
const URL_RE = /(https?:\/\/[^\s)]+)/g;

export function extractUrls(text) {
  return String(text || '').match(URL_RE) || [];
}

export function explainSendError(message, code) {
  const text = String(message || '').trim();
  const c = String(code || (text.match(/#?(\d{5,6})/) || [])[1] || '');
  const urls = extractUrls(text);
  const links = [];
  let title = 'Why it failed';
  let hint = '';

  if (c === '131042' || /payment method|billing|payment/i.test(text)) {
    title = 'Meta payment method missing';
    hint = 'WhatsApp could not send because your WhatsApp Business account has no payment method. Add a card in Meta, then retry.';
    links.push({ label: 'Add payment method in Meta', href: urls.find((u) => /facebook\.com/.test(u)) || 'https://business.facebook.com/billing_hub/payment_settings', external: true });
    links.push({ label: 'Check WhatsApp setup', href: '/whatsapp' });
  } else if (c === '131047' || /24[- ]?hour|re-engagement|window/i.test(text)) {
    title = '24-hour window closed';
    hint = 'The customer has not replied in the last 24 hours, so only an approved template can be sent.';
    links.push({ label: 'Manage templates', href: '/whatsapp/templates' });
  } else if (/^13[2]\d{3}$/.test(c) || /template/i.test(text)) {
    title = 'Template problem';
    hint = 'The WhatsApp template is missing, not approved, or its variables don’t match.';
    links.push({ label: 'Manage templates', href: '/whatsapp/templates' });
  } else if (/not configured|not connected|access token|OAuthException|190\b/i.test(text) || c === '190') {
    title = 'WhatsApp not connected';
    hint = 'The WhatsApp number is not connected or its access has expired.';
    links.push({ label: 'Reconnect WhatsApp', href: '/whatsapp' });
  } else if (c === '131026' || /not a whatsapp|undeliverable|incapable/i.test(text)) {
    title = 'Number can’t receive WhatsApp';
    hint = 'This number is not on WhatsApp or cannot receive messages from businesses.';
  } else if (c === '131056' || /rate|too many|spam/i.test(text)) {
    title = 'Sending limit reached';
    hint = 'Meta is limiting messages to this number for now. Try again later.';
  }
  // Raw URLs are shown as buttons, not printed into the text.
  const cleaned = text.replace(URL_RE, '').replace(/\s+Visit\s+to resolve this issue\.?/i, '').replace(/\s{2,}/g, ' ').trim();
  return { title, message: [hint, cleaned && cleaned !== hint ? `Details: ${cleaned}` : ''].filter(Boolean).join('\n\n'), links };
}
