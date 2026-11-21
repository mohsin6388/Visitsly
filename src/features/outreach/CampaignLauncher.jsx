import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, MessageCircle, Mail, Plus, Send, Users, X, CalendarClock, Zap, Trash2 } from 'lucide-react';
import { toast, confirmDelete } from '../../components/ui/index.jsx';
import { leadApi } from '../../api/leadApi.js';
import { audienceApi } from '../../api/audienceApi.js';
import SaveAudienceModal from '../audiences/SaveAudienceModal.jsx';
import ContactSheetPicker from './ContactSheetPicker.jsx';
import WhatsAppPreview, { partsFromTemplate } from '../../components/WhatsAppPreview.jsx';
import { downloadSampleSheet } from '../../lib/sampleSheet.js';
import { campaignApi } from '../../api/outreachApi.js';
import { whatsappApi } from '../../api/whatsappApi.js';
import { emailApi } from '../../api/emailApi.js';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

function getTemplateVars(template) {
  const body = (template?.components || []).find((item) => String(item.type).toUpperCase() === 'BODY');
  const text = String(body?.text || '');
  const indexes = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1]));
  return [...new Set(indexes)].sort((a, b) => a - b);
}

function templateHasImageHeader(template) {
  const header = (template?.components || []).find((item) => String(item.type).toUpperCase() === 'HEADER');
  return String(header?.format || '').toUpperCase() === 'IMAGE';
}


const SOURCES = [
  { key: 'sheet', label: 'Contacts sheet' },
  { key: 'audience', label: 'Saved audience' },
  { key: 'upload', label: 'Upload new sheet' },
];

const pad = (n) => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localDate(d);
}
/** The server schedules in India time; convert the user's local date/time to IST. */
function toIst(dateStr, timeStr) {
  const at = dateStr ? new Date(`${dateStr}T${timeStr || '10:00'}:00`) : new Date();
  const ist = new Date(at.getTime() + 330 * 60000);
  return { startDate: ist.toISOString().slice(0, 10), sendTime: ist.toISOString().slice(11, 16) };
}
const prettyDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '');
const prettyTime = (t) => { const [h, m] = String(t || '10:00').split(':').map(Number); return `${(h % 12) || 12}:${pad(m || 0)} ${h >= 12 ? 'PM' : 'AM'}`; };

/** Step 3 — send now, or schedule: start date and time, contacts per day and number of days. */
export function schedulePlan(count, schedule) {
  const perDay = Math.max(0, Math.min(5000, Math.floor(Number(schedule.perDay) || 0)));
  const daysWanted = Math.max(0, Math.min(365, Math.floor(Number(schedule.days) || 0)));
  if (!perDay || !daysWanted) return { perDay, daysWanted, valid: false };
  const capacity = perDay * daysWanted;
  const willSend = Math.min(count, capacity);
  const daysUsed = Math.max(1, Math.ceil(willSend / perDay));
  return { perDay, daysWanted, capacity, willSend, left: Math.max(0, count - capacity), daysUsed, endDate: addDays(schedule.date, daysUsed - 1), valid: true };
}

