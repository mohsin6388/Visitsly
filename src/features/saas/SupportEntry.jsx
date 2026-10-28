import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';

/**
 * /support#token=…&org=… — opened from the separate Visitsly admin panel.
 * The token is a 60-minute customer-app token for one company; it lives
 * only in memory (no cookie), so closing the tab ends the session.
 */
export default function SupportEntry() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    const orgName = params.get('org') || '';
    window.history.replaceState(null, '', '/support'); // drop the token from the address bar
    if (!token) {
      setError('Support link adhoora hai. Admin panel se dobara kholiye.');
      return;
    }
    const store = useAuthStore.getState();
    store.setAccessToken(token);
    store.startSupport(orgName);
    authApi.me()
      .then((me) => {
        store.setSession(me.data.user, token, me.data.org);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        store.clearSession();
        setError('Support link expire ho gaya. Admin panel se naya link banaiye.');
      });
  }, [navigate]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      {error ? <p className="max-w-sm text-sm text-red-600">{error}</p> : <><Loader2 className="animate-spin text-ink-400" /><p className="text-sm text-ink-500">Support session khul raha hai…</p></>}
    </div>
  );
}
