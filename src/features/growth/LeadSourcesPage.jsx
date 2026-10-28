import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Link2, Mail, Webhook, Facebook, RefreshCw, Loader2, Share2, CheckCircle2 } from 'lucide-react';
import { growthApi } from '../../api/saasApi.js';
import { CopyBox, Toggle, PageTitle, Notice, errText, SOURCE_LABEL } from '../../lib/saas.jsx';

function loadFacebookSdk(appId, version) {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => { window.FB.init({ appId, xfbml: false, version }); resolve(window.FB); };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.onerror = () => reject(new Error('Facebook SDK load nahi hua'));
    document.body.appendChild(s);
  });
}

function Card({ icon: Icon, title, children, tone = 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' }) {
  return (
    <section className="card min-w-0 space-y-3">
      <h2 className="flex items-center gap-2.5 font-semibold text-ink-900 dark:text-white"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon size={17} /></span>{title}</h2>
      {children}
    </section>
  );
}

export default function LeadSourcesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['lead-sources'], queryFn: growthApi.sources });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState(null);
  const [manual, setManual] = useState({ pageId: '', pageToken: '' });
  const s = data?.data?.sources;

  const refresh = (res, text) => {
    if (res?.data?.sources) qc.setQueryData(['lead-sources'], { data: { sources: res.data.sources } });
    if (text) setMsg({ ok: true, text });
  };

  const run = async (fn) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); } catch (err) { setMsg({ ok: false, text: errText(err) }); } finally { setBusy(false); }
  };

  const connectFacebook = () => run(async () => {
    if (!s.meta.appId) throw new Error('Facebook connect abhi set nahi hai — neeche Page ID + token se jodiye');
    const FB = await loadFacebookSdk(s.meta.appId, s.meta.apiVersion);
    const token = await new Promise((resolve, reject) => FB.login((r) => (r?.authResponse?.accessToken ? resolve(r.authResponse.accessToken) : reject(new Error('Facebook login complete nahi hua'))), { scope: 'pages_show_list,leads_retrieval,pages_manage_metadata,pages_read_engagement,pages_manage_ads' }));
    const res = await growthApi.metaPages(token);
    setPages(res.data.pages);
    if (!res.data.pages.length) throw new Error('Is Facebook account mein koi Page nahi mila');
  });

  const choosePage = (page) => run(async () => {
    const res = await growthApi.metaConnect({ pageId: page.id });
    setPages(null);
    refresh(res, res.message);
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink-400" /></div>;
  if (error) return <div className="card text-sm text-red-600">{errText(error)}</div>;

  const shareText = encodeURIComponent(`Property enquiry ke liye yeh form bhariye: ${s.hostedFormUrl}`);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageTitle title="Lead sources" subtitle="Har jagah ki leads seedhe Visitsly mein — aur AI turant WhatsApp par baat shuru kar deta hai." />
      <Notice msg={msg} />

      <section className="card min-w-0 space-y-4">
        <Toggle checked={s.autoWhatsapp} label="Nayi lead aate hi WhatsApp shuru karein" help="Lead aate hi opening template jayega aur AI baat sambhal lega (1 minute ke andar reply = zyada site visits)." onChange={(v) => run(async () => refresh(await growthApi.updateSources({ autoWhatsapp: v }), 'Saved'))} />
        {s.last30Days.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Pichhle 30 din</p>
            <div className="flex flex-wrap gap-2">{s.last30Days.map((r) => <span key={r.source} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-200">{SOURCE_LABEL[r.source] || r.source}: <strong>{r.count}</strong></span>)}</div>
          </div>
        )}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <Card icon={Facebook} title="Facebook & Instagram lead ads" tone="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
          {s.meta.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">
              <span className="flex items-center gap-2"><CheckCircle2 size={16} /> {s.meta.pageName || s.meta.pageId} connected</span>
              <button className="text-xs font-semibold underline" disabled={busy} onClick={() => run(async () => refresh(await growthApi.metaDisconnect(), 'Disconnected'))}>Disconnect</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-600 dark:text-ink-300">Page connect karte hi har lead form ki entry yahan aa jayegi (Zapier ki zarurat nahi).</p>
              <button className="btn-primary gap-2 !bg-[#1877F2] hover:!bg-[#166FE5]" disabled={busy} onClick={connectFacebook}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Facebook size={15} />} Connect Facebook Page</button>
              {pages && (
                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100 dark:divide-ink-800 dark:border-ink-800">
                  {pages.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span>{p.name}</span><button className="btn-secondary !py-1 text-xs" onClick={() => choosePage(p)}>Choose</button></li>)}
                </ul>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-ink-600 dark:text-ink-300">Manual: Page ID + Page access token</summary>
                <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => refresh(await growthApi.metaConnect(manual), 'Page connected')); }}>
                  <input className="input-field font-mono" placeholder="Page ID" inputMode="numeric" required value={manual.pageId} onChange={(e) => setManual({ ...manual, pageId: e.target.value.trim() })} />
                  <input className="input-field font-mono" placeholder="Long-lived Page access token" type="password" required value={manual.pageToken} onChange={(e) => setManual({ ...manual, pageToken: e.target.value.trim() })} />
                  <button className="btn-secondary" disabled={busy}>Connect</button>
                </form>
              </details>
            </>
          )}
        </Card>

        <Card icon={Link2} title="Form link (Instagram bio, WhatsApp status, QR)">
          <CopyBox value={s.hostedFormUrl} help="Ye link kisi ko bhi bhejiye — form bharte hi lead aapke CRM mein." />
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary gap-1.5 !py-1.5 text-xs" href={s.hostedFormUrl} target="_blank" rel="noreferrer">Form dekhein</a>
            <a className="btn-secondary gap-1.5 !py-1.5 text-xs" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer"><Share2 size={13} /> WhatsApp par share</a>
          </div>
        </Card>

        <Card icon={Mail} title="99acres / MagicBricks / Housing.com">
          {s.forwardingEmail ? (
            <>
              <CopyBox value={s.forwardingEmail} />
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-600 dark:text-ink-300">
                <li>Gmail → Settings → Forwarding mein ye address add karein</li>
                <li>Filter banaiye: from <code>99acres.com OR magicbricks.com OR housing.com</code> → Forward to upar wala address</li>
                <li>Portal ki har lead email se naam, mobile, project nikal kar CRM mein aa jayegi</li>
              </ol>
            </>
          ) : <p className="text-sm text-ink-500">Email se leads lene ki suvidha abhi Visitsly team setup kar rahi hai.</p>}
        </Card>

        <Card icon={Globe} title="Apni website ka form">
          <CopyBox multiline value={s.embedSnippet} help="Ye HTML apne website builder (WordPress, Wix, custom) mein paste karein. 'redirect' mein apna thank-you page daaliye." />
        </Card>

        <Card icon={Webhook} title="Google Ads lead form">
          <CopyBox label="Webhook URL" value={s.googleAds.webhookUrl} />
          <CopyBox label="Key" value={s.googleAds.key} help="Google Ads → Lead form asset → Lead delivery → Webhook integration mein dono daaliye." />
        </Card>

        <Card icon={Webhook} title="n8n / Zapier / Pabbly / koi bhi CRM">
          <CopyBox label="POST URL (JSON ya form)" value={s.webhookUrl} help="Fields: name, phone, email, project, city, budget, message, source." />
        </Card>
      </div>

      <section className="card min-w-0 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600 dark:text-ink-300">Link leak ho gaya ya spam aa raha hai? Naya link banaiye — purane saare form/URL band ho jayenge.</p>
        <button className="btn-secondary gap-2" disabled={busy} onClick={() => { if (window.confirm('Purane saare form links aur webhooks band ho jayenge. Naya link banayein?')) run(async () => refresh(await growthApi.updateSources({ regenerateKey: true }), 'Naya link ban gaya')); }}><RefreshCw size={15} /> Naya link banayein</button>
      </section>
    </div>
  );
}