function ScheduleBox({ count, schedule, setSchedule }) {
  const set = (patch) => setSchedule((s) => ({ ...s, ...patch }));
  const plan = schedulePlan(count, schedule);
  const n = (v) => Number(v || 0).toLocaleString('en-IN');
  return (
    <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
      <h3 className="text-sm font-bold text-ink-900 dark:text-white">Step 3 · When to send?</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[['now', 'Send now', Zap], ['later', 'Schedule', CalendarClock]].map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => set({ mode: key })} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${schedule.mode === key ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/15 dark:bg-brand-900/20 dark:text-brand-100' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {schedule.mode === 'later' && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Start date
            <input type="date" className="input-field mt-1" min={localDate()} value={schedule.date} onChange={(e) => set({ date: e.target.value })} required />
          </label>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Start time
            <input type="time" className="input-field mt-1" value={schedule.time} onChange={(e) => set({ time: e.target.value })} required />
          </label>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Contacts per day
            <input type="number" inputMode="numeric" min={1} max={5000} className="input-field mt-1" placeholder="e.g. 100" value={schedule.perDay} onChange={(e) => set({ perDay: e.target.value.replace(/[^\d]/g, '') })} required />
          </label>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">Number of days
            <input type="number" inputMode="numeric" min={1} max={365} className="input-field mt-1" placeholder="e.g. 5" value={schedule.days} onChange={(e) => set({ days: e.target.value.replace(/[^\d]/g, '') })} required />
          </label>
        </div>
      )}
      <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-5 text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
        {schedule.mode === 'now'
          ? (count ? `${n(count)} contacts · sending starts right away, one message at a time.` : 'Select contacts to send to.')
          : !count ? 'Select contacts first.'
          : !plan.valid ? 'Enter contacts per day and number of days.'
          : <>
            Starts {prettyDate(schedule.date)}, {prettyTime(schedule.time)} · {n(plan.perDay)}/day · ends {prettyDate(plan.endDate)} ({plan.daysUsed} {plan.daysUsed === 1 ? 'day' : 'days'}).
            {' '}<b>{n(plan.willSend)}</b> of {n(count)} contacts will be messaged.
            {plan.daysUsed < plan.daysWanted && <> All contacts fit in {plan.daysUsed} {plan.daysUsed === 1 ? 'day' : 'days'}, so it stops early — no empty days.</>}
          </>}
      </p>
      {schedule.mode === 'later' && plan.valid && plan.left > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {n(plan.left)} selected contacts won’t be messaged ({n(plan.perDay)} × {plan.daysWanted} days = {n(plan.capacity)}). Increase contacts per day or days to include them.
        </p>
      )}
    </div>
  );
}

