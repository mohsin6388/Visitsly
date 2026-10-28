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

/** Company role helpers (owner > manager > agent). Visitsly support acts as owner. */
export function useOrgRole() {
  const user = useAuthStore((s) => s.user);
  const support = useAuthStore((s) => s.support);
  if (support) return 'owner';
  return user?.orgRole || 'owner';
}
