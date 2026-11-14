import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

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
const VisitConfirmationPage = lazy(() => import('../features/whatsapp/VisitConfirmationPage.jsx'));
const TemplateManagerPage = lazy(() => import('../features/templates/TemplateManagerPage.jsx'));
const SignupPage = lazy(() => import('../features/auth/SignupPage.jsx'));
const VerifyEmailPage = lazy(() => import('../features/auth/VerifyEmailPage.jsx'));
const PricingPage = lazy(() => import('../features/saas/PricingPage.jsx'));
const BillingPage = lazy(() => import('../features/saas/BillingPage.jsx'));
const TeamPage = lazy(() => import('../features/saas/TeamPage.jsx'));
const SupportEntry = lazy(() => import('../features/saas/SupportEntry.jsx'));
const LeadSourcesPage = lazy(() => import('../features/growth/LeadSourcesPage.jsx'));
const ReportsPage = lazy(() => import('../features/growth/ReportsPage.jsx'));
const ChannelPartnersPage = lazy(() => import('../features/growth/ChannelPartnersPage.jsx'));
const PublicFormPage = lazy(() => import('../features/public/PublicFormPage.jsx'));
const CpPortal = lazy(() => import('../features/public/CpPortal.jsx'));





import { authApi } from '../api/authApi.js';
import { useAuthStore } from '../store/authStore.js';

function HomeRedirect() {
  const { user, org, support, isAuthReady } = useAuthStore();
  if (!isAuthReady) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /></div>;
  if (!user && !support) return <Navigate to="/login" replace />;
  const connected = support || (org?.whatsapp?.status === 'connected' && Boolean(org?.whatsapp?.phoneNumberId));
  return <Navigate to={connected ? '/dashboard' : '/whatsapp'} replace />;
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
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<AnalyticsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/qualified-leads" element={<Navigate to="/whatsapp/leads" replace />} />
          <Route path="/whatsapp/leads" element={<LeadsPage key="wa-leads" mode="whatsapp" />} />
          <Route path="/email/leads" element={<Navigate to="/leads" replace />} />
          <Route path="/outreach/whatsapp" element={<OutreachPage channel="whatsapp" />} />
          <Route path="/outreach/email" element={<OutreachPage channel="email" />} />
          <Route path="/email/setup" element={<EmailSetupPage />} />
          <Route path="/email/details" element={<EmailDetailsPage />} />
          <Route path="/email/conversations" element={<Navigate to="/email/details" replace />} />
          <Route path="/email-replies" element={<Navigate to="/email/details" replace />} />
          <Route path="/whatsapp/visit-confirmation" element={<VisitConfirmationPage />} />
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
          <Route path="/get-started" element={<Navigate to="/whatsapp" replace />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/lead-sources" element={<LeadSourcesPage />} />
          <Route path="/routing" element={<Navigate to="/reports" replace />} />
          <Route path="/quotes" element={<Navigate to="/reports" replace />} />
          <Route path="/channel-partners" element={<ChannelPartnersPage />} />
          <Route path="/ai-calling" element={<Navigate to="/whatsapp/visit-confirmation" replace />} />
        </Route>
      </Route>

      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}
