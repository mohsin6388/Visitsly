import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import { FeatureGate } from '../features/saas/UpgradeCard.jsx';

// Email automation is hidden from the menu on plans without it (Starter / Trial);
// opening the URL directly shows an upgrade prompt.
const EMAIL_GATE = {
  feature: 'emailCampaigns',
  title: 'Email automation is on paid plans',
  body: 'Send email campaigns from your own official company email, alongside WhatsApp.',
  points: ['Verified official sender email + domain authentication', 'Email campaigns to your contacts', 'Reusable email templates', 'Delivery details: sent, opened, failed'],
};
const email = (el) => <FeatureGate {...EMAIL_GATE}>{el}</FeatureGate>;
const WA_CAMPAIGN_GATE = {
  feature: 'bulkWhatsapp',
  title: 'Bulk WhatsApp campaigns are on paid plans',
  body: 'Message hundreds of contacts at once with approved WhatsApp templates; the AI handles every reply.',
  points: ['Bulk WhatsApp campaigns', 'Automatic Follow-ups', 'AI WhatsApp Agent on every reply', 'Available from the Starter plan'],
};

const LoginPage = lazy(() => import('../features/auth/LoginPage.jsx'));
const ForgotPasswordPage = lazy(() => import('../features/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('../features/auth/ResetPasswordPage.jsx'));

const FollowUpsPage = lazy(() => import('../features/followups/FollowUpsPage.jsx'));






const LeadsPage = lazy(() => import('../features/leads/LeadsPage.jsx'));
const OutreachPage = lazy(() => import('../features/outreach/OutreachPage.jsx'));
const PropertiesPage = lazy(() => import('../features/properties/PropertiesPage.jsx'));
const WhatsAppPage = lazy(() => import('../features/whatsapp/WhatsAppPage.jsx'));
const ConversationsPage = lazy(() => import('../features/conversations/ConversationsPage.jsx'));
const AnalyticsPage = lazy(() => import('../features/analytics/AnalyticsPage.jsx'));
const SiteVisitsPage = lazy(() => import('../features/meetings/SiteVisitsPage.jsx'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage.jsx'));
const ProfilePage = lazy(() => import('../features/profile/ProfilePage.jsx'));
const EmailSetupPage = lazy(() => import('../features/email/EmailSetupPage.jsx'));
const EmailDetailsPage = lazy(() => import('../features/email/EmailDetailsPage.jsx'));
const AiScriptPage = lazy(() => import('../features/assistant/AiScriptPage.jsx'));
const VisitConfirmationPage = lazy(() => import('../features/whatsapp/VisitConfirmationPage.jsx'));
const TemplateManagerPage = lazy(() => import('../features/templates/TemplateManagerPage.jsx'));
const SignupPage = lazy(() => import('../features/auth/SignupPage.jsx'));
const VerifyEmailPage = lazy(() => import('../features/auth/VerifyEmailPage.jsx'));
const PricingPage = lazy(() => import('../features/saas/PricingPage.jsx'));
const OnboardingPage = lazy(() => import('../features/onboarding/OnboardingPage.jsx'));
const BillingPage = lazy(() => import('../features/saas/BillingPage.jsx'));
const TeamPage = lazy(() => import('../features/saas/TeamPage.jsx'));
const SupportTicketsPage = lazy(() => import('../features/saas/SupportTicketsPage.jsx'));
const SupportEntry = lazy(() => import('../features/saas/SupportEntry.jsx'));
const LeadSourcesPage = lazy(() => import('../features/growth/LeadSourcesPage.jsx'));
const ReportsPage = lazy(() => import('../features/growth/ReportsPage.jsx'));
const ChannelPartnersPage = lazy(() => import('../features/growth/ChannelPartnersPage.jsx'));
const PublicFormPage = lazy(() => import('../features/public/PublicFormPage.jsx'));
const CpPortal = lazy(() => import('../features/public/CpPortal.jsx'));





import { authApi } from '../api/authApi.js';
import { useAuthStore } from '../store/authStore.js';
import RequireAccess, { HomeFor } from '../components/RequireAccess.jsx';

function HomeRedirect() {
  const { user, org, support, isAuthReady } = useAuthStore();
  if (!isAuthReady) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /></div>;
  if (!user && !support) return <Navigate to="/login" replace />;
  // New workspaces finish the onboarding wizard first (Visitsly support skips it).
  if (!support && org && org.profileDone === false) return <Navigate to="/onboarding" replace />;
  const connected = support || (org?.whatsapp?.status === 'connected' && Boolean(org?.whatsapp?.phoneNumberId));
  return <HomeFor connected={connected} />;
}

export default function AppRouter() {
  const { setSession, markAuthReady } = useAuthStore();

  useEffect(() => {
    // Silent refresh on load: if a valid refresh cookie exists, restore the session.
    // Public pages (hosted lead form, channel partner portal) and Visitsly
    // support links must not pick up a stored customer session.
    if (/^\/(support|f\/|cp\/)/.test(window.location.pathname)) {
      markAuthReady();
      return;
    }
    (async () => {
      try {
        const { data } = await authApi.refresh();
        useAuthStore.getState().setAccessToken(data.accessToken);
        const me = await authApi.me();
        setSession(me.data.user, data.accessToken, me.data.org);
      } catch (err) {
        markAuthReady();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /></div>}>
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/support" element={<SupportEntry />} />
      <Route path="/f/:key" element={<PublicFormPage />} />
      <Route path="/cp/:slug/*" element={<CpPortal />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        {/* Full-screen onboarding wizard: protected, but outside the dashboard (no sidebar). */}
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<RequireAccess perm="dashboard"><AnalyticsPage /></RequireAccess>} />
          <Route path="/leads" element={<RequireAccess perm="leads"><LeadsPage /></RequireAccess>} />
          <Route path="/qualified-leads" element={<Navigate to="/whatsapp/leads" replace />} />
          <Route path="/whatsapp/leads" element={<RequireAccess perm="whatsappLeads"><LeadsPage key="wa-leads" mode="whatsapp" /></RequireAccess>} />
          <Route path="/email/leads" element={<Navigate to="/leads" replace />} />
          <Route path="/outreach/whatsapp" element={<RequireAccess ownerOnly><FeatureGate {...WA_CAMPAIGN_GATE}><OutreachPage channel="whatsapp" /></FeatureGate></RequireAccess>} />
          <Route path="/outreach/email" element={<RequireAccess ownerOnly>{email(<OutreachPage channel="email" />)}</RequireAccess>} />
          <Route path="/email/setup" element={<RequireAccess ownerOnly>{email(<EmailSetupPage />)}</RequireAccess>} />
          <Route path="/email/details" element={<RequireAccess ownerOnly>{email(<EmailDetailsPage />)}</RequireAccess>} />
          <Route path="/email/conversations" element={<Navigate to="/email/details" replace />} />
          <Route path="/email-replies" element={<Navigate to="/email/details" replace />} />
          <Route path="/whatsapp/visit-confirmation" element={<RequireAccess ownerOnly><VisitConfirmationPage /></RequireAccess>} />
          <Route path="/properties" element={<RequireAccess perm="properties"><PropertiesPage /></RequireAccess>} />
          <Route path="/whatsapp" element={<RequireAccess ownerOnly><WhatsAppPage /></RequireAccess>} />
          <Route path="/whatsapp/ai-script" element={<RequireAccess ownerOnly><AiScriptPage /></RequireAccess>} />
          <Route path="/conversations" element={<RequireAccess perm="inbox"><ConversationsPage /></RequireAccess>} />
          <Route path="/whatsapp/conversations" element={<RequireAccess perm="inbox"><ConversationsPage /></RequireAccess>} />
          <Route path="/whatsapp/templates" element={<RequireAccess ownerOnly><TemplateManagerPage channel="whatsapp" /></RequireAccess>} />
          <Route path="/email/templates" element={<RequireAccess ownerOnly>{email(<TemplateManagerPage channel="email" />)}</RequireAccess>} />
          <Route path="/follow-ups" element={<RequireAccess perm="followUps"><FollowUpsPage /></RequireAccess>} />
          <Route path="/site-visits" element={<RequireAccess perm="siteVisits"><SiteVisitsPage /></RequireAccess>} />


          <Route path="/settings" element={<RequireAccess ownerOnly><SettingsPage /></RequireAccess>} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/help" element={<SupportTicketsPage />} />

          {/* SaaS */}
          <Route path="/get-started" element={<Navigate to="/whatsapp" replace />} />
          <Route path="/team" element={<RequireAccess ownerOnly><TeamPage /></RequireAccess>} />
          <Route path="/billing" element={<RequireAccess ownerOnly><BillingPage /></RequireAccess>} />
          <Route path="/reports" element={<RequireAccess ownerOnly><ReportsPage /></RequireAccess>} />
          <Route path="/lead-sources" element={<RequireAccess ownerOnly><LeadSourcesPage /></RequireAccess>} />
          <Route path="/routing" element={<Navigate to="/reports" replace />} />
          <Route path="/quotes" element={<Navigate to="/reports" replace />} />
          <Route path="/channel-partners" element={<RequireAccess ownerOnly><ChannelPartnersPage /></RequireAccess>} />
          <Route path="/ai-calling" element={<Navigate to="/whatsapp/visit-confirmation" replace />} />
        </Route>
      </Route>

      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
