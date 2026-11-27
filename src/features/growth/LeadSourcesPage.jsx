import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Link2, Mail, Webhook, Facebook, RefreshCw, Loader2, Share2, CheckCircle2, Building2 } from 'lucide-react';
import { growthApi } from '../../api/saasApi.js';
import { CopyBox, Toggle, PageTitle, Notice, errText, SOURCE_LABEL } from '../../lib/saas.jsx';
import { confirmDialog } from '../../components/ui/index.jsx';
import { useFeature } from '../saas/UpgradeCard.jsx';
import { showUpgrade } from '../../lib/saas.jsx';

function loadFacebookSdk(appId, version) {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => { window.FB.init({ appId, xfbml: false, version }); resolve(window.FB); };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.onerror = () => reject(new Error('Could not load Facebook SDK'));
    document.body.appendChild(s);
  });
}

const TABS = [
  ['facebook', 'Facebook / Instagram', Facebook],
  ['portal', '99acres / MagicBricks', Building2],
  ['form', 'Form link', Link2],
  ['website', 'Meri website', Globe],
  ['other', 'Google Ads / Other', Webhook],
];

function TestLead() {
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('website_form');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { const r = await growthApi.testLead({ phone, source }); setMsg({ ok: true, text: r.message }); }
    catch (err) { setMsg({ ok: false, text: errText(err) }); }
    finally { setBusy(false); }
  };
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Send a test</h2>
        <p className="mt-0.5 text-xs text-ink-500">Enter your number — we create a test lead and the AI messages you on WhatsApp like a real customer.</p>
      </div>
      <form onSubmit={send} className="flex flex-wrap items-end gap-2">
        <input className="input-field !w-48" inputMode="tel" required placeholder="Your mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <select className="input-field !w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
          {[['website_form', 'Website form'], ['facebook_ads', 'Facebook ad'], ['google_ads', 'Google Ads'], ['99acres', '99acres'], ['magicbricks', 'MagicBricks'], ['housing', 'Housing.com']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn-primary gap-2" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Send test lead</button>
      </form>
      <Notice msg={msg} />
    </section>
  );
}

function Steps({ children }) {
  return <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-700 dark:text-ink-200">{children}</ol>;
}

