import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Share2 } from 'lucide-react';
import { cpAdminApi } from '../../api/saasApi.js';
import { inr, fmtDate, PageTitle, Toggle, Notice, errText, CopyBox } from '../../lib/saas.jsx';

const STATUS_TONE = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-ink-100 text-ink-600',
};

export default function ChannelPartnersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['cps'], queryFn: cpAdminApi.list });
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState(null);
  const settings = data?.data?.settings;
  useEffect(() => {
    if (settings && !form) setForm({ defaultCommissionPct: settings.defaultCommissionPct ?? 2, leadProtectionDays: settings.leadProtectionDays ?? 60 });
  }, [settings, form]);

  const save = async (payload, text = 'Saved') => {
    setMsg(null);
    try {
      await cpAdminApi.settings(payload);
      await qc.invalidateQueries({ queryKey: ['cps'] });
      setMsg({ ok: true, text });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
  };
  const update = async (p, payload) => {
    try {
      await cpAdminApi.update(p.id, payload);
      qc.invalidateQueries({ queryKey: ['cps'] });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
  };

  if (isLoading || !settings) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;
  const items = data.data.items;
  const share = encodeURIComponent(`Hamare projects ke channel partner baniye — register karein: ${settings.portalUrl}`);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle title="Channel partners" subtitle="Brokers aapke projects ke liye customers laayein — lead protection aur commission ke saath." />
      <Notice msg={msg} />
      <section className="card min-w-0 space-y-4">
        <Toggle checked={!!settings.enabled} label="Channel partner portal chalu karein" help="Brokers register karke customer register kar sakenge, inventory aur brochures dekh sakenge, aur apni leads ka status track kar sakenge." onChange={(v) => save({ enabled: v }, v ? 'Portal chalu' : 'Portal band')} />
        {settings.enabled && (
          <>
            <CopyBox label="Partner portal link" value={settings.portalUrl} />
            <a className="btn-secondary w-fit gap-1.5 !py-1.5 text-xs" href={`https://wa.me/?text=${share}`} target="_blank" rel="noreferrer"><Share2 size={13} /> Brokers ko WhatsApp par bhejein</a>
            <Toggle checked={!!settings.autoApprove} label="Naye partners auto-approve" help="Off rakhenge to har broker ko aap approve karenge." onChange={(v) => save({ autoApprove: v })} />
            {form && (
              <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); save({ defaultCommissionPct: Number(form.defaultCommissionPct), leadProtectionDays: Number(form.leadProtectionDays) }); }}>
                <label className="text-xs text-ink-500">Default commission %<input className="input-field mt-1 !w-28" inputMode="decimal" value={form.defaultCommissionPct} onChange={(e) => setForm({ ...form, defaultCommissionPct: e.target.value })} /></label>
                <label className="text-xs text-ink-500">Lead protection (din)<input className="input-field mt-1 !w-28" inputMode="numeric" value={form.leadProtectionDays} onChange={(e) => setForm({ ...form, leadProtectionDays: e.target.value })} /></label>
                <button className="btn-secondary">Save</button>
              </form>
            )}
          </>
        )}
      </section>

      <section className="card min-w-0 !p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase text-ink-400 dark:bg-ink-800/50"><tr><th className="px-4 py-2.5">Partner</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Leads</th><th className="px-4 py-2.5 text-right">Bookings</th><th className="px-4 py-2.5">Commission %</th><th className="px-4 py-2.5 text-right">Commission due</th><th className="px-4 py-2.5" /></tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5"><span className="font-medium text-ink-900 dark:text-white">{p.name}</span>{p.firmName && <span className="text-ink-500"> · {p.firmName}</span>}<span className="block text-xs text-ink-400">{p.phone} · {p.city || '—'}{p.reraNumber ? ` · RERA ${p.reraNumber}` : ''} · joined {fmtDate(p.createdAt)}</span></td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_TONE[p.status]}`}>{p.status}</span></td>
                  <td className="px-4 py-2.5 text-right font-mono">{p.leads}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{p.bookings}</td>
                  <td className="px-4 py-2.5"><input aria-label={`Commission for ${p.name}`} className="input-field !w-20 !py-1.5" defaultValue={p.commissionPct} onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== p.commissionPct) update(p, { commissionPct: v }); }} /></td>
                  <td className="px-4 py-2.5 text-right font-mono">{inr(p.commissionDue)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      {p.status !== 'approved' && <button className="btn-primary !py-1.5 text-xs" onClick={() => update(p, { status: 'approved' })}>Approve</button>}
                      {p.status === 'pending' && <button className="btn-secondary !py-1.5 text-xs" onClick={() => update(p, { status: 'rejected' })}>Reject</button>}
                      {p.status === 'approved' && <button className="btn-secondary !py-1.5 text-xs" onClick={() => update(p, { status: 'suspended' })}>Suspend</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-500">Abhi koi partner nahi — upar ka link brokers ko bhejiye.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-ink-500">Commission tab banta hai jab aap chat panel se lead ko "Booked" mark karte hain (deal value ke saath).</p>
    </div>
  );
}
