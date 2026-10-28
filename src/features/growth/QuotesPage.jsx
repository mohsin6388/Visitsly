import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, FileText, Send, X, Search } from 'lucide-react';
import { quoteApi } from '../../api/saasApi.js';
import { leadApi } from '../../api/leadApi.js';
import { propertyApi } from '../../api/propertyApi.js';
import { inr, fmtDate, PageTitle, Notice, errText, CopyBox } from '../../lib/saas.jsx';

const EMPTY = {
  leadId: null,
  leadName: '',
  customer: { name: '', phone: '' },
  project: '',
  unit: { tower: '', unitNo: '', floor: '', bhk: '', areaSqft: '', facing: '' },
  pricing: { ratePerSqft: '', baseAmount: '', items: [{ label: 'Car parking', amount: '' }, { label: 'PLC / corner', amount: '' }, { label: 'Club membership', amount: '', taxable: false }], discount: '', gstPct: 5, stampDutyPct: 7, registrationPct: 1 },
  paymentPlan: [{ milestone: 'Booking amount', pct: 10 }, { milestone: 'Within 30 days', pct: 20 }, { milestone: 'Construction-linked', pct: 60 }, { milestone: 'On possession', pct: 10 }],
  notes: '',
};

const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

function payloadOf(f) {
  return {
    leadId: f.leadId || undefined,
    customer: f.leadId ? undefined : { name: f.customer.name, phone: f.customer.phone },
    project: f.project,
    unit: { ...f.unit, areaSqft: num(f.unit.areaSqft) },
    pricing: {
      ratePerSqft: num(f.pricing.ratePerSqft),
      baseAmount: num(f.pricing.baseAmount),
      items: f.pricing.items.filter((i) => i.label && Number(i.amount)).map((i) => ({ label: i.label, amount: Number(i.amount), taxable: i.taxable !== false })),
      discount: num(f.pricing.discount),
      gstPct: Number(f.pricing.gstPct),
      stampDutyPct: Number(f.pricing.stampDutyPct),
      registrationPct: Number(f.pricing.registrationPct),
    },
    paymentPlan: f.paymentPlan.filter((p) => p.milestone).map((p) => ({ milestone: p.milestone, pct: Number(p.pct) || 0 })),
    notes: f.notes || undefined,
  };
}

function LeadPicker({ value, onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => leadApi.list({ search: q.trim(), limit: 8 }).then((r) => setResults(r.data.leads || [])).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q]);
  if (value) return <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm dark:bg-brand-900/30"><span>Lead: <strong>{value}</strong></span><button type="button" onClick={() => onPick(null)} aria-label="Remove lead"><X size={15} /></button></div>;
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-3 text-ink-400" />
      <input className="input-field !pl-9" placeholder="Lead dhoondhein (naam / mobile) — ya neeche customer bharein" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-ink-100 bg-white shadow-elevated dark:border-ink-700 dark:bg-ink-900">
          {results.map((l) => <li key={l._id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-800" onClick={() => { onPick(l); setQ(''); }}>{l.name} <span className="text-ink-400">{l.phone}</span></button></li>)}
        </ul>
      )}
    </div>
  );
}

