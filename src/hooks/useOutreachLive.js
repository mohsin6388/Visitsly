import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket.js';
import { useOrgRole } from '../store/authStore.js';
import { outreachApi } from '../api/outreachApi.js';

export const SUMMARY_KEY = ['outreach', 'summary'];

/**
 * Listens to the backend worker's realtime events:
 *   outreach:job       -> ek lead ka status badla (processing -> sent/failed)
 *   outreach:progress  -> campaign ke channel-wise counts
 *   outreach:campaign  -> campaign pause/resume/cancel/complete/launch
 * Handlers live in a ref, so we don't re-subscribe on every render.
 */
export function useOutreachEvents({ onJob, onProgress, onCampaign, onReconnect }) {
  const handlers = useRef({});
  handlers.current = { onJob, onProgress, onCampaign, onReconnect };

  useEffect(() => {
    const socket = getSocket();
    const job = (p) => handlers.current.onJob?.(p);
    const progress = (p) => handlers.current.onProgress?.(p);
    const campaign = (p) => handlers.current.onCampaign?.(p);
    const reconnect = () => handlers.current.onReconnect?.();

    socket.on('outreach:job', job);
    socket.on('outreach:progress', progress);
    socket.on('outreach:campaign', campaign);
    socket.io.on('reconnect', reconnect);
    return () => {
      socket.off('outreach:job', job);
      socket.off('outreach:progress', progress);
      socket.off('outreach:campaign', campaign);
      socket.io.off('reconnect', reconnect);
    };
  }, []);
}

/** Plain query (inside a page). Live refresh is done by the DashboardLayout hook. */
export function useOutreachSummaryQuery() {
  // SaaS: agents have no bulk sending.
  const role = useOrgRole();
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => outreachApi.summary().then((r) => r.data.data),
    staleTime: 10_000,
    enabled: role !== 'agent',
  });
}

/**
 * For the sidebar: summary + throttled refetch on socket events.
 * Use once, in DashboardLayout only.
 */
export function useOutreachSummaryLive() {
  const qc = useQueryClient();
  const timer = useRef(null);

  const refresh = useCallback(() => {
    if (timer.current) return; // at most one refetch per 1.5s, not one per message
    timer.current = setTimeout(() => {
      timer.current = null;
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    }, 1500);
  }, [qc]);

  useOutreachEvents({ onJob: refresh, onCampaign: refresh, onReconnect: refresh });
  useEffect(() => () => clearTimeout(timer.current), []);

  return useOutreachSummaryQuery();
}
