import { create } from 'zustand';

/**
 * Access token lives only in memory (never localStorage) to reduce XSS blast radius.
 * The refresh token lives in an httpOnly cookie set by the backend and is invisible to JS.
 * On app load, `bootstrapAuth()` calls /auth/refresh to silently obtain a fresh access token
 * if a valid refresh cookie exists.
 *
 * SaaS: `org` is the logged-in user's company (plan, limits, usage, WhatsApp).
 * `support` is set when Visitsly staff open this company from the admin panel.
 */

export const useAuthStore = create((set) => ({
  user: null,
  org: null,
  accessToken: null,
  isAuthReady: false,
  // Visitsly support session (opened from the separate admin panel): no refresh token.
  support: null,

  setSession: (user, accessToken, org) => set((state) => ({ user, accessToken, isAuthReady: true, org: org === undefined ? state.org : org })),

  setAccessToken: (accessToken) => set({ accessToken }),

  setOrg: (org) => set({ org }),

  setUser: (user) => set({ user }),

  startSupport: (orgName) => set({ support: { orgName } }),

  clearSession: () => set({ user: null, org: null, accessToken: null, isAuthReady: true, support: null }),

  markAuthReady: () => set({ isAuthReady: true }),
}));

/** Company roles: 'owner' or 'agent' (a legacy 'manager' is treated as an agent). Visitsly support acts as owner. */
export function useOrgRole() {
  const user = useAuthStore((s) => s.user);
  const support = useAuthStore((s) => s.support);
  if (support) return 'owner';
  const role = user?.orgRole || 'owner';
  return role === 'owner' ? 'owner' : 'agent';
}

/**
 * Permission check fed by the logged-in user's `permissions` (returned by login and /auth/me).
 *   const can = useCan();
 *   can('leadDelete')              → true for the owner, or an agent with that toggle
 *   can.any('leads', 'inbox')      → at least one
 * This only decides what the UI shows — the backend enforces every permission again.
 */
export function useCan() {
  const user = useAuthStore((s) => s.user);
  const role = useOrgRole();
  const perms = user?.permissions || {};
  const can = (...keys) => role === 'owner' || keys.every((k) => perms[k] === true);
  can.any = (...keys) => role === 'owner' || keys.some((k) => perms[k] === true);
  can.role = role;
  return can;
}

/** Plans with team logins (Starter and Trial are owner-only). */
export const TEAM_PLANS = ['growth', 'builder', 'enterprise'];
export const teamAvailable = (org) => TEAM_PLANS.includes(org?.plan);
