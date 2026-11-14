import { useEffect, useState, useCallback } from 'react';
import ChatPopup from '../../components/ChatPopup.jsx';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Search, Trash2, Pencil, Mail, MessageCircle, Users, UserPlus, MessageSquare, Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { leadApi } from '../../api/leadApi.js';
import LeadFormModal from './LeadFormModal.jsx';
import ImportLeadsModal from './ImportLeadsModal.jsx';
import SaveAudienceModal from '../audiences/SaveAudienceModal.jsx';
import { downloadSampleSheet } from '../../lib/sampleSheet.js';

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const sourceLabel = (s) => String(s || 'manual').replace(/^file_import.*/, 'file upload').replaceAll('_', ' ');

const TONE = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  gray: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
};
const SEND_LABEL = { sent: ['Sent', 'green'], delivered: ['Delivered', 'green'], read: ['Read', 'green'], failed: ['Failed', 'red'], pending: ['Sending', 'amber'], processing: ['Sending', 'amber'], not_sent: ['Not sent', 'gray'] };

function Pill({ tone, children }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE[tone]}`}>{children}</span>;
}

function Stat({ label, value, icon: Icon, tone, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`card !p-4 text-left transition ${active ? 'ring-2 ring-brand-500' : 'hover:border-brand-300'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
        <div><p className="text-xs text-ink-500 dark:text-ink-400">{label}</p><p className="font-display text-2xl font-bold text-ink-900 dark:text-white">{Number(value || 0).toLocaleString('en-IN')}</p></div>
      </div>
    </button>
  );
}

function Select({ value, onChange, children, label }) {
  return <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="input-field !w-auto !py-2 text-sm">{children}</select>;
}

/**
 * mode="all"      → saare contacts (upload, add, delete)
 * mode="whatsapp" → sirf WhatsApp wale: message gaya ya nahi, reply aaya ya nahi
 */