function QuoteBuilder({ initialLead, onDone, onCancel }) {
  const [f, setF] = useState(() => ({ ...EMPTY, leadId: initialLead?._id || null, leadName: initialLead?.name || '' }));
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const props = useQuery({ queryKey: ['properties-mini'], queryFn: () => propertyApi.list({ limit: 100 }) });
  const projects = useMemo(() => [...new Set((props.data?.data?.properties || props.data?.data?.items || []).map((p) => p.projectName).filter(Boolean))], [props.data]);

  const set = (path, value) => setF((prev) => {
    const next = structuredClone(prev);
    const keys = path.split('.');
    let o = next;
    keys.slice(0, -1).forEach((k) => { o = o[k]; });
    o[keys.at(-1)] = value;
    return next;
  });

  useEffect(() => {
    const t = setTimeout(() => {
      const p = payloadOf(f);
      if (!(p.pricing.ratePerSqft && p.unit.areaSqft) && !p.pricing.baseAmount) { setPreview(null); return; }
      quoteApi.preview({ unit: p.unit, pricing: p.pricing, paymentPlan: p.paymentPlan }).then((r) => setPreview(r.data)).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [f]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await quoteApi.create(payloadOf(f));
      onDone(res.data.quote);
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  const planTotal = f.paymentPlan.reduce((a, p) => a + (Number(p.pct) || 0), 0);

  return (
    <form onSubmit={submit} className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="card min-w-0 space-y-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-ink-900 dark:text-white">Naya cost sheet</h2><button type="button" className="text-sm text-ink-500" onClick={onCancel}>Cancel</button></div>
        <Notice msg={msg} />
        <LeadPicker value={f.leadName} onPick={(l) => setF((p) => ({ ...p, leadId: l?._id || null, leadName: l?.name || '' }))} />
        {!f.leadId && (
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input-field" placeholder="Customer ka naam" value={f.customer.name} onChange={(e) => set('customer.name', e.target.value)} />
            <input className="input-field" placeholder="Mobile" value={f.customer.phone} onChange={(e) => set('customer.phone', e.target.value)} />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-500" htmlFor="q-project">Project</label>
          <input id="q-project" list="q-projects" className="input-field" required value={f.project} onChange={(e) => set('project', e.target.value)} />
          <datalist id="q-projects">{projects.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <legend className="mb-1 text-xs font-semibold text-ink-500">Unit</legend>
          {[['tower', 'Tower'], ['unitNo', 'Unit no.'], ['floor', 'Floor'], ['bhk', 'BHK'], ['areaSqft', 'Area (sq.ft)'], ['facing', 'Facing']].map(([k, l]) => (
            <input key={k} aria-label={l} className="input-field" placeholder={l} inputMode={k === 'areaSqft' ? 'numeric' : undefined} value={f.unit[k]} onChange={(e) => set(`unit.${k}`, e.target.value)} />
          ))}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-1 text-xs font-semibold text-ink-500">Price</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input-field" placeholder="Rate per sq.ft (₹)" inputMode="numeric" value={f.pricing.ratePerSqft} onChange={(e) => set('pricing.ratePerSqft', e.target.value.replace(/[^\d.]/g, ''))} />
            <input className="input-field" placeholder="Ya total basic amount (₹)" inputMode="numeric" value={f.pricing.baseAmount} onChange={(e) => set('pricing.baseAmount', e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          {f.pricing.items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input className="input-field min-w-0 flex-1" placeholder="Charge (PLC, parking, club, EDC…)" value={it.label} onChange={(e) => set(`pricing.items.${i}.label`, e.target.value)} />
              <input className="input-field !w-36" placeholder="₹" inputMode="numeric" value={it.amount} onChange={(e) => set(`pricing.items.${i}.amount`, e.target.value.replace(/[^\d.]/g, ''))} />
              <label className="flex items-center gap-1 text-xs text-ink-500"><input type="checkbox" checked={it.taxable !== false} onChange={(e) => set(`pricing.items.${i}.taxable`, e.target.checked)} /> GST</label>
              <button type="button" aria-label="Remove charge" className="text-ink-400 hover:text-red-600" onClick={() => set('pricing.items', f.pricing.items.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => set('pricing.items', [...f.pricing.items, { label: '', amount: '' }])}>+ Charge add karein</button>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs text-ink-500">Discount ₹<input className="input-field mt-1" inputMode="numeric" value={f.pricing.discount} onChange={(e) => set('pricing.discount', e.target.value.replace(/[^\d.]/g, ''))} /></label>
            <label className="text-xs text-ink-500">GST %<input className="input-field mt-1" inputMode="decimal" value={f.pricing.gstPct} onChange={(e) => set('pricing.gstPct', e.target.value)} /></label>
            <label className="text-xs text-ink-500">Stamp duty %<input className="input-field mt-1" inputMode="decimal" value={f.pricing.stampDutyPct} onChange={(e) => set('pricing.stampDutyPct', e.target.value)} /></label>
            <label className="text-xs text-ink-500">Registration %<input className="input-field mt-1" inputMode="decimal" value={f.pricing.registrationPct} onChange={(e) => set('pricing.registrationPct', e.target.value)} /></label>
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-ink-500">Payment plan {planTotal !== 100 && <span className="text-amber-600">(total {planTotal}% — 100% hona chahiye)</span>}</legend>
          {f.paymentPlan.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="input-field min-w-0 flex-1" value={p.milestone} onChange={(e) => set(`paymentPlan.${i}.milestone`, e.target.value)} />
              <input className="input-field !w-20" inputMode="decimal" value={p.pct} onChange={(e) => set(`paymentPlan.${i}.pct`, e.target.value)} aria-label="Percent" />
              <span className="text-xs text-ink-400">%</span>
              <button type="button" aria-label="Remove milestone" className="text-ink-400 hover:text-red-600" onClick={() => set('paymentPlan', f.paymentPlan.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => set('paymentPlan', [...f.paymentPlan, { milestone: '', pct: '' }])}>+ Milestone</button>
        </fieldset>
        <textarea className="input-field" rows={2} placeholder="Notes (offer, validity, terms)" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>

      <aside className="card min-w-0 h-fit space-y-3 xl:sticky xl:top-0">
        <h3 className="font-semibold text-ink-900 dark:text-white">Live total</h3>
        {preview ? (
          <dl className="space-y-1.5 text-sm">
            {[['Basic cost', preview.totals.base], ['Other charges', preview.totals.extras], ['Discount', -preview.totals.discount], ['Agreement value', preview.totals.agreementValue], ['GST', preview.totals.gst], ['Stamp duty', preview.totals.stampDuty], ['Registration', preview.totals.registration]].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-3"><dt className="text-ink-500">{l}</dt><dd className="font-mono">{inr(v)}</dd></div>
            ))}
            <div className="mt-2 flex justify-between gap-3 rounded-lg bg-brand-950 px-3 py-2.5 text-white"><dt className="font-semibold">All-inclusive</dt><dd className="font-mono font-bold">{inr(preview.totals.grandTotal)}</dd></div>
            {preview.paymentPlan.length > 0 && <div className="pt-2">{preview.paymentPlan.map((p) => <div key={p.milestone} className="flex justify-between text-xs text-ink-500"><span>{p.milestone} ({p.pct}%)</span><span className="font-mono">{inr(p.amount)}</span></div>)}</div>}
          </dl>
        ) : <p className="text-sm text-ink-500">Rate × area ya basic amount daaliye.</p>}
        <button className="btn-primary w-full gap-2" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Cost sheet banayein</button>
      </aside>
    </form>
  );
}

export default function QuotesPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const leadParam = params.get('lead');
  const [building, setBuilding] = useState(Boolean(leadParam));
  const [initialLead, setInitialLead] = useState(null);
  const [created, setCreated] = useState(null);
  const [msg, setMsg] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['quotes'], queryFn: () => quoteApi.list() });

  useEffect(() => {
    if (leadParam) leadApi.get(leadParam).then((r) => setInitialLead(r.data.lead)).catch(() => {});
  }, [leadParam]);

  const send = async (q) => {
    setMsg(null);
    try {
      const res = await quoteApi.sendWhatsapp(q._id);
      setMsg({ ok: true, text: res.message });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
  };

  const remove = async (q) => {
    if (!window.confirm(`${q.number} delete karein?`)) return;
    await quoteApi.remove(q._id);
    qc.invalidateQueries({ queryKey: ['quotes'] });
  };

  const items = data?.data?.items || [];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle title="Cost sheets" subtitle="Unit ka poora price breakup — PDF banaiye aur customer ko WhatsApp par bhejiye." action={!building && <button className="btn-primary gap-2" onClick={() => { setBuilding(true); setCreated(null); }}><Plus size={16} /> Naya cost sheet</button>} />
      <Notice msg={msg} />
      {created && (
        <section className="card min-w-0 space-y-3 border-green-200 dark:border-green-900">
          <p className="font-semibold text-green-800 dark:text-green-200">{created.number} ban gaya — {inr(created.totals.grandTotal)}</p>
          <CopyBox label="PDF link" value={created.pdfUrl} />
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary" href={created.pdfUrl} target="_blank" rel="noreferrer">PDF kholein</a>
            {created.customer?.phone && <button className="btn-primary gap-2" onClick={() => send(created)}><Send size={15} /> WhatsApp par bhejein</button>}
          </div>
        </section>
      )}
      {building && (
        initialLead || !leadParam
          ? <QuoteBuilder key={initialLead?._id || 'new'} initialLead={initialLead} onCancel={() => { setBuilding(false); setParams({}); }} onDone={(q) => { setCreated(q); setBuilding(false); setParams({}); qc.invalidateQueries({ queryKey: ['quotes'] }); }} />
          : <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ink-400" /></div>
      )}
      <section className="card min-w-0 !p-0">
        {isLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ink-400" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-400 dark:bg-ink-800/50"><tr><th className="px-4 py-2.5">No.</th><th className="px-4 py-2.5">Customer</th><th className="px-4 py-2.5">Project / unit</th><th className="px-4 py-2.5 text-right">All-inclusive</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5" /></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {items.map((q) => (
                  <tr key={q._id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{q.number}<span className="block text-ink-400">{fmtDate(q.createdAt)}</span></td>
                    <td className="px-4 py-2.5">{q.customer?.name || '—'}<span className="block text-xs text-ink-400">{q.customer?.phone}</span></td>
                    <td className="px-4 py-2.5">{q.project}<span className="block text-xs text-ink-400">{[q.unit?.tower && `T-${q.unit.tower}`, q.unit?.unitNo, q.unit?.bhk && `${q.unit.bhk} BHK`, q.unit?.areaSqft && `${q.unit.areaSqft} sq.ft`].filter(Boolean).join(' · ')}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono">{inr(q.totals?.grandTotal)}</td>
                    <td className="px-4 py-2.5 text-xs">{q.viewedAt ? <span className="text-green-700">Customer ne dekha</span> : q.sentAt ? 'Bheja gaya' : 'Draft'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2">
                        <a className="btn-secondary !px-2.5 !py-1.5 text-xs" href={q.pdfUrl} target="_blank" rel="noreferrer">PDF</a>
                        {q.customer?.phone && <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => send(q)} aria-label="Send on WhatsApp"><Send size={13} /></button>}
                        <button className="btn-secondary !px-2.5 !py-1.5 text-xs text-red-600" onClick={() => remove(q)} aria-label="Delete"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-500">Abhi koi cost sheet nahi</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
