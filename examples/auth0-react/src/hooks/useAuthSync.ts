import { useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import AuthSync from '@maxipublica/auth-sync';

export function useAuthSync() {
  const auth0 = useAuth0();
  const auth0Ref = useRef(auth0);
  auth0Ref.current = auth0;

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_AUTH_SYNC_URL;
    if (!socketUrl) {
      console.warn('VITE_AUTH_SYNC_URL not configured');
      return;
    }

    AuthSync.init({
      socketUrl,
      adapter: 'react',
      auth0Client: () => auth0Ref.current,
      forceLocalLogoutOnRemote: true,
      debug: true,
    });

    return () => AuthSync.destroy();
  }, []);
}
