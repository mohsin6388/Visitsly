import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Send,
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

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">WhatsApp</h1>
        <button onClick={() => fetchData({ showLoading: true })} disabled={refreshing} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />Refresh</button>
      </header>

      {pageError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"><AlertTriangle size={17} className="mt-0.5 flex-shrink-0" /><span>{pageError}</span></div>}
      {healthNotice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" /><span>{healthNotice}</span></div>}

      <ConnectWhatsApp onChange={() => fetchData()} />

      {configured && (
        <section className="card min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">Status</h2>
            {loading ? <Loader2 size={16} className="animate-spin text-ink-400" /> : connected ? <StatusPill tone="success">Healthy</StatusPill> : <StatusPill tone="warning">{paused ? 'Paused' : 'Check needed'}</StatusPill>}
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50"><dt className="text-xs text-ink-500">Number</dt><dd className="mt-0.5 break-all font-semibold text-ink-900 dark:text-white">{statusData?.phoneNumber || '—'}</dd></div>
            <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50"><dt className="text-xs text-ink-500">Quality</dt><dd className="mt-0.5 font-semibold text-ink-900 dark:text-white">{statusData?.qualityRating || '—'}</dd></div>
            <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50"><dt className="text-xs text-ink-500">Messages sync</dt><dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-ink-900 dark:text-white">{subscription.subscribed === true ? <><CheckCircle2 size={15} className="text-emerald-600" />Active</> : subscription.subscribed === false ? <><XCircle size={15} className="text-red-600" />Off</> : <><Clock3 size={15} className="text-amber-600" />Unknown</>}</dd></div>
          </dl>
          {diagnosticsError && <p className="text-xs text-amber-700 dark:text-amber-300">{diagnosticsError}</p>}
          {lastMessageEvent && <p className="text-xs text-ink-400">Last message: {lastMessageEvent}</p>}
          {canManage && paused && <button onClick={resumeMessaging} disabled={resuming} className="btn-primary flex items-center gap-2">{resuming ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Resume messaging</button>}
          {canManage && subscription.subscribed === false && <button onClick={repairSubscription} disabled={repairing} className="btn-secondary flex items-center gap-2">{repairing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}Repair connection</button>}
          {support && <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-3 text-xs dark:border-ink-800"><code className="break-all text-ink-500">{webhookUrl}</code><button type="button" onClick={copyWebhook} className="btn-secondary text-xs">{copied ? 'Copied' : 'Copy'}</button></div>}
        </section>
      )}

      {connected && (
        <section id="test-message" className="card min-w-0 scroll-mt-6">
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">Test message</h2>
          {templatesLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-ink-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : !testableTemplates.length ? (
            <p className="mt-3 text-sm text-ink-500">Test ke liye ek approved template chahiye. <Link to="/whatsapp/templates" className="font-semibold text-brand-600 hover:underline">Templates</Link></p>
          ) : (
            <form className="mt-3 space-y-3" onSubmit={sendTest}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="input-field" required inputMode="tel" autoComplete="tel" placeholder="Phone (919876543210)" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} />
                <select className="input-field" required value={selectedTemplateKey} onChange={(event) => { setSelectedTemplateKey(event.target.value); setHeaderSampleValues([]); setBodySampleValues([]); setTestNotice(''); setTestError(''); }}>
                  {testableTemplates.map((template) => <option key={`${template.name}::${template.language}`} value={`${template.name}::${template.language}`}>{template.name} · {template.language}</option>)}
                </select>
              </div>
              {Array.from({ length: headerVariableCount }, (_, index) => <input key={`h-${index}`} className="input-field" required placeholder={`Header {{${index + 1}}}`} value={headerSampleValues[index] || ''} onChange={(event) => setHeaderSampleValues((previous) => { const next = [...previous]; next[index] = event.target.value; return next; })} />)}
              {Array.from({ length: bodyVariableCount }, (_, index) => <input key={`b-${index}`} className="input-field" required placeholder={`Body {{${index + 1}}}`} value={bodySampleValues[index] || ''} onChange={(event) => setBodySampleValues((previous) => { const next = [...previous]; next[index] = event.target.value; return next; })} />)}
              <label className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300"><input type="checkbox" checked={confirmRecipient} onChange={(event) => setConfirmRecipient(event.target.checked)} />Ye mera apna ya permission wala number hai</label>
              {testError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{testError}</p>}
              {testNotice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{testNotice}</p>}
              <button type="submit" disabled={testSending || !selectedTemplate} className="btn-primary flex items-center justify-center gap-2">{testSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}{testSending ? 'Sending…' : 'Send test'}</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
