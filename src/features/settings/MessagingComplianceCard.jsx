import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { orgApi } from '../../api/saasApi.js';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';

/** Bulk WhatsApp / email safety settings: postal address for email footers + quiet hours. */
export default function MessagingComplianceCard() {
  const org = useAuthStore((s) => s.org);
  const setOrg = useAuthStore((s) => s.setOrg);
  const role = useOrgRole();
  const m = org?.messaging || {};
  const [form, setForm] = useState({ postalAddress: '', quietHoursStart: '', quietHoursEnd: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setForm({ postalAddress: m.postalAddress || '', quietHoursStart: m.quietHoursStart || '', quietHoursEnd: m.quietHoursEnd || '' });
  }, [m.postalAddress, m.quietHoursStart, m.quietHoursEnd]);

  if (!org) return null;
  const canEdit = role !== 'agent';

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await orgApi.update(form);
      if (res?.data?.org) setOrg(res.data.org);
      setMsg('Saved');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Save nahi hua');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card mt-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck size={18} className="text-brand-600" /> Bulk messaging safety</h2>
      <p className="mt-1 text-sm text-ink-500">
        Ye details har campaign email ke footer mein jaati hain aur quiet hours mein campaigns ruk jaate hain.{' '}
        <Link to="/messaging-policy" className="font-semibold text-brand-700 underline">Policy padhein</Link>
      </p>
      {m.autoPausedAt && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Campaigns safety reason se auto-pause hue the: {m.autoPausedReason || 'high opt-out / failure rate'}
        </p>
      )}
      <label className="mt-4 block text-sm font-medium">Business postal address (email footer ke liye zaroori)</label>
      <textarea className="input-field mt-1 w-full" rows={2} disabled={!canEdit} value={form.postalAddress}
        onChange={(e) => setForm({ ...form, postalAddress: e.target.value })} placeholder="Office no., building, area, city, PIN / emirate" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Quiet hours start</label>
          <input type="time" className="input-field mt-1 w-full" disabled={!canEdit} value={form.quietHoursStart}
            onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium">Quiet hours end</label>
          <input type="time" className="input-field mt-1 w-full" disabled={!canEdit} value={form.quietHoursEnd}
            onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })} />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-400">Khaali chhodne par default 9 PM – 9 AM ({org.region === 'ae' ? 'Dubai' : 'India'} time). Is time campaign messages agle din subah bheje jaate hain; lead replies chalte rehte hain.</p>
      {canEdit && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {msg && <span className="text-sm text-ink-500">{msg}</span>}
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />} Save
          </button>
        </div>
      )}
    </div>
  );
}
