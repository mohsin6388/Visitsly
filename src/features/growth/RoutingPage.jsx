import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Shuffle } from 'lucide-react';
import { growthApi } from '../../api/saasApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { Toggle, PageTitle, Notice, errText, ROLE_LABEL } from '../../lib/saas.jsx';

export default function RoutingPage() {
  const qc = useQueryClient();
  const setOrg = useAuthStore((s) => s.setOrg);
  const org = useAuthStore((s) => s.org);
  const { data, isLoading } = useQuery({ queryKey: ['routing'], queryFn: growthApi.routing });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const r = data?.data?.routing;

  const save = async (payload, text = 'Saved') => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await growthApi.updateRouting(payload);
      qc.setQueryData(['routing'], { data: { routing: res.data.routing } });
      if (org) setOrg({ ...org, routing: { mode: res.data.routing.mode, agentsSeeOnlyAssigned: res.data.routing.agentsSeeOnlyAssigned } });
      setMsg({ ok: true, text });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !r) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;
  const selected = new Set(r.agentIds);
  const pool = r.agentIds.length ? r.team.filter((t) => selected.has(t.id)) : r.team.filter((t) => t.orgRole === 'agent');

  const distribute = async () => {
    setBusy(true);
    try {
      const res = await growthApi.distribute();
      setMsg({ ok: true, text: res.message });
      qc.invalidateQueries({ queryKey: ['routing'] });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle title="Lead routing" subtitle="Nayi leads team mein barabar baantiye — koi lead bina owner ke na rahe." />
      <Notice msg={msg} />
      <section className="card min-w-0 space-y-5">
        <Toggle checked={r.mode === 'round_robin'} disabled={busy} label="Round-robin assignment" help="Form, ads, portal, channel partner aur WhatsApp par khud aane wali har nayi lead baari-baari se agents ko assign hogi." onChange={(v) => save({ mode: v ? 'round_robin' : 'off' }, v ? 'Round-robin on' : 'Round-robin off')} />
        <Toggle checked={r.agentsSeeOnlyAssigned} disabled={busy} label="Agents sirf apni leads dekhein" help="On karne par agent ko sirf usko assign hui leads aur chats dikhenge. Owner/manager sab dekh sakte hain." onChange={(v) => save({ agentsSeeOnlyAssigned: v })} />
      </section>

      <section className="card min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink-900 dark:text-white">Kaun leads lega?</h2>
            <p className="text-sm text-ink-500">Kisi ko nahi chuna to saare agents (agent na hon to managers).</p>
          </div>
          <button className="btn-secondary gap-2" disabled={busy || !r.unassigned} onClick={distribute}><Shuffle size={15} /> {r.unassigned} unassigned leads baantein</button>
        </div>
        <ul className="mt-4 divide-y divide-ink-100 dark:divide-ink-800">
          {r.team.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <label className="flex min-w-0 cursor-pointer items-center gap-3">
                <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={selected.has(t.id)} onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(t.id); else next.delete(t.id);
                  save({ agentIds: [...next] });
                }} />
                <span className="min-w-0"><span className="font-medium text-ink-900 dark:text-white">{t.name}</span><span className="ml-2 text-xs text-ink-400">{ROLE_LABEL[t.orgRole]}</span></span>
              </label>
              <span className="text-sm text-ink-500">{t.assignedLeads} leads{pool.some((p) => p.id === t.id) && r.mode === 'round_robin' ? <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">in rotation</span> : null}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
