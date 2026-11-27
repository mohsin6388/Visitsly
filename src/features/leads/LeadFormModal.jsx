import { useMemo, useState } from 'react';
import { X, CheckCircle2, MessageCircle, Mail, Loader2, AlertTriangle } from 'lucide-react';
import { leadApi } from '../../api/leadApi.js';
import { normalizePhone, isValidEmail, formatPhone } from '../../lib/phone.js';
import CampaignLauncher from '../outreach/CampaignLauncher.jsx';

// Upload Data contact: name, mobile, email, address, job title (+ optional city & notes).
// Lead status / score are set by the AI from replies, not typed by hand.
const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '', jobTitle: '', city: '', notes: '',
};

const INPUT = 'w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-ink-800 dark:text-white';
const okBorder = 'border-ink-200 dark:border-ink-700';
const badBorder = 'border-red-400 focus:border-red-500 dark:border-red-500';

export default function LeadFormModal({ lead, onClose, onSaved, onChanged }) {
  const isEdit = Boolean(lead);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          name: lead.name || '', phone: lead.phone || '', email: lead.email || '',
          address: lead.address || '', jobTitle: lead.jobTitle || lead.occupation || '',
          city: lead.city || '', notes: lead.notes || '',
        }
      : EMPTY_FORM
  );
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // lead just added -> offer to message
  const [launcher, setLauncher] = useState(null); // 'whatsapp' | 'email'
  const [sentChannel, setSentChannel] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const touch = (key) => () => setTouched((t) => ({ ...t, [key]: true }));

  // An agent who only sees the last 4 digits can't change the number (the server refuses it too).
  const phoneMasked = isEdit && String(lead?.phone || '').includes('•');
  const phoneResult = useMemo(() => (!phoneMasked && form.phone.trim() ? normalizePhone(form.phone) : null), [form.phone, phoneMasked]);
  const emailValid = !form.email.trim() || isValidEmail(form.email.trim());
  const phoneError = phoneResult && !phoneResult.ok ? phoneResult.error : '';
  const emailError = !emailValid ? 'Invalid email format (e.g. name@gmail.com)' : '';
  const needOne = !phoneMasked && !form.phone.trim() && !form.email.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setTouched({ phone: true, email: true });
    if (needOne) { setError('Enter a mobile number or an email.'); return; }
    if (phoneError || emailError) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        phone: phoneResult?.ok ? phoneResult.phone : '',
        email: form.email.trim().toLowerCase(),
      };
      if (phoneMasked) delete payload.phone;
      if (isEdit) {
        await leadApi.update(lead._id, payload);
        onSaved();
      } else {
        const res = await leadApi.create(payload);
        setCreated(res.data.lead);
        onChanged?.();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Step 2: contact saved -> offer to message it ----------
  if (created) {
    const hasPhone = Boolean(created.phone);
    const hasEmail = Boolean(created.email);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-ink-900">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={28} /></span>
          <h2 className="mt-4 font-display text-lg font-bold text-ink-900 dark:text-white">Contact added</h2>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300"><b>{created.name}</b>{hasPhone ? ` · ${formatPhone(created.phone)}` : ''}{hasEmail ? ` · ${created.email}` : ''}</p>
          <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-left dark:border-brand-900 dark:bg-brand-950/20">
            <p className="text-sm font-semibold text-ink-900 dark:text-white">Send them a message?</p>
            <p className="mt-1 text-xs leading-5 text-ink-600 dark:text-ink-300">Send now or schedule for later.</p>
            <div className="mt-3 grid gap-2">
              {hasPhone && <button type="button" onClick={() => setLauncher('whatsapp')} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><MessageCircle size={16} /> {sentChannel === 'whatsapp' ? 'WhatsApp sent ✓ (send again)' : 'Send / schedule on WhatsApp'}</button>}
              {hasEmail && <button type="button" onClick={() => setLauncher('email')} className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"><Mail size={16} /> {sentChannel === 'email' ? 'Email sent ✓ (send again)' : 'Send / schedule email'}</button>}
            </div>
          </div>
          <button type="button" onClick={onSaved} className="mt-4 w-full text-sm font-semibold text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">{sentChannel ? 'Close' : 'Not now'}</button>
        </div>
        {launcher && (
          <CampaignLauncher
            key={launcher}
            channel={launcher}
            initialLeadIds={[created._id]}
            lockSelection
            lockLabel={<>Only <b>{created.name}</b> is selected.</>}
            defaultMode="now"
            zIndex={70}
            initialName={`${created.name} · ${launcher === 'whatsapp' ? 'WhatsApp' : 'Email'}`.slice(0, 120)}
            onClose={() => setLauncher(null)}
            onLaunched={() => { setSentChannel(launcher); setTimeout(() => setLauncher(null), 900); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">
            {isEdit ? 'Edit contact' : 'Add contact'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name (optional)" value={form.name} onChange={set('name')} placeholder="Ayush Sharma" />
            <Field
              label="Mobile / WhatsApp"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/[^\d+\s().-]/g, '') }))}
              onBlur={touch('phone')}
              placeholder="98765 43210"
              inputMode="tel"
              maxLength={20}
              readOnly={phoneMasked}
              disabled={phoneMasked}
              error={touched.phone && phoneError}
              hint={phoneMasked ? 'Hidden: you can see only the last 4 digits' : phoneResult?.ok ? `Will save as: ${formatPhone(phoneResult.phone)}` : 'Enter 10 digits — 91 is added automatically'}
              hintOk={phoneResult?.ok}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email" type="email" value={form.email} onChange={set('email')} onBlur={touch('email')} placeholder="name@email.com" error={touched.email && emailError} />
            <Field label="Job title" value={form.jobTitle} onChange={set('jobTitle')} placeholder="Bank Manager" />
          </div>
          <TextArea label="Address" value={form.address} onChange={set('address')} placeholder="Area, city" />
          <Field label="City (optional)" value={form.city} onChange={set('city')} />
          <TextArea label="Notes (optional)" value={form.notes} onChange={set('notes')} />
          <p className="text-[11px] text-ink-400">Mobile or email is required. Saving does not send any message.</p>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving…' : isEdit ? 'Update' : 'Save contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, hint, hintOk, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{label}</label>
      <input aria-label={label} aria-invalid={Boolean(error)} {...props} className={`${INPUT} ${error ? badBorder : okBorder}`} />
      {error ? <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p>
        : hint ? <p className={`mt-1 text-[11px] ${hintOk ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-ink-400'}`}>{hint}</p> : null}
    </div>
  );
}

function TextArea({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{label}</label>
      <textarea aria-label={label} rows={2} {...props} className={`${INPUT} ${okBorder}`} />
    </div>
  );
}
