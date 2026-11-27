import { useMemo, useRef, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Copy, FileSpreadsheet, Loader2, ArrowLeft, ArrowRight, Users, MessageCircle, Mail, CalendarClock } from 'lucide-react';
import CampaignLauncher from '../outreach/CampaignLauncher.jsx';
import { leadApi } from '../../api/leadApi.js';
import { formatPhone } from '../../lib/phone.js';
import { uploadErrorMessage } from '../../lib/uploadError.js';

const CHUNK = 500;
const PREVIEW_LIMIT = 200;
const FILTERS = [['all', 'All'], ['valid', 'Ready'], ['duplicate', 'Duplicate'], ['invalid', 'Invalid']];

export default function ImportLeadsModal({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [importChannel, setImportChannel] = useState('both');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [launcher, setLauncher] = useState(null); // 'whatsapp' | 'email'
  const [progress, setProgress] = useState({ label: '', percent: 0 });
  const [rowFilter, setRowFilter] = useState('all');
  const [scheduled, setScheduled] = useState({});
  const shownRows = useMemo(() => (rowFilter === 'all' ? rows : rows.filter((row) => row.status === rowFilter)), [rows, rowFilter]);
  const validRows = useMemo(() => rows.filter((row) => row.status === 'valid' && (importChannel === 'both' ? (row.phone || row.email) : importChannel === 'whatsapp' ? row.phone : row.email)), [rows, importChannel]);

  const handleFile = async (file) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
      setError('Upload a CSV or Excel (.xlsx) file. Save old .xls files as .xlsx first.');
      return;
    }
    setError('');
    setLoading(true);
    setFileName(file.name);
    setProgress({ label: 'Uploading file…', percent: 5 });
    try {
      const response = await leadApi.importPreview(file, importChannel, (percent) => {
        setProgress(percent >= 100 ? { label: 'Checking numbers and duplicates…', percent: 90 } : { label: 'Uploading file…', percent: Math.max(5, Math.round(percent * 0.8)) });
      });
      setRows(response.data.rows || []);
      setSummary(response.data.summary || {});
      setRowFilter('all');
      setStep('preview');
    } catch (err) {
      setError(uploadErrorMessage(err, 'Could not read the file. Check the header row and format.'));
    } finally {
      setLoading(false);
      setProgress({ label: '', percent: 0 });
    }
  };

  const importRows = async () => {
    if (!validRows.length || loading) return;
    setLoading(true);
    setError('');
    const payload = validRows.map(({ status, errors, warnings, isDuplicate, duplicateReason, rowNumber, rawPhone, ...row }) => ({ ...row, phone: importChannel === 'email' ? '' : row.phone, email: importChannel === 'whatsapp' ? '' : row.email, source: `file_import_${importChannel}`, importFile: fileName }));
    const total = { insertedCount: 0, skipped: 0, skippedByLimit: 0, leadIds: [], existingLeadIds: [] };
    try {
      for (let start = 0; start < payload.length; start += CHUNK) {
        setProgress({ label: `Saving contacts… ${Math.min(start, payload.length).toLocaleString('en-IN')} / ${payload.length.toLocaleString('en-IN')}`, percent: Math.round((start / payload.length) * 100) });
        const response = await leadApi.importConfirm(payload.slice(start, start + CHUNK));
        const data = response.data || {};
        total.insertedCount += data.insertedCount || 0;
        total.skipped += data.skipped || 0;
        total.skippedByLimit += data.skippedByLimit || 0;
        total.leadIds.push(...(data.leadIds || []));
        total.existingLeadIds.push(...(data.existingLeadIds || []));
        onImported?.();
      }
      setProgress({ label: 'Done', percent: 100 });
      const ids = [...new Set([...total.leadIds, ...total.existingLeadIds].map(String))];
      setResult({ ...total, ids });
      setStep('done');
    } catch (err) {
      setError(`${err?.response?.data?.message || 'Import failed. Please try again.'}${total.insertedCount ? ` (${total.insertedCount} contacts were already saved.)` : ''}`);
      if (total.insertedCount) onImported?.();
    } finally {
      setLoading(false);
      setProgress({ label: '', percent: 0 });
    }
  };

  const badge = (status) => {
    const style = status === 'valid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : status === 'duplicate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    const Icon = status === 'valid' ? CheckCircle2 : status === 'duplicate' ? Copy : AlertTriangle;
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${style}`}><Icon size={12} />{status}</span>;
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5">
    <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900">
      <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800 sm:px-6">
        <div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Leads workspace</p><h2 className="mt-1 font-display text-xl font-bold text-ink-900 dark:text-white">{step === 'upload' ? 'Upload Data' : step === 'preview' ? 'Review data' : 'Upload complete'}</h2><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Upload contacts once; choose which channel data to keep.</p></div>
        <button onClick={onClose} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-800 dark:hover:bg-ink-800 dark:hover:text-white" aria-label="Close import"><X size={20} /></button>
      </div>

      {error && <div role="alert" className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 sm:mx-6">{error}</div>}

      {step === 'upload' && <div className="overflow-y-auto p-5 sm:p-6">
        <h3 className="mb-2 text-sm font-semibold text-ink-900 dark:text-white">Which contact data are you importing?</h3>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            { value: 'both', title: 'WhatsApp + Email', desc: 'Keep both phone and email when available' },
            { value: 'whatsapp', title: 'Only WhatsApp data', desc: 'Keep names and phone/WhatsApp numbers' },
            { value: 'email', title: 'Only Email data', desc: 'Keep names and email addresses' },
          ].map((option) => <button key={option.value} type="button" onClick={() => setImportChannel(option.value)} className={`rounded-xl border p-3 text-left transition ${importChannel === option.value ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/15 dark:bg-brand-900/20' : 'border-ink-200 hover:border-brand-300 dark:border-ink-700'}`}><span className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">{importChannel === option.value ? <CheckCircle2 size={16} className="text-brand-600"/> : <span className="h-4 w-4 rounded-full border border-ink-300"/>}{option.title}</span><span className="mt-1 block pl-6 text-xs leading-5 text-ink-500 dark:text-ink-400">{option.desc}</span></button>)}
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={loading} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }} className="flex min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 p-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-60 dark:border-ink-700 dark:bg-ink-800/40 dark:hover:bg-ink-800">
          {loading ? <Loader2 size={35} className="animate-spin text-brand-600" /> : <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200"><FileSpreadsheet size={27} /></span>}
          <p className="font-semibold text-ink-900 dark:text-white">{loading ? (progress.label || 'Reading file…') : 'Choose a CSV or Excel file'}</p>{loading ? <span className="mt-3 block h-1.5 w-56 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700"><span className="block h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${progress.percent}%` }} /></span> : <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Click to choose or drag a file here</p>}{!loading && <span className="mt-3 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">.csv · .xlsx</span>}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-400">File size limit: 15 MB. Excel files must be `.xlsx`.</p><button onClick={onClose} className="btn-secondary">Cancel</button></div>
      </div>}

      {step === 'preview' && <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid grid-cols-2 gap-3 border-b border-ink-100 p-5 dark:border-ink-800 sm:grid-cols-4 sm:px-6">{[['Total rows', summary?.total], ['To import', validRows.length], ['Already saved', summary?.duplicate], ['Invalid rows', summary?.invalid]].map(([label, value]) => <div key={label} className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60"><p className="text-xs text-ink-500 dark:text-ink-400">{label}</p><p className="mt-1 font-display text-xl font-bold text-ink-900 dark:text-white">{Number(value || 0).toLocaleString('en-IN')}</p></div>)}</div>
        <div className="border-b border-ink-100 px-5 py-3 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-2"><span>File: <b className="text-ink-700 dark:text-ink-200">{fileName}</b>. Duplicates and invalid rows are skipped.</span><div role="tablist" className="inline-flex rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">{FILTERS.map(([key, label]) => { const n = key === 'all' ? rows.length : rows.filter((row) => row.status === key).length; return <button key={key} type="button" role="tab" aria-selected={rowFilter === key} onClick={() => setRowFilter(key)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${rowFilter === key ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 dark:text-ink-300'}`}>{label} {n}</button>; })}</div></div></div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-3 sm:px-6"><table className="w-full min-w-[1000px] text-sm"><thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-ink-400 dark:bg-ink-900"><tr>{['Row', 'Name', 'Mobile / WhatsApp', 'Email', 'Address', 'Job title', 'Status', 'Note'].map((title) => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead><tbody>{shownRows.slice(0, PREVIEW_LIMIT).map((row) => <tr key={`${row.rowNumber}-${row.email}-${row.phone}`} className="border-t border-ink-100 dark:border-ink-800"><td className="px-3 py-3 text-ink-400">{row.rowNumber}</td><td className="px-3 py-3 font-medium text-ink-800 dark:text-ink-100">{row.name || '—'}</td><td className="whitespace-nowrap px-3 py-3">{row.phone ? <span title={row.rawPhone && row.rawPhone !== row.phone ? `In sheet: ${row.rawPhone}` : undefined}>{formatPhone(row.phone)}</span> : row.rawPhone ? <span className="text-red-600">{row.rawPhone}</span> : '—'}</td><td className="px-3 py-3 text-ink-600 dark:text-ink-300">{row.email || '—'}</td><td className="max-w-[200px] truncate px-3 py-3 text-ink-600 dark:text-ink-300" title={row.address || ''}>{row.address || '—'}</td><td className="px-3 py-3 text-ink-600 dark:text-ink-300">{row.jobTitle || '—'}</td><td className="px-3 py-3">{badge(row.status)}</td><td className="max-w-[280px] px-3 py-3 text-xs text-ink-500">{row.errors?.length ? <span className="text-red-600 dark:text-red-300">{row.errors.join(', ')}</span> : row.duplicateReason ? <span className="text-amber-700 dark:text-amber-300">{row.duplicateReason}</span> : row.warnings?.length ? <span className="text-amber-700 dark:text-amber-300">{row.warnings.join(', ')}</span> : '—'}</td></tr>)}</tbody></table>{shownRows.length > PREVIEW_LIMIT && <p className="py-3 text-center text-xs text-ink-400">Showing first {PREVIEW_LIMIT} rows ({(shownRows.length - PREVIEW_LIMIT).toLocaleString('en-IN')} more). All valid rows will be imported.</p>}{shownRows.length === 0 && <div className="py-12 text-center text-sm text-ink-400">{rows.length ? 'No rows in this filter.' : 'No rows found. Check the column headers in the first row.'}</div>}</div>
        {loading && <div className="border-t border-ink-100 px-5 py-3 dark:border-ink-800 sm:px-6"><p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-ink-600 dark:text-ink-300"><Loader2 size={13} className="animate-spin text-brand-600" />{progress.label || 'Saving…'}</p><div className="h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"><div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${Math.max(progress.percent, 4)}%` }} /></div></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 p-5 dark:border-ink-800 sm:px-6"><p className="text-sm text-ink-500 dark:text-ink-400">{validRows.length.toLocaleString('en-IN')} contacts will be saved ({importChannel === 'both' ? 'WhatsApp + Email' : importChannel === 'whatsapp' ? 'WhatsApp only' : 'Email only'}). <b>No messages are sent yet.</b></p><div className="flex gap-2"><button onClick={() => { setStep('upload'); setRows([]); setSummary(null); setError(''); }} className="btn-secondary flex items-center gap-1.5"><ArrowLeft size={15} /> Choose another file</button><button onClick={importRows} disabled={!validRows.length || loading} className="btn-primary flex items-center gap-2">{loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}{loading ? 'Saving…' : `Import ${validRows.length.toLocaleString('en-IN')} contacts`}</button></div></div>
      </div>}

      {step === 'done' && <div className="overflow-y-auto p-6 sm:p-8">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 size={32} /></span>
          <h3 className="mt-4 font-display text-xl font-bold text-ink-900 dark:text-white">Upload complete</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500 dark:text-ink-400"><b>{Number(result?.insertedCount || 0).toLocaleString('en-IN')}</b> new contacts saved{result?.skipped ? `, ${result.skipped} already existed` : ''}.</p>
        </div>
        <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-900 dark:bg-brand-950/20">
          <p className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white"><CalendarClock size={18} className="text-brand-600" /> Schedule a message for these {(result?.ids?.length || 0).toLocaleString('en-IN')} contacts?</p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Pick a date, time and pace. The campaign will appear on the Campaigns page.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={!result?.ids?.length || importChannel === 'email'} onClick={() => setLauncher('whatsapp')} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
              <MessageCircle size={17} /> {scheduled.whatsapp ? 'WhatsApp scheduled ✓' : 'Schedule on WhatsApp'}
            </button>
            <button type="button" disabled={!result?.ids?.length || importChannel === 'whatsapp'} onClick={() => setLauncher('email')} className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40">
              <Mail size={17} /> {scheduled.email ? 'Email scheduled ✓' : 'Schedule email'}
            </button>
          </div>
          <button type="button" onClick={onClose} className="mt-3 w-full text-center text-sm font-semibold text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">Not now</button>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2"><button onClick={onClose} className="btn-secondary">Close</button><button onClick={() => { onClose(); window.location.assign('/outreach/whatsapp'); }} className="btn-secondary flex items-center gap-2"><Users size={16} /> View campaigns</button></div>
      </div>}
    </div>
    {launcher && <CampaignLauncher key={launcher} channel={launcher} initialLeadIds={result?.ids || []} lockSelection initialName={`${fileName.replace(/\.(csv|xlsx)$/i, '')} · ${launcher === 'whatsapp' ? 'WhatsApp' : 'Email'}`.slice(0, 120)} onClose={() => setLauncher(null)} onLaunched={() => { setScheduled((p) => ({ ...p, [launcher]: true })); setTimeout(() => setLauncher(null), 900); }} />}
  </div>;
}
