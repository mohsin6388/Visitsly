import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, org, support, isAuthReady } = useAuthStore();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Onboarding wizard gate: a new workspace (profileDone === false) must finish
  // it before any other page; once it's done, /onboarding sends you home.
  const onOnboarding = location.pathname === '/onboarding';
  const mustOnboard = !support && Boolean(org) && org.profileDone === false;
  if (mustOnboard && !onOnboarding) return <Navigate to="/onboarding" replace />;
  if (onOnboarding && !mustOnboard) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