export default function LeadSourcesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['lead-sources'], queryFn: growthApi.sources });
  const [tab, setTab] = useState('facebook');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState(null);
  const [manual, setManual] = useState({ pageId: '', pageToken: '' });
  const s = data?.data?.sources;
  const metaAllowed = useFeature('metaLeadAds');

  const refresh = (res, text) => {
    if (res?.data?.sources) qc.setQueryData(['lead-sources'], { data: { sources: res.data.sources } });
    if (text) setMsg({ ok: true, text });
  };
  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (err) { setMsg({ ok: false, text: errText(err) }); } finally { setBusy(false); }
  };

  const connectFacebook = () => run(async () => {
    if (!metaAllowed) {
      showUpgrade('Meta Lead Ads Sync is included in the Builder Pro plan. Upgrade to get Facebook / Instagram leads into the AI inbox automatically.');
      return;
    }
    if (!s.meta.appId) throw new Error('Facebook connect is not set up yet. Use "Manual" below with Page ID and token.');
    const FB = await loadFacebookSdk(s.meta.appId, s.meta.apiVersion);
    const token = await new Promise((resolve, reject) => FB.login((r) => (r?.authResponse?.accessToken ? resolve(r.authResponse.accessToken) : reject(new Error('Facebook login was not completed'))), { scope: 'pages_show_list,leads_retrieval,pages_manage_metadata,pages_read_engagement,pages_manage_ads' }));
    const res = await growthApi.metaPages(token);
    setPages(res.data.pages);
    if (!res.data.pages.length) throw new Error('No Pages found on this Facebook account');
  });
  const choosePage = (page) => run(async () => {
    const res = await growthApi.metaConnect({ pageId: page.id });
    setPages(null);
    refresh(res, res.message);
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;
  if (error) return <div className="card text-sm text-red-600">{errText(error)}</div>;

  const shareText = encodeURIComponent(`Fill this form for property enquiries: ${s.hostedFormUrl}`);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle title="Lead sources" subtitle="Connect where your leads come from. Every new lead lands here automatically." />
      <Notice msg={msg} />

      <section className="card space-y-4">
        <Toggle checked={s.autoWhatsapp} label="Message new leads on WhatsApp instantly" help="AI starts the conversation as soon as a lead arrives." onChange={(v) => run(async () => refresh(await growthApi.updateSources({ autoWhatsapp: v }), 'Saved'))} />
        {s.last30Days.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Leads, last 30 days</p>
            <div className="flex flex-wrap gap-2">{s.last30Days.map((r) => <span key={r.source} title={r.lastAt ? `Aakhri lead: ${new Date(r.lastAt).toLocaleString('en-IN')}` : ''} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-200">{SOURCE_LABEL[r.source] || r.source}: <strong>{r.count}</strong>{r.lastAt ? <span className="ml-1 text-ink-400">· {new Date(r.lastAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span> : null}</span>)}</div>
          </div>
        )}
      </section>

      <TestLead />

      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold ${tab === key ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200'}`}>
            <Icon size={15} /> {label}
            {key === 'facebook' && s.meta.connected && <CheckCircle2 size={14} className={tab === key ? 'text-white' : 'text-green-600'} />}
          </button>
        ))}
      </div>

      <section className="card min-w-0 space-y-4">
        {tab === 'facebook' && (
          s.meta.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">
              <span className="flex items-center gap-2"><CheckCircle2 size={16} /> {s.meta.pageName || s.meta.pageId} is connected. Every lead form entry from this Page lands here.</span>
              <button className="text-xs font-semibold underline" disabled={busy} onClick={() => run(async () => refresh(await growthApi.metaDisconnect(), 'Disconnected'))}>Disconnect</button>
            </div>
          ) : (
            <>
              <Steps>
                <li>Click the button below and log in with Facebook.</li>
                <li>Pick your Page.</li>
                <li>Done. Facebook and Instagram lead ad leads will arrive here.</li>
              </Steps>
              <button className="btn-primary gap-2 !bg-[#1877F2] hover:!bg-[#166FE5]" disabled={busy} onClick={connectFacebook}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Facebook size={15} />} Connect Facebook Page</button>
              {pages && (
                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100 dark:divide-ink-800 dark:border-ink-800">
                  {pages.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span>{p.name}</span><button className="btn-secondary !py-1 text-xs" onClick={() => choosePage(p)}>Select</button></li>)}
                </ul>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-ink-600 dark:text-ink-300">If that doesn’t work: connect with Page ID and token</summary>
                <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => refresh(await growthApi.metaConnect(manual), 'Page connected')); }}>
                  <input className="input-field font-mono" placeholder="Page ID" inputMode="numeric" required value={manual.pageId} onChange={(e) => setManual({ ...manual, pageId: e.target.value.trim() })} />
                  <input className="input-field font-mono" placeholder="Page access token" type="password" required value={manual.pageToken} onChange={(e) => setManual({ ...manual, pageToken: e.target.value.trim() })} />
                  <button className="btn-secondary" disabled={busy}>Connect</button>
                </form>
              </details>
            </>
          )
        )}

        {tab === 'portal' && (
          s.forwardingEmail ? (
            <>
              <p className="text-sm text-ink-600 dark:text-ink-300">Forward portal lead emails to this address and leads are added automatically.</p>
              <CopyBox label="Copy this email address" value={s.forwardingEmail} />
              <Steps>
                <li>Open Gmail → Settings → Forwarding and POP/IMAP.</li>
                <li>Add the address above under "Add a forwarding address".</li>
                <li>Create a filter: from <code>99acres.com OR magicbricks.com OR housing.com</code> and "Forward it to" this address.</li>
              </Steps>
            </>
          ) : <p className="text-sm text-ink-500">Email lead capture is being set up by the Visitsly team.</p>
        )}

        {tab === 'form' && (
          <>
            <p className="text-sm text-ink-600 dark:text-ink-300">Use this link in your Instagram bio, WhatsApp status or a QR code. Every submission becomes a lead.</p>
            <CopyBox value={s.hostedFormUrl} />
            <div className="flex flex-wrap gap-2">
              <a className="btn-secondary gap-1.5 !py-1.5 text-xs" href={s.hostedFormUrl} target="_blank" rel="noreferrer">View form</a>
              <a className="btn-secondary gap-1.5 !py-1.5 text-xs" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer"><Share2 size={13} /> Share on WhatsApp</a>
            </div>
          </>
        )}

        {tab === 'website' && (
          <>
            <p className="text-sm text-ink-600 dark:text-ink-300">Paste this code where the form should appear on your website (WordPress, Wix or custom).</p>
            <CopyBox multiline value={s.embedSnippet} help={'Replace "redirect" with your thank-you page link.'} />
          </>
        )}

        {tab === 'other' && (
          <>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink-900 dark:text-white">Google Ads lead form</h3>
              <CopyBox label="Webhook URL" value={s.googleAds.webhookUrl} />
              <div className="mt-2"><CopyBox label="Key" value={s.googleAds.key} help="Add both in Google Ads → Lead form asset → Lead delivery → Webhook." /></div>
            </div>
            <div className="border-t border-ink-100 pt-4 dark:border-ink-800">
              <h3 className="mb-2 text-sm font-semibold text-ink-900 dark:text-white">Zapier / n8n / Pabbly / other CRM</h3>
              <CopyBox label="POST URL" value={s.webhookUrl} help="Fields: name, phone, email, project, city, budget, message, source." />
            </div>
          </>
        )}
      </section>

      <p className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
        <span>Link leaked or getting spam? A new link disables all old forms and URLs.</span>
        <button className="btn-secondary gap-2 !py-1.5 text-xs" disabled={busy} onClick={async () => { if (await confirmDialog({ title: 'Create a new link?', message: 'All old form links and webhooks will stop working.', confirmLabel: 'Create new link' })) run(async () => refresh(await growthApi.updateSources({ regenerateKey: true }), 'New link created')); }}><RefreshCw size={13} /> New link</button>
      </p>
    </div>
  );
}