export default function CampaignLauncher({ channel, onClose, onLaunched, initialTemplate = '', initialLeadIds = null, initialName = '', lockSelection = false, defaultMode = '', lockLabel = '', zIndex = 50 }) {
  const isWhatsApp = channel === 'whatsapp';
  const [schedule, setSchedule] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return { mode: defaultMode || (initialLeadIds ? 'later' : 'now'), date: localDate(d), time: `${pad(d.getHours())}:00`, perDay: '', days: '' };
  });
  const [source, setSource] = useState('sheet');
  const [fileFilter, setFileFilter] = useState('');
  const [sheetRefresh, setSheetRefresh] = useState(0);
  const [audiences, setAudiences] = useState([]);
  const [audiencesLoading, setAudiencesLoading] = useState(false);
  const [audienceId, setAudienceId] = useState('');
  const [audienceInfo, setAudienceInfo] = useState(null); // { ready, total, skippedSent }
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [uploadState, setUploadState] = useState({ loading: false, fileName: '', result: null, error: '' });
  const [saveUploadAsAudience, setSaveUploadAsAudience] = useState(true);
  const [showSaveAudience, setShowSaveAudience] = useState(false);
  const [campaignName, setCampaignName] = useState(initialName || `${isWhatsApp ? 'WhatsApp' : 'Email'} campaign ${new Date().toLocaleDateString('en-IN')}`);
  const [selected, setSelected] = useState(() => (initialLeadIds ? Object.fromEntries(initialLeadIds.map((id) => [String(id), true])) : {}));
  const [rowsError, setRowsError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [emailAccount, setEmailAccount] = useState(null);
  useEffect(() => { if (!isWhatsApp) emailApi.account().then((r) => setEmailAccount(r.data.account)).catch(() => setEmailAccount({ connected: false })); }, [isWhatsApp]);
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [launchMessage, setLaunchMessage] = useState('');
  const [previewLead, setPreviewLead] = useState(null);
  // Multi-number plans: which company number sends this campaign.
  const waInfo = useAuthStore((st) => st.org?.whatsapp);
  const extraNumbers = waInfo?.extraNumbers || [];
  const [fromNumber, setFromNumber] = useState('');

  const selectedTemplate = useMemo(() => templates.find((item) => `${item.name}::${item.language}` === templateName) || null, [templates, templateName]);
  const selectedEmailTemplate = useMemo(() => emailTemplates.find((item) => String(item._id) === emailTemplateId) || null, [emailTemplates, emailTemplateId]);
  const variableIndexes = useMemo(() => getTemplateVars(selectedTemplate), [selectedTemplate]);
  const previewValues = useMemo(() => {
    const max = Math.max(0, ...variableIndexes);
    return Array.from({ length: max }, (_, i) => {
      const config = templateVariables[i + 1] || { source: 'name', value: '' };
      if (config.source === 'static') return config.value || '';
      const lead = previewLead || { name: 'Ayush', phone: '919876543210', email: 'ayush@example.com' };
      return lead[config.source] || (config.source === 'name' ? 'Sir/Ma\'am' : '');
    });
  }, [variableIndexes, templateVariables, previewLead]);
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  // Preview the message the way the first selected contact will see it.
  const firstSelectedId = selectedIds[0] || '';
  useEffect(() => {
    if (!firstSelectedId) { setPreviewLead(null); return; }
    let active = true;
    leadApi.get(firstSelectedId).then((res) => { if (active) setPreviewLead(res.data.lead || null); }).catch(() => { if (active) setPreviewLead(null); });
    return () => { active = false; };
  }, [firstSelectedId]);


  useEffect(() => {
    if (isWhatsApp) return;
    let active = true;
    setTemplatesLoading(true);
    setTemplatesError('');
    emailApi.templates().then((response) => {
      if (!active) return;
      const items = response.data.templates || [];
      setEmailTemplates(items);
      if (!items.length) setTemplatesError('No email templates yet. Create one in Email → Templates first.');
    }).catch((err) => {
      if (active) setTemplatesError(err?.response?.data?.message || 'Could not load email templates.');
    }).finally(() => { if (active) setTemplatesLoading(false); });
    return () => { active = false; };
  }, [isWhatsApp]);

  useEffect(() => {
    if (!selectedEmailTemplate) return;
    setEmailSubject(selectedEmailTemplate.subject || '');
    setEmailBody(selectedEmailTemplate.body || '');
  }, [selectedEmailTemplate]);

  useEffect(() => {
    if (!isWhatsApp) return;
    let active = true;
    setTemplatesLoading(true);
    setTemplatesError('');
    whatsappApi.templates().then((response) => {
      if (!active) return;
      const items = response.data.templates || [];
      setTemplates(items);
      const wanted = items.find((item) => `${item.name}::${item.language}` === initialTemplate || item.name === initialTemplate);
      if (wanted) setTemplateName(`${wanted.name}::${wanted.language}`);
      else if (items.length) setTemplateName(`${items[0].name}::${items[0].language}`);
      else setTemplatesError('No approved templates found. Get a template approved in Meta WhatsApp Manager.');
    }).catch((err) => {
      if (active) setTemplatesError(err?.response?.data?.message || 'Could not load approved templates. Check your WhatsApp connection.');
    }).finally(() => { if (active) setTemplatesLoading(false); });
    return () => { active = false; };
  }, [isWhatsApp, initialTemplate]);


  // Saved audiences for this channel
  const loadAudiences = useCallback(async () => {
    setAudiencesLoading(true);
    try {
      const response = await audienceApi.list();
      setAudiences(response.data.audiences || []);
    } catch (err) {
      setRowsError(err?.response?.data?.message || 'Could not load saved audiences.');
    } finally { setAudiencesLoading(false); }
  }, []);
  useEffect(() => { loadAudiences(); }, [loadAudiences]);

  // Picking an audience fills the selection with its contacts that are ready for this channel.
  useEffect(() => {
    if (source !== 'audience' || !audienceId) return;
    let active = true;
    setAudienceInfo(null);
    audienceApi.leads(audienceId, { channel, excludeSent: skipAlreadySent ? 1 : 0 }).then((response) => {
      if (!active) return;
      const ids = response.data.leadIds || [];
      setSelected(Object.fromEntries(ids.map((id) => [id, true])));
      setAudienceInfo({ ready: response.data.ready, total: response.data.total, skippedSent: response.data.skippedSent });
    }).catch((err) => { if (active) setLaunchError(err?.response?.data?.message || 'Could not load audience contacts.'); });
    return () => { active = false; };
  }, [source, audienceId, skipAlreadySent, channel]);

  const switchSource = (key) => {
    setSource(key);
    if (key !== 'sheet') setFileFilter('');
    setSelected({});
    setAudienceId('');
    setAudienceInfo(null);
    setLaunchError('');
  };

  // Upload a new sheet: save contacts (new + already existing) and select them.
  const handleSheet = async (file) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) { setUploadState({ loading: false, fileName: '', result: null, error: 'Choose a CSV or Excel (.xlsx) file.' }); return; }
    setUploadState({ loading: true, fileName: file.name, result: null, error: '' });
    try {
      const preview = await leadApi.importPreview(file, isWhatsApp ? 'whatsapp' : 'email');
      const usable = (preview.data.rows || []).filter((row) => row.status !== 'invalid' && (isWhatsApp ? row.phone : row.email));
      if (!usable.length) throw new Error(`No valid contacts with ${isWhatsApp ? 'a WhatsApp number' : 'an email'} in this sheet.`);
      const confirm = await leadApi.importConfirm(usable.map(({ status, errors, warnings, isDuplicate, duplicateReason, rowNumber, rawPhone, ...row }) => ({ ...row, source: 'bulk_sheet_upload', importFile: file.name })));
      const ids = [...new Set([...(confirm.data.leadIds || []), ...(confirm.data.existingLeadIds || [])].map(String))];
      setSelected(Object.fromEntries(ids.map((id) => [id, true])));
      let savedAudience = null;
      if (saveUploadAsAudience && ids.length) {
        try {
          const name = `${file.name.replace(/\.(csv|xlsx)$/i, '')} · ${new Date().toLocaleDateString('en-IN')}`.slice(0, 120);
          savedAudience = (await audienceApi.create({ name, source: 'upload', leadIds: ids })).data.audience;
          loadAudiences();
        } catch { /* audience name clash etc. — contacts are still selected */ }
      }
      // Show the uploaded sheet in the Contacts sheet with its rows already ticked.
      setFileFilter(confirm.data.insertedCount ? file.name : '');
      setSheetRefresh((n) => n + 1);
      setSource('sheet');
      setUploadState({
        loading: false,
        fileName: file.name,
        error: '',
        result: { rows: preview.data.summary?.total || usable.length, ready: ids.length, inserted: confirm.data.insertedCount || 0, invalid: preview.data.summary?.invalid || 0, audienceName: savedAudience?.name || '' },
      });
    } catch (err) {
      setSelected({});
      setUploadState({ loading: false, fileName: file.name, result: null, error: err?.response?.data?.message || err.message || 'Sheet upload failed.' });
    }
  };
  useEffect(() => { setTemplateVariables({}); setHeaderImageUrl(selectedTemplate?.imageUrl || ''); }, [templateName, selectedTemplate?.imageUrl]);


  const validate = () => {
    if (!campaignName.trim()) return 'Enter a campaign name.';
    if (!selectedIds.length) return 'Select at least one contact.';
    if (selectedIds.length > 5000) return 'A campaign can have up to 5,000 contacts.';
    if (schedule.mode === 'later') {
      if (!schedule.date || !schedule.time) return 'Choose a start date and time.';
      if (!(Number(schedule.perDay) >= 1)) return 'Enter how many contacts to message per day.';
      if (!(Number(schedule.days) >= 1)) return 'Enter for how many days the campaign runs.';
      const at = new Date(`${schedule.date}T${schedule.time}:00`);
      if (Number.isNaN(at.getTime())) return 'Invalid date or time.';
      if (at.getTime() < Date.now() - 2 * 60 * 1000) return 'That time has passed — pick a later time or choose "Send now".';
    }
    if (isWhatsApp) {
      if (!selectedTemplate) return 'Select an approved template.';
      if (templateHasImageHeader(selectedTemplate) && !headerImageUrl.trim()) return 'This template needs a public image URL for its header.';
      for (const index of variableIndexes) {
        const config = templateVariables[index] || { source: 'name', value: '' };
        if (config.source === 'static' && !String(config.value || '').trim()) return `Fill in template variable {{${index}}}.`;
      }
    } else {
      if (!selectedEmailTemplate) return 'Select a saved email template.';
      if (!emailSubject.trim()) return 'The selected template has no subject.';
      if (!emailBody.trim()) return 'The selected template has no message.';
    }
    return '';
  };

  const blocker = validate();

  const removeAudience = async (item) => {
    if (!(await confirmDelete(`audience "${item.name}"`, 'Only the saved list is deleted. The contacts stay in Upload Data.'))) return;
    try {
      await audienceApi.remove(item._id);
      if (audienceId === item._id) { setAudienceId(''); setSelected({}); setAudienceInfo(null); }
      setAudiences((list) => list.filter((a) => a._id !== item._id));
      toast.success('Audience deleted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not delete the audience');
    }
  };

  const launch = async (event) => {
    event.preventDefault();
    setLaunchError('');
    setLaunchMessage('');
    const validation = validate();
    if (validation) { setLaunchError(validation); return; }
    setLaunching(true);
    try {
      const payload = {
        name: campaignName.trim(),
        leadIds: selectedIds,
        ...(source === 'audience' && audienceId ? { audienceId } : {}),
        channels: { whatsapp: isWhatsApp, email: !isWhatsApp },
        ...(schedule.mode === 'later'
          ? { dailyLimit: Math.min(5000, Math.max(1, Number(schedule.perDay))), durationDays: Math.min(365, Math.max(1, Number(schedule.days))), ...toIst(schedule.date, schedule.time) }
          : { dailyLimit: 5000, ...toIst(null) }),
      };
      if (isWhatsApp) {
        payload.whatsappTemplateName = selectedTemplate.name;
        if (fromNumber) payload.phoneNumberId = fromNumber;
        payload.whatsappTemplateLanguage = selectedTemplate.language || 'en_US';
        payload.whatsappTemplateCategory = selectedTemplate.category || '';
        payload.whatsappTemplateHeaderImageUrl = headerImageUrl.trim();
        payload.whatsappTemplateBody = (selectedTemplate.components || []).find((item) => String(item.type).toUpperCase() === 'BODY')?.text || selectedTemplate.bodyText || '';
        const parts = partsFromTemplate(selectedTemplate);
        payload.whatsappTemplateHeader = parts.headerText || '';
        payload.whatsappTemplateFooter = parts.footer || '';
        payload.whatsappTemplateButtons = parts.buttons.map((button) => button.text).filter(Boolean);
        payload.whatsappTemplateVariables = variableIndexes.map((index) => ({
          index,
          source: templateVariables[index]?.source || 'name',
          value: templateVariables[index]?.value || '',
        }));
      } else {
        payload.emailTemplateId = selectedEmailTemplate._id;
        payload.emailSubject = emailSubject.trim();
        payload.emailBody = emailBody.trim();
      }
      const response = await campaignApi.launch(payload);
      const queued = response.data?.queued || {};
      const count = isWhatsApp ? queued.whatsapp : queued.email;
      const notScheduled = response.data?.notScheduled || 0;
      const msg = schedule.mode === 'later'
        ? `Campaign scheduled: ${count || 0} ${isWhatsApp ? 'WhatsApp' : 'email'} messages from ${prettyDate(schedule.date)} ${prettyTime(schedule.time)}.${notScheduled ? ` ${notScheduled} contacts didn't fit in the days chosen.` : ''}`
        : `${count || 0} ${isWhatsApp ? 'WhatsApp' : 'email'} messages queued.`;
      setLaunchMessage(msg);
      toast.success(msg);
      onLaunched?.(response.data);
      setTimeout(() => onClose?.(), 1000);
    } catch (err) {
      setLaunchError(err?.response?.data?.message || 'Could not start the campaign. Check settings and selected contacts.');
    } finally {
      setLaunching(false);
    }
  };

  return <div style={{ zIndex }} className="fixed inset-0 flex items-center justify-center bg-black/50 p-2 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !launching) onClose?.(); }}>
    <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900">
      <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-4 dark:border-ink-800 sm:p-5">
        <div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isWhatsApp ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>{isWhatsApp ? <MessageCircle size={21} /> : <Mail size={21} />}</span><div><h2 className="font-display text-xl font-bold text-ink-900 dark:text-white">Create {isWhatsApp ? 'WhatsApp' : 'Email'} campaign</h2><p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Pick contacts, preview, and send.</p></div></div>
        <button disabled={launching} onClick={onClose} aria-label="Close campaign launcher" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"><X size={20} /></button>
      </div>

      <form onSubmit={launch} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {!isWhatsApp && emailAccount && !emailAccount.connected && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Connect your email first. <Link to="/email/setup" className="font-semibold underline">Email setup</Link></div>}
          {(launchError || rowsError || templatesError) && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><div>{launchError || rowsError || templatesError}</div></div>}
          {launchMessage && <div className="mb-4 flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{launchMessage}</div>}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="min-w-0 space-y-3">
              <div><label className="mb-1.5 block text-sm font-semibold text-ink-800 dark:text-ink-100">Campaign name</label><input className="input-field" maxLength={120} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Diwali property offer" /></div>
              {lockSelection ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <p className="font-semibold">Step 1 · Who gets it?</p>
                  <p className="mt-1 flex items-center gap-2"><Users size={15} /> {lockLabel || <><b>{selectedIds.length.toLocaleString('en-IN')}</b> uploaded contacts selected.</>}</p>
                </div>
              ) : <>
              <div className="rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Step 1 · Who gets it?</p><p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{selectedIds.length.toLocaleString('en-IN')} contacts selected</p></div>
                  <div role="tablist" aria-label="Contacts source" className="inline-flex shrink-0 flex-wrap rounded-lg bg-ink-100 p-1 dark:bg-ink-800">{SOURCES.map((item) => <button key={item.key} type="button" role="tab" aria-selected={source === item.key} onClick={() => switchSource(item.key)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${source === item.key ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 dark:text-ink-300'}`}>{item.label}</button>)}</div>
                </div>
              </div>

              {source === 'audience' && <div className="space-y-2">
                {audiencesLoading ? <div className="flex items-center gap-2 rounded-xl border border-ink-100 p-4 text-sm text-ink-500 dark:border-ink-800"><Loader2 size={16} className="animate-spin" /> Loading audiences…</div>
                  : audiences.length === 0 ? <div className="rounded-xl border border-dashed border-ink-200 p-5 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400"><Users size={24} className="mx-auto mb-2 text-ink-300" />No saved audiences. <button type="button" onClick={() => switchSource('sheet')} className="font-semibold text-brand-600 hover:underline">Pick from contacts</button> or <button type="button" onClick={() => switchSource('upload')} className="font-semibold text-brand-600 hover:underline">upload a sheet</button>.</div>
                  : <div role="radiogroup" aria-label="Saved audiences" className="max-h-[320px] space-y-2 overflow-y-auto pr-1">{audiences.map((item) => { const ready = isWhatsApp ? item.counts?.whatsapp : item.counts?.email; const active = audienceId === item._id; return <div key={item._id} role="radio" tabIndex={0} aria-checked={active} onClick={() => setAudienceId(item._id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setAudienceId(item._id))} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/15 dark:bg-brand-900/20' : 'border-ink-200 hover:border-brand-300 dark:border-ink-700'}`}>{active ? <CheckCircle2 size={18} className="shrink-0 text-brand-600" /> : <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-ink-300" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-900 dark:text-white">{item.name}</span><span className="block truncate text-xs text-ink-500 dark:text-ink-400">{item.source === 'upload' ? 'Sheet upload' : item.source === 'filter' ? 'Filter' : 'Selected contacts'}{item.tags?.length ? ` · ${item.tags.join(', ')}` : ''}{item.lastUsedAt ? ` · last used ${new Date(item.lastUsedAt).toLocaleDateString('en-IN')}` : ''}</span></span><span className="text-right"><span className="block font-display text-base font-bold text-ink-900 dark:text-white">{Number(ready || 0).toLocaleString('en-IN')}</span><span className="block text-[10px] text-ink-400">{isWhatsApp ? 'WhatsApp' : 'Email'} ready</span></span><button type="button" onClick={(e) => { e.stopPropagation(); removeAudience(item); }} className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label={`Delete audience ${item.name}`} title="Delete audience"><Trash2 size={15} /></button></div>; })}</div>}
                {audienceId && <label className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800/60 dark:text-ink-300"><input type="checkbox" checked={skipAlreadySent} onChange={(e) => setSkipAlreadySent(e.target.checked)} />Skip contacts already sent {isWhatsApp ? 'WhatsApp' : 'email'}{audienceInfo ? ` · ${audienceInfo.ready} ready${audienceInfo.skippedSent ? `, ${audienceInfo.skippedSent} skip` : ''}` : ''}</label>}
              </div>}

              {source === 'sheet' && <>
                {uploadState.result && <div className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200"><p className="font-semibold">{uploadState.fileName}: {uploadState.result.ready} contacts selected</p><p className="mt-0.5 text-xs">{uploadState.result.inserted} new{uploadState.result.ready - uploadState.result.inserted > 0 ? `, ${uploadState.result.ready - uploadState.result.inserted} existing` : ''}.{uploadState.result.audienceName ? ` Saved as audience "${uploadState.result.audienceName}".` : ''}</p></div>}
                <ContactSheetPicker channel={channel} selected={selected} setSelected={setSelected} fileFilter={fileFilter} setFileFilter={setFileFilter} refreshKey={sheetRefresh} onSaveAudience={() => setShowSaveAudience(true)} />
              </>}

              {source === 'upload' && <div className="space-y-3">
                <label className={`flex min-h-[170px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 p-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-ink-700 dark:bg-ink-800/40 ${uploadState.loading ? 'pointer-events-none opacity-60' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleSheet(event.dataTransfer.files?.[0]); }}>
                  {uploadState.loading ? <Loader2 size={30} className="animate-spin text-brand-600" /> : <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200"><FileSpreadsheet size={24} /></span>}
                  <span className="font-semibold text-ink-900 dark:text-white">{uploadState.loading ? 'Reading sheet…' : 'Choose a CSV or Excel sheet'}</span>
                  <span className="mt-1 text-xs text-ink-500 dark:text-ink-400">Name, Mobile / WhatsApp, Email address, Address, Job title</span>
                  <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { handleSheet(event.target.files?.[0]); event.target.value = ''; }} />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><label className="flex items-center gap-2 text-ink-600 dark:text-ink-300"><input type="checkbox" checked={saveUploadAsAudience} onChange={(e) => setSaveUploadAsAudience(e.target.checked)} />Also save as an audience</label><button type="button" onClick={downloadSampleSheet} className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline"><Download size={13} /> Sample sheet</button></div>
                {uploadState.error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{uploadState.error}</div>}
                {uploadState.result && <div className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} /> {uploadState.fileName}: {uploadState.result.ready} contacts selected</p><p className="mt-1 text-xs">{uploadState.result.inserted} new contacts added{uploadState.result.invalid ? `, ${uploadState.result.invalid} invalid rows skipped` : ''}.{uploadState.result.audienceName ? ` Saved as audience "${uploadState.result.audienceName}".` : ''}</p></div>}
              </div>}
              </>}
            </section>

            <section className="space-y-4">
              {isWhatsApp ? <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
                <div className="mb-3 flex items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-ink-900 dark:text-white">Step 2 · Approved Meta template</h3><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Needed for the first message.</p></div>{templatesLoading ? <Loader2 size={17} className="animate-spin text-brand-600" /> : <Link to="/whatsapp/templates?new=1" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"><Plus size={13} /> New template · approval</Link>}</div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Choose template</label><select value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="input-field" disabled={templatesLoading || !templates.length}><option value="">Select an approved template</option>{templates.map((item) => <option key={`${item.name}::${item.language}`} value={`${item.name}::${item.language}`}>{item.name} · {item.language} · {item.category || 'Template'}</option>)}</select>
                {extraNumbers.length > 0 && <label className="mt-3 block text-xs font-semibold text-ink-600 dark:text-ink-300">Send from<select className="input-field mt-1" value={fromNumber} onChange={(e) => setFromNumber(e.target.value)}><option value="">{waInfo?.displayPhoneNumber || 'Main number'} (main)</option>{extraNumbers.map((n) => <option key={n.phoneNumberId} value={n.phoneNumberId}>{n.displayPhoneNumber || n.phoneNumberId}{n.label ? ` — ${n.label}` : ''}</option>)}</select></label>}
                {selectedTemplate && <div className="mt-3"><div className="mb-2 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Approved</span><span className="rounded-full bg-ink-200 px-2 py-1 text-[10px] font-semibold text-ink-600 dark:bg-ink-700 dark:text-ink-300">{selectedTemplate.language}</span></div><WhatsAppPreview {...partsFromTemplate(selectedTemplate)} imageUrl={headerImageUrl || selectedTemplate.imageUrl || ''} values={previewValues} caption={previewLead ? `How ${previewLead.name || 'the first contact'} will see it` : 'Select a contact to preview with their name'} /></div>}
                {variableIndexes.length > 0 && <div className="mt-4 space-y-3"><p className="text-xs font-semibold text-ink-700 dark:text-ink-200">Template variables</p>{variableIndexes.map((index) => <div key={index} className="grid grid-cols-[100px_minmax(0,1fr)] gap-2"><div className="flex items-center text-xs font-semibold text-ink-500">{'{{'}{index}{'}}'}</div><div className="flex flex-col gap-2 sm:flex-row"><select className="input-field" value={templateVariables[index]?.source || 'name'} onChange={(e) => setTemplateVariables((previous) => ({ ...previous, [index]: { ...previous[index], source: e.target.value } }))}><option value="name">Lead name</option><option value="phone">Mobile number</option><option value="email">Email address</option><option value="static">Custom text</option></select>{templateVariables[index]?.source === 'static' && <input className="input-field" maxLength={1000} value={templateVariables[index]?.value || ''} onChange={(e) => setTemplateVariables((previous) => ({ ...previous, [index]: { ...previous[index], source: 'static', value: e.target.value } }))} placeholder="Variable value" />}</div></div>)}</div>}
                {selectedTemplate && templateHasImageHeader(selectedTemplate) && <div className="mt-3"><label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">Image header URL</label><input type="url" className="input-field" value={headerImageUrl} onChange={(e) => setHeaderImageUrl(e.target.value)} placeholder="https://.../property-offer.jpg" /><p className="mt-1 text-[11px] text-ink-400">Template image is prefilled. A public HTTPS image URL is required by Meta Cloud API.</p></div>}
              </div> : <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-ink-900 dark:text-white">Step 2 · Choose email template</h3><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Personalized for each contact.</p></div><Link to="/email/templates" className="shrink-0 text-xs font-semibold text-brand-600 hover:underline">Manage templates</Link></div><label className="mb-1.5 mt-4 block text-xs font-semibold text-ink-600 dark:text-ink-300">Template</label><select className="input-field" value={emailTemplateId} onChange={(e) => setEmailTemplateId(e.target.value)} disabled={templatesLoading || !emailTemplates.length}><option value="">Select a saved email template</option>{emailTemplates.map((item) => <option key={item._id} value={item._id}>{item.name} · {item.category || 'General'}</option>)}</select>{selectedEmailTemplate ? <div className="mt-3 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/70"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Subject preview</p><p className="mt-1 text-sm font-semibold text-ink-800 dark:text-ink-100">{selectedEmailTemplate.subject}</p>{selectedEmailTemplate.imageUrl && <img src={selectedEmailTemplate.imageUrl} alt="Email template" className="mt-3 max-h-52 w-full rounded-lg object-contain bg-white"/>}<p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-ink-400">Message preview</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-700 dark:text-ink-200">{selectedEmailTemplate.body}</p><p className="mt-2 text-[11px] text-ink-400">Variables such as {'{{name}}'} are filled per recipient.</p></div> : <div className="mt-3 rounded-lg border border-dashed border-ink-200 p-4 text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">{templatesLoading ? 'Loading saved email templates…' : 'Create a template in Email → Templates first.'}</div>}</div>}

              <ScheduleBox count={selectedIds.length} schedule={schedule} setSchedule={setSchedule} />
            </section>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/70 px-4 py-3 dark:border-ink-800 dark:bg-ink-900 sm:px-5"><p className="text-xs text-ink-500 dark:text-ink-400"><b className="text-ink-800 dark:text-ink-100">{selectedIds.length.toLocaleString('en-IN')}</b> contacts · {blocker ? <span className="text-amber-700 dark:text-amber-300">{blocker}</span> : schedule.mode === 'later' ? `Starts ${prettyDate(schedule.date)} ${prettyTime(schedule.time)}.` : 'Starts right away.'}</p><div className="flex gap-2"><button type="button" onClick={onClose} disabled={launching} className="btn-secondary">Cancel</button><button type="submit" disabled={launching || templatesLoading || Boolean(blocker)} title={blocker || undefined} className="btn-primary flex items-center gap-2 disabled:opacity-50">{launching ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{launching ? 'Saving…' : schedule.mode === 'later' ? 'Schedule campaign' : 'Start campaign'}</button></div></div>
      </form>
    </div>
    {showSaveAudience && <SaveAudienceModal leadIds={selectedIds} source="selection" onClose={() => setShowSaveAudience(false)} onSaved={(audience) => { setShowSaveAudience(false); setLaunchMessage(`Audience "${audience.name}" saved.`); loadAudiences(); }} />}
  </div>;
}
