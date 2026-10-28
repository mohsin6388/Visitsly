import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Webhook,
  XCircle,
} from 'lucide-react';

import { whatsappApi } from '../../api/whatsappApi.js';
import { orgApi } from '../../api/saasApi.js';
import api from '../../api/axios.js';
import ConnectWhatsApp from './ConnectWhatsApp.jsx';
import { useAuthStore, useOrgRole } from '../../store/authStore.js';

function getWebhookUrl() {
  const base = api.defaults.baseURL || window.location.origin;
  return `${base.replace(/\/api\/?$/, '')}/api/whatsapp/webhook`;
}

function unwrapError(err, fallback) {
  const metaError = err?.response?.data?.data?.metaError;
  return metaError?.error_user_msg || metaError?.message || err?.response?.data?.message || err?.message || fallback;
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusPill({ tone = 'neutral', children }) {
  const styles = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone] || styles.neutral}`}>{children}</span>;
}

function CardHeading({ icon: Icon, title, description, right }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><Icon size={20} /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">{title}</h2>
          {description && <p className="mt-1 text-sm leading-5 text-ink-500 dark:text-ink-400">{description}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function variableIndexes(text = '') {
  return [...new Set([...String(text).matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);
}

function componentText(template, type) {
  return (template?.components || []).find((component) => String(component.type).toUpperCase() === type)?.text || '';
}

function templateTestSupport(template) {
  const header = (template?.components || []).find((component) => String(component.type).toUpperCase() === 'HEADER');
  return !header || !header.format || String(header.format).toUpperCase() === 'TEXT';
}

export default function WhatsAppPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsError, setDiagnosticsError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');
  const [pageError, setPageError] = useState('');
  const [healthNotice, setHealthNotice] = useState('');
  const [repairing, setRepairing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [headerSampleValues, setHeaderSampleValues] = useState([]);
  const [bodySampleValues, setBodySampleValues] = useState([]);
  const [confirmRecipient, setConfirmRecipient] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testNotice, setTestNotice] = useState('');
  const [testError, setTestError] = useState('');
  const [copied, setCopied] = useState(false);

  const webhookUrl = useMemo(() => getWebhookUrl(), []);
  const location = useLocation();
  const support = useAuthStore((state) => state.support);
  const setOrg = useAuthStore((state) => state.setOrg);
  const role = useOrgRole();
  const canManage = role === 'owner' || role === 'manager';

  const fetchData = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setLoading(true);
      setTemplatesLoading(true);
    }
    setRefreshing(true);
    setPageError('');
    setHealthNotice('');

    const [statusResult, diagnosticsResult, templatesResult] = await Promise.allSettled([
      whatsappApi.status(),
      whatsappApi.diagnostics(),
      whatsappApi.templates(),
    ]);

    if (statusResult.status === 'fulfilled') {
      setStatusData(statusResult.value?.data || null);
    } else {
      setPageError(unwrapError(statusResult.reason, 'WhatsApp connection status load nahi hua.'));
    }

    if (diagnosticsResult.status === 'fulfilled') {
      setDiagnostics(diagnosticsResult.value?.data || null);
      setDiagnosticsError('');
    } else {
      setDiagnostics(null);
      setDiagnosticsError(unwrapError(diagnosticsResult.reason, 'Meta health check complete nahi hua.'));
    }

    setTemplatesLoading(false);
    if (templatesResult.status === 'fulfilled') {
      const approved = Array.isArray(templatesResult.value?.data?.templates) ? templatesResult.value.data.templates : [];
      setTemplates(approved);
      setTemplatesError('');
      setSelectedTemplateKey((current) => {
        if (current && approved.some((item) => `${item.name}::${item.language}` === current)) return current;
        const firstTestable = approved.find(templateTestSupport);
        return firstTestable ? `${firstTestable.name}::${firstTestable.language}` : '';
      });
    } else {
      setTemplates([]);
      setTemplatesError(unwrapError(templatesResult.reason, 'Approved templates load nahi hue.'));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData({ showLoading: true }); }, [fetchData]);

  useEffect(() => {
    if (location.hash !== '#test-message') return undefined;
    const timer = window.setTimeout(() => document.getElementById('test-message')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), loading ? 350 : 100);
    return () => window.clearTimeout(timer);
  }, [location.hash, loading]);

  const configured = Boolean(statusData?.configured);
  const paused = Boolean(statusData?.disconnected);
  const connected = configured && !paused;
  const diagnosticData = diagnostics || {};
  const subscription = diagnosticData.webhookSubscription || {};
  const lastWebhook = formatDate(diagnosticData.webhookLastReceivedAt || statusData?.webhookLastReceivedAt);
  const lastMessageEvent = formatDate(diagnosticData.webhookLastMessageAt || statusData?.webhookLastMessageAt);
  const testableTemplates = templates.filter(templateTestSupport);
  const selectedTemplate = testableTemplates.find((template) => `${template.name}::${template.language}` === selectedTemplateKey) || null;
  const selectedHeader = componentText(selectedTemplate, 'HEADER');
  const selectedBody = componentText(selectedTemplate, 'BODY') || selectedTemplate?.bodyText || '';
  const headerVariableCount = Math.max(0, ...variableIndexes(selectedHeader));
  const bodyVariableCount = Math.max(0, ...variableIndexes(selectedBody));
  const selectedTemplateSupported = templateTestSupport(selectedTemplate);

  const repairSubscription = async () => {
    setRepairing(true);
    setPageError('');
    setHealthNotice('');
    try {
      const result = await whatsappApi.repairSubscription();
      setHealthNotice(result?.message || 'Webhook subscription repair request successful.');
      await fetchData();
    } catch (err) {
      setPageError(unwrapError(err, 'Meta webhook subscription repair nahi ho payi.'));
    } finally {
      setRepairing(false);
    }
  };

  const resumeMessaging = async () => {
    setResuming(true);
    setPageError('');
    setHealthNotice('');
    try {
      const result = await whatsappApi.reconnect();
      setHealthNotice(result?.message || 'WhatsApp messaging resumed.');
      await fetchData();
    } catch (err) {
      setPageError(unwrapError(err, 'WhatsApp messaging resume nahi hua.'));
    } finally {
      setResuming(false);
    }
  };

  const sendTest = async (event) => {
    event.preventDefault();
    setTestError('');
    setTestNotice('');
    if (!selectedTemplate) { setTestError('Pehle ek approved template select karein.'); return; }
    if (!selectedTemplateSupported) { setTestError('Quick test ke liye text-header template choose karein. Media-header templates ko actual media ke saath campaign se test karein.'); return; }
    if (!confirmRecipient) { setTestError('Confirm karein ki recipient aapka apna number hai ya usne test message receive karne ki permission di hai.'); return; }
    const headerValues = Array.from({ length: headerVariableCount }, (_, index) => String(headerSampleValues[index] || '').trim());
    const bodyValues = Array.from({ length: bodyVariableCount }, (_, index) => String(bodySampleValues[index] || '').trim());
    if (headerValues.some((value) => !value) || bodyValues.some((value) => !value)) {
      setTestError('Template ke sabhi sample fields fill karein.');
      return;
    }
    setTestSending(true);
    try {
      const result = await whatsappApi.sendTestTemplate(testPhone.trim(), {
        templateName: selectedTemplate.name,
        languageCode: selectedTemplate.language,
        headerSampleValues: headerValues,
        bodySampleValues: bodyValues,
        confirmRecipient: true,
      });
      const messageId = result?.data?.messageId;
      setTestNotice(`${result?.message || 'Meta ne test message accept kar liya.'}${messageId ? ` Message ID: ${messageId}` : ''}`);
      setConfirmRecipient(false);
      // Refresh organization onboarding progress after the backend records the
      // first test message as accepted by Meta.
      const orgResult = await orgApi.get().catch(() => null);
      if (orgResult?.data?.org) setOrg(orgResult.data.org);
    } catch (err) {
      setTestError(unwrapError(err, 'Test message send nahi hua. Number, template aur connection status check karein.'));
    } finally {
      setTestSending(false);
    }
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setPageError('Clipboard access nahi mila. Webhook URL ko manually copy karein.');
    }
  };

  const refreshButton = (
    <button onClick={() => fetchData({ showLoading: true })} disabled={refreshing} className="btn-secondary flex w-fit items-center gap-2">
      <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
      Refresh status
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">Workspace settings</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">WhatsApp Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">Apna business number connect karein, approved templates check karein aur test message se delivery verify karein.</p>
        </div>
        {refreshButton}
      </header>

      {pageError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"><AlertTriangle size={17} className="mt-0.5 flex-shrink-0" /><span>{pageError}</span></div>}
      {healthNotice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" /><span>{healthNotice}</span></div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
        <div className="min-w-0 space-y-5">
          <ConnectWhatsApp onChange={() => fetchData()} />

          <section className="card min-w-0">
            <CardHeading
              icon={Activity}
              title="Connection health"
              description="Visitsly connected number ko Meta se check karta hai. Token ya account access fail ho toh yahin actionable status dikhega."
              right={loading ? <Loader2 size={17} className="animate-spin text-ink-400" /> : (connected ? <StatusPill tone="success">Connected</StatusPill> : <StatusPill tone={paused ? 'warning' : 'neutral'}>{paused ? 'Messaging paused' : 'Not connected'}</StatusPill>)}
            />
            {loading ? (
              <div className="mt-5 h-20 animate-pulse rounded-xl bg-ink-50 dark:bg-ink-800/50" />
            ) : !configured ? (
              <div className="mt-4 rounded-xl bg-ink-50 p-4 text-sm text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">Pehle upar Meta Embedded Signup complete karein. Uske baad number status aur diagnostics yahan dikhne lagenge.</div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                  <p className="text-xs text-ink-500">Business number</p>
                  <p className="mt-1 break-all text-sm font-semibold text-ink-900 dark:text-white">{statusData?.phoneNumber || 'Meta se number unavailable'}</p>
                  <p className="mt-1 text-xs text-ink-500">{statusData?.verifiedName || 'Business display name unavailable'}</p>
                </div>
                <div className="rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                  <p className="text-xs text-ink-500">Number registration</p>
                  <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">{statusData?.liveStatus || 'Status not returned'}</p>
                  <p className="mt-1 text-xs text-ink-500">Quality: {statusData?.qualityRating || 'Not reported by Meta'}</p>
                </div>
                <div className="rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                  <p className="text-xs text-ink-500">Meta API</p>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
                    {diagnostics && diagnosticData.phoneNumberBelongsToWaba === true ? <CheckCircle2 size={16} className="text-emerald-600" /> : (diagnosticsError || diagnosticData.phoneNumberBelongsToWaba === false) ? <XCircle size={16} className="text-red-600" /> : <Clock3 size={16} className="text-amber-600" />}
                    {diagnostics && diagnosticData.phoneNumberBelongsToWaba === true ? 'Account verified' : diagnosticData.phoneNumberBelongsToWaba === false ? 'Number/WABA mismatch' : diagnosticsError ? 'Check needs attention' : 'Checking account'}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{statusData?.apiVersion || 'Graph API version unavailable'}</p>
                </div>
                <div className="rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                  <p className="text-xs text-ink-500">Webhook subscription</p>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
                    {subscription.subscribed === true ? <CheckCircle2 size={16} className="text-emerald-600" /> : subscription.subscribed === false ? <XCircle size={16} className="text-red-600" /> : <Clock3 size={16} className="text-amber-600" />}
                    {subscription.subscribed === true ? 'Subscribed' : subscription.subscribed === false ? 'Not subscribed' : 'Unknown'}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{subscription.message || diagnosticsError || 'Refresh to check the subscription.'}</p>
                </div>
              </div>
            )}
            {diagnosticsError && configured && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{diagnosticsError} Try refresh first. If the Meta token/permissions have expired, use “Reconnect with Meta” above.</p>}
            {paused && canManage && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-amber-900 dark:text-amber-200">Workspace messaging manually paused hai. Resume karne par AI replies aur WhatsApp sending phir se enable honge.</p><button onClick={resumeMessaging} disabled={resuming} className="btn-primary flex shrink-0 items-center justify-center gap-2">{resuming ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Resume messaging</button></div>}
            {configured && subscription.subscribed === false && canManage && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-amber-900 dark:text-amber-200">Meta app subscription missing hai. Inbound replies aur delivery status updates affect ho sakte hain.</p>
                <button onClick={repairSubscription} disabled={repairing} className="btn-secondary flex shrink-0 items-center justify-center gap-2">
                  {repairing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Repair subscription
                </button>
              </div>
            )}
          </section>

          <section className="card min-w-0">
            <CardHeading
              icon={Webhook}
              title="Webhook health"
              description="Webhook inbound messages aur Meta delivery/read/failure updates Visitsly tak pahunchata hai."
              right={<StatusPill tone={subscription.subscribed === true ? 'success' : subscription.subscribed === false ? 'danger' : 'warning'}>{subscription.subscribed === true ? 'Subscription active' : subscription.subscribed === false ? 'Needs repair' : 'Not verified'}</StatusPill>}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50">
                <p className="text-xs text-ink-500">Last webhook event</p>
                <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">{lastWebhook || 'No event recorded yet'}</p>
              </div>
              <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50">
                <p className="text-xs text-ink-500">Last inbound message event</p>
                <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">{lastMessageEvent || 'No inbound message event recorded yet'}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-ink-500 dark:text-ink-400">No recent event apne aap failure prove nahi karta—webhook tabhi activity dikhata hai jab Meta event bhejta hai. Agar test message deliver hua lekin replies/status updates nahi aate, subscription repair karke webhook endpoint aur Meta App configuration check karein.</p>
            {support && (
              <div className="mt-4 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-ink-700 dark:text-ink-200">Platform webhook endpoint</p>
                  <button type="button" onClick={copyWebhook} className="btn-secondary text-xs">{copied ? 'Copied' : 'Copy URL'}</button>
                </div>
                <code className="mt-2 block break-all text-xs text-ink-500">{webhookUrl}</code>
                <p className="mt-2 text-xs text-ink-400">Platform-level endpoint. Individual customers should not create separate webhook URLs; Meta app fields and HTTPS settings are configured by Visitsly admins.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="card min-w-0">
            <CardHeading
              icon={FileText}
              title="Approved templates"
              description="Business-initiated messages ke liye approved Meta templates use karein."
              right={templatesLoading ? <Loader2 size={16} className="animate-spin text-ink-400" /> : <StatusPill tone={templatesError ? 'warning' : templates.length ? 'success' : 'neutral'}>{templatesError ? 'Unavailable' : `${templates.length} approved`}</StatusPill>}
            />
            {templatesError ? (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{templatesError}<button onClick={() => fetchData()} className="ml-1 font-semibold underline">Try again</button></div>
            ) : templatesLoading ? (
              <div className="mt-4 h-16 animate-pulse rounded-lg bg-ink-50 dark:bg-ink-800/50" />
            ) : templates.length ? (
              <div className="mt-4 space-y-2">
                {templates.slice(0, 4).map((template) => (
                  <div key={`${template.name}::${template.language}`} className="rounded-lg border border-ink-100 px-3 py-2.5 dark:border-ink-800">
                    <p className="break-all text-sm font-semibold text-ink-900 dark:text-white">{template.name}</p>
                    <p className="mt-1 text-xs text-ink-500">{template.category || 'Template'} · {template.language}</p>
                  </div>
                ))}
                {templates.length > 4 && <p className="text-xs text-ink-500">+ {templates.length - 4} more approved templates</p>}
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-ink-50 p-3 text-sm text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">Abhi koi approved template return nahi hua. Meta review complete hone ka wait karein ya template status refresh karein.</div>
            )}
            <Link to="/whatsapp/templates" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">Manage templates <ArrowUpRight size={15} /></Link>
          </section>

          <section id="test-message" className="card min-w-0 scroll-mt-6">
            <CardHeading
              icon={Send}
              title="Send a test message"
              description="Apne number ya consenting test recipient ko approved template bhejkar connection validate karein."
            />
            {!connected ? (
              <div className="mt-4 rounded-lg bg-ink-50 p-3 text-sm text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">{paused ? 'Messaging paused hai. Pehle WhatsApp Settings mein resume karein.' : 'Test message bhejne se pehle WhatsApp number connect karein.'}</div>
            ) : templatesLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-ink-500"><Loader2 size={16} className="animate-spin" /> Loading approved templates…</div>
            ) : !testableTemplates.length ? (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">Quick test ke liye approved text-header template chahiye. Abhi ke approved templates mein media header hai; actual image/video ke saath campaign preview se test karein, ya Meta mein text-header template approve hone ke baad yahan refresh karein.</div>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={sendTest}>
                <label className="block text-xs font-semibold text-ink-700 dark:text-ink-200">
                  Recipient phone (with country code)
                  <input className="input-field mt-1.5" required inputMode="tel" autoComplete="tel" placeholder="919876543210" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-ink-700 dark:text-ink-200">
                  Approved template
                  <select className="input-field mt-1.5" required value={selectedTemplateKey} onChange={(event) => { setSelectedTemplateKey(event.target.value); setHeaderSampleValues([]); setBodySampleValues([]); setTestNotice(''); setTestError(''); }}>
                    {testableTemplates.map((template) => <option key={`${template.name}::${template.language}`} value={`${template.name}::${template.language}`}>{template.name} · {template.language}</option>)}
                  </select>
                </label>
                {selectedTemplate && !selectedTemplateSupported && <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">Is template ka media header hai. Iske actual media asset ke saath campaign test use karein.</p>}
                {headerVariableCount > 0 && (
                  <div className="space-y-2 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
                    <p className="text-xs font-semibold text-ink-700 dark:text-ink-200">Header sample values</p>
                    {Array.from({ length: headerVariableCount }, (_, index) => <input key={`h-${index}`} className="input-field" required placeholder={`Header {{${index + 1}}}`} value={headerSampleValues[index] || ''} onChange={(event) => setHeaderSampleValues((previous) => { const next = [...previous]; next[index] = event.target.value; return next; })} />)}
                  </div>
                )}
                {bodyVariableCount > 0 && (
                  <div className="space-y-2 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
                    <p className="text-xs font-semibold text-ink-700 dark:text-ink-200">Body sample values</p>
                    {Array.from({ length: bodyVariableCount }, (_, index) => <input key={`b-${index}`} className="input-field" required placeholder={`Body {{${index + 1}}}`} value={bodySampleValues[index] || ''} onChange={(event) => setBodySampleValues((previous) => { const next = [...previous]; next[index] = event.target.value; return next; })} />)}
                  </div>
                )}
                <label className="flex items-start gap-2 text-xs leading-5 text-ink-600 dark:text-ink-300">
                  <input className="mt-1" type="checkbox" checked={confirmRecipient} onChange={(event) => setConfirmRecipient(event.target.checked)} />
                  I confirm the recipient is my own test number or has agreed to receive this test message.
                </label>
                {testError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{testError}</p>}
                {testNotice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{testNotice} Delivery confirmation is asynchronous and appears only if Meta sends a status webhook.</p>}
                <button type="submit" disabled={testSending || !selectedTemplate || !selectedTemplateSupported} className="btn-primary flex w-full items-center justify-center gap-2">
                  {testSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {testSending ? 'Sending test…' : 'Send test message'}
                </button>
                <p className="text-[11px] leading-4 text-ink-400">Outside Meta's 24-hour customer-service window, only an approved template can initiate a conversation. API acceptance is not the same as delivery confirmation.</p>
              </form>
            )}
          </section>

          <section className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-300" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Managed securely by Visitsly</p>
                <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-300">Access tokens backend par encrypted form mein store hote hain. Facebook password Visitsly ko share nahi hota. Number connection, business permissions aur Meta messaging policies account par apply hote hain.</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
