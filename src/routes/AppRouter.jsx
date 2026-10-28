import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

import LoginPage from '../features/auth/LoginPage.jsx';
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../features/auth/ResetPasswordPage.jsx';

import FollowUpsPage from '../features/followups/FollowUpsPage.jsx';
import QualifiedLeadsPage from '../features/leads/QualifiedLeadsPage.jsx';






import LeadsPage from '../features/leads/LeadsPage.jsx';
import OutreachPage from '../features/outreach/OutreachPage.jsx';
import PropertiesPage from '../features/properties/PropertiesPage.jsx';
import WhatsAppPage from '../features/whatsapp/WhatsAppPage.jsx';
import ConversationsPage from '../features/conversations/ConversationsPage.jsx';
import AnalyticsPage from '../features/analytics/AnalyticsPage.jsx';
import SiteVisitsPage from '../features/meetings/SiteVisitsPage.jsx';
import SettingsPage from '../features/settings/SettingsPage.jsx';
import ProfilePage from '../features/profile/ProfilePage.jsx';
import EmailRepliesPage from '../features/email/EmailRepliesPage.jsx';
import TemplateManagerPage from '../features/templates/TemplateManagerPage.jsx';
import SignupPage from '../features/auth/SignupPage.jsx';
import VerifyEmailPage from '../features/auth/VerifyEmailPage.jsx';
import PricingPage from '../features/saas/PricingPage.jsx';
import BillingPage from '../features/saas/BillingPage.jsx';
import TeamPage from '../features/saas/TeamPage.jsx';
import { GetStartedPage } from '../features/saas/SetupChecklist.jsx';
import SupportEntry from '../features/saas/SupportEntry.jsx';
import LeadSourcesPage from '../features/growth/LeadSourcesPage.jsx';
import RoutingPage from '../features/growth/RoutingPage.jsx';
import ReportsPage from '../features/growth/ReportsPage.jsx';
import QuotesPage from '../features/growth/QuotesPage.jsx';
import ChannelPartnersPage from '../features/growth/ChannelPartnersPage.jsx';
import AiCallingPage from '../features/growth/AiCallingPage.jsx';
import PublicFormPage from '../features/public/PublicFormPage.jsx';
import CpPortal from '../features/public/CpPortal.jsx';





import { authApi } from '../api/authApi.js';
import { useAuthStore } from '../store/authStore.js';

function HomeRedirect() {
  const { user, org, support, isAuthReady } = useAuthStore();
  if (!isAuthReady) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /></div>;
  if (!user && !support) return <Navigate to="/login" replace />;
  const connected = support || (org?.whatsapp?.status === 'connected' && Boolean(org?.whatsapp?.phoneNumberId));
  return <Navigate to={connected ? '/dashboard' : '/get-started'} replace />;
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
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<AnalyticsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/qualified-leads" element={<QualifiedLeadsPage />} />
          <Route path="/whatsapp/leads" element={<LeadsPage key="wa-leads" qualifiedOnly replyChannel="whatsapp" />} />
          <Route path="/email/leads" element={<LeadsPage key="email-leads" qualifiedOnly replyChannel="email" />} />
          <Route path="/outreach/whatsapp" element={<OutreachPage channel="whatsapp" />} />
          <Route path="/outreach/email" element={<OutreachPage channel="email" />} />
          <Route path="/email/conversations" element={<EmailRepliesPage mode="conversations" />} />
          <Route path="/email/details" element={<EmailRepliesPage mode="details" />} />
          <Route path="/email-replies" element={<Navigate to="/email/conversations" replace />}
          />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/whatsapp/conversations" element={<ConversationsPage />} />
          <Route path="/whatsapp/templates" element={<TemplateManagerPage channel="whatsapp" />} />
          <Route path="/email/templates" element={<TemplateManagerPage channel="email" />} />
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/site-visits" element={<SiteVisitsPage />} />


          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* SaaS */}
          <Route path="/get-started" element={<GetStartedPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/lead-sources" element={<LeadSourcesPage />} />
          <Route path="/routing" element={<RoutingPage />} />
          <Route path="/quotes" element={<QuotesPage />} />
          <Route path="/channel-partners" element={<ChannelPartnersPage />} />
          <Route path="/ai-calling" element={<AiCallingPage />} />
        </Route>
      </Route>

      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