export default function LeadsPage({ mode = 'all' }) {
  const isWa = mode === 'whatsapp';
  const navigate = useNavigate();
  const [chatLead, setChatLead] = useState(null);
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({});
  const [sources, setSources] = useState([]);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [replied, setReplied] = useState('');
  const [source, setSource] = useState('');
  const [delivery, setDelivery] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAudience, setShowAudience] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  const effectiveChannel = isWa ? 'whatsapp' : channel;

  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const res = await leadApi.list({
        page, limit: 50,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(effectiveChannel ? { channel: effectiveChannel } : {}),
        ...(replied ? { replied } : {}),
        ...(source ? { source } : {}),
        ...(isWa && delivery ? { delivery } : {}),
      });
      setLeads(res.data.leads || []);
      setPagination(res.data.pagination || { page, limit: 50, total: 0, totalPages: 1 });
      setSummary(res.data.summary || {});
      setSources(res.data.sources || []);
      setSelected([]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Data load nahi hua.');
    } finally { setLoading(false); }
  }, [search, effectiveChannel, replied, source, delivery, isWa]);

  useEffect(() => { const t = setTimeout(() => fetchLeads(1), 250); return () => clearTimeout(t); }, [fetchLeads]);

  const toggleSelect = (id) => setSelected((items) => (items.includes(id) ? items.filter((x) => x !== id) : [...items, id]));
  const pageIds = leads.map((l) => l._id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const togglePage = () => setSelected((items) => (allOnPage ? items.filter((id) => !pageIds.includes(id)) : [...new Set([...items, ...pageIds])]));

  const handleDelete = async (id) => {
    if (!window.confirm('Ye contact delete karein?')) return;
    try { await leadApi.remove(id); await fetchLeads(Math.min(pagination.page, pagination.totalPages || 1)); }
    catch (err) { setError(err?.response?.data?.message || 'Delete nahi hua.'); }
  };
  const handleBulkDelete = async () => {
    if (!selected.length || !window.confirm(`${selected.length} contacts delete karein?`)) return;
    try { await leadApi.bulkDelete(selected); setSelected([]); await fetchLeads(1); }
    catch (err) { setError(err?.response?.data?.message || 'Delete nahi hua.'); }
  };

  const columns = isWa ? ['Name', 'Mobile', 'Message', 'Reply', ''] : ['', 'Name', 'Mobile', 'Email', 'Source', 'Added', ''];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">{isWa ? 'WhatsApp leads' : 'Upload Data'}</h1>
        <div className="flex flex-wrap gap-2">
          {!isWa && <>
            <button onClick={downloadSampleSheet} className="btn-secondary flex items-center gap-2"><Download size={16} /> Sample sheet</button>
            <button onClick={() => { setEditingLead(null); setShowForm(true); }} className="btn-secondary flex items-center gap-2"><Plus size={16} /> Add contact</button>
            <button onClick={() => setShowImport(true)} className="btn-primary flex items-center gap-2"><Upload size={16} /> Upload Data</button>
          </>}
          <button onClick={() => fetchLeads(pagination.page)} disabled={loading} className="btn-secondary" aria-label="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><span className="flex items-center gap-2"><AlertTriangle size={16} />{error}</span><button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
      {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><span className="flex items-center gap-2"><CheckCircle2 size={16} />{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}

      {!isWa && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total" value={summary.total} icon={Users} tone="bg-brand-50 text-brand-600 dark:bg-brand-900/30" active={!channel} onClick={() => setChannel('')} />
          <Stat label="WhatsApp" value={summary.whatsappAvailable} icon={MessageCircle} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" active={channel === 'whatsapp'} onClick={() => setChannel(channel === 'whatsapp' ? '' : 'whatsapp')} />
          <Stat label="Email" value={summary.emailAvailable} icon={Mail} tone="bg-sky-50 text-sky-600 dark:bg-sky-900/30" active={channel === 'email'} onClick={() => setChannel(channel === 'email' ? '' : 'email')} />
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-2 !p-3">
        <div className="relative w-full sm:w-60">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="input-field !py-2 !pl-9 text-sm" aria-label="Search" />
        </div>
        {!isWa && (
          <Select label="Channel" value={channel} onChange={setChannel}>
            <option value="">All channels</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option>
          </Select>
        )}
        {isWa && (
          <Select label="Message status" value={delivery} onChange={setDelivery}>
            <option value="">Sent + not sent</option><option value="sent">Sent</option><option value="unsent">Not sent</option>
          </Select>
        )}
        <Select label="Reply" value={replied} onChange={setReplied}>
          <option value="">Replied + not</option><option value="yes">Replied</option><option value="no">Not replied</option>
        </Select>
        <Select label="Source" value={source} onChange={setSource}>
          <option value="">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
        </Select>
        {(channel || replied || source || delivery) && <button type="button" onClick={() => { setChannel(''); setReplied(''); setSource(''); setDelivery(''); }} className="text-xs font-semibold text-brand-600 hover:underline">Clear</button>}
        {!isWa && selected.length > 0 && <>
          <button onClick={() => setShowAudience(true)} className="btn-primary ml-auto flex items-center gap-2 !py-2"><UserPlus size={15} /> {selected.length} · Audience</button>
          <button onClick={handleBulkDelete} className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"><Trash2 size={15} /> {selected.length}</button>
        </>}
      </div>

      <div className="card overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800">
              <tr>{columns.map((h, i) => <th key={`${h}-${i}`} className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300">{!isWa && i === 0 ? <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select all" /> : h}</th>)}</tr>
            </thead>
            <tbody>
              {loading && !leads.length ? <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-ink-400">Loading…</td></tr>
                : !leads.length ? <tr><td colSpan={columns.length} className="px-4 py-14 text-center"><Users size={28} className="mx-auto mb-2 text-ink-300" /><p className="font-semibold text-ink-600 dark:text-ink-300">Koi contact nahi</p></td></tr>
                : leads.map((lead) => {
                  const [sendText, sendTone] = SEND_LABEL[lead.whatsappMessageStatus] || SEND_LABEL.not_sent;
                  return (
                    <tr key={lead._id} className="border-t border-ink-100 align-middle hover:bg-ink-50/60 dark:border-ink-800 dark:hover:bg-ink-800/40">
                      {!isWa && <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${lead.name}`} checked={selected.includes(lead._id)} onChange={() => toggleSelect(lead._id)} /></td>}
                      <td className="max-w-[220px] px-3 py-3"><p className="truncate font-semibold text-ink-900 dark:text-white">{lead.name || 'Unnamed'}</p>{!isWa && lead.replyReceived && <Pill tone="green">Replied</Pill>}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-600 dark:text-ink-300">{lead.phone || '—'}</td>
                      {isWa ? <>
                        <td className="px-3 py-3"><Pill tone={sendTone}>{sendText}</Pill><p className="mt-1 text-[11px] text-ink-400">{fmtDate(lead.whatsappSentAt)}</p></td>
                        <td className="px-3 py-3">{lead.whatsappReplyAt ? <Pill tone="green">Replied · {lead.whatsappReplyCount || 1}</Pill> : <Pill tone="gray">No reply</Pill>}<p className="mt-1 text-[11px] text-ink-400">{lead.whatsappReplyAt ? fmtDate(lead.whatsappReplyAt) : ''}</p></td>
                        <td className="px-3 py-3 text-right">{lead.whatsappReplyAt && <button onClick={() => setChatLead(lead)} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-200"><MessageSquare size={13} /> Chat</button>}</td>
                      </> : <>
                        <td className="px-3 py-3 text-ink-600 dark:text-ink-300">{lead.email || '—'}</td>
                        <td className="px-3 py-3"><span className="rounded-full bg-ink-100 px-2 py-1 text-[11px] font-semibold capitalize text-ink-600 dark:bg-ink-800 dark:text-ink-300">{sourceLabel(lead.source)}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-500 dark:text-ink-400">{fmtDate(lead.createdAt)}</td>
                        <td className="px-3 py-3"><div className="flex justify-end gap-1">
                          <button aria-label={`Edit ${lead.name}`} onClick={() => { setEditingLead(lead); setShowForm(true); }} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800"><Pencil size={15} /></button>
                          <button aria-label={`Delete ${lead.name}`} onClick={() => handleDelete(lead._id)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><Trash2 size={15} /></button>
                        </div></td>
                      </>}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 dark:border-ink-800">
          <p className="text-xs text-ink-500">{pagination.total} contacts{selected.length ? ` · ${selected.length} selected` : ''}</p>
          <div className="flex items-center gap-2">
            <button disabled={pagination.page <= 1 || loading} onClick={() => fetchLeads(pagination.page - 1)} className="btn-secondary !px-3 !py-1.5 disabled:opacity-40">Previous</button>
            <span className="text-xs text-ink-500">{pagination.page} / {pagination.totalPages || 1}</span>
            <button disabled={pagination.page >= pagination.totalPages || loading} onClick={() => fetchLeads(pagination.page + 1)} className="btn-secondary !px-3 !py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {chatLead && <ChatPopup leadId={chatLead._id} name={chatLead.name} onClose={() => setChatLead(null)} />}
      {showForm && <LeadFormModal lead={editingLead} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchLeads(pagination.page); }} />}
      {showImport && <ImportLeadsModal onClose={() => setShowImport(false)} onImported={() => fetchLeads(1)} />}
      {showAudience && <SaveAudienceModal leadIds={selected} source="selection" onClose={() => setShowAudience(false)} onSaved={(a) => { setShowAudience(false); setSelected([]); setNotice(`Audience "${a.name}" save ho gaya.`); }} />}
    </div>
  );
}
