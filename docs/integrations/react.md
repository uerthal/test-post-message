# React (CRA / Vite) + `@auth0/auth0-react`

Mount AuthSync once, inside `Auth0Provider`. Pass a **getter** so the script always reads the latest snapshot from `useAuth0()`.

```tsx
// AuthSyncBridge.tsx
import { useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export function AuthSyncBridge() {
  const snapshot = useAuth0();
  const ref = useRef(snapshot);
  ref.current = snapshot;

  useEffect(() => {
    const AuthSync = (window as any).AuthSync;
    AuthSync.init({
      socketUrl: import.meta.env.VITE_AUTH_SYNC_URL,
      appName: 'storefront',
      auth0Client: () => ref.current,
      adapter: 'react',
      onLogout:         () => location.reload(),
      onUserSwitch:     () => location.reload(),
      onSessionExpired: () => location.assign('/login'),
    });
    return () => AuthSync.destroy();
  }, []);

  return null;
}
```

```tsx
// main.tsx
import { Auth0Provider } from '@auth0/auth0-react';

createRoot(document.getElementById('root')!).render(
  <Auth0Provider
    domain={import.meta.env.VITE_AUTH0_DOMAIN}
    clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
    authorizationParams={{ audience: import.meta.env.VITE_AUTH0_AUDIENCE }}
  >
    <AuthSyncBridge />
    <App />
  </Auth0Provider>,
);
```

`index.html` loads the bundle:

```html
<script src="https://cdnjs.maxipublica.com/js/auth-sync@0.1.0.min.js"></script>
```

If you prefer ESM, install `@maxipublica/auth-sync` from npm and `import { AuthSync } from '@maxipublica/auth-sync'`.

## Next.js (App Router)

Wrap `AuthSyncBridge` in `"use client"` and mount it inside your root `<Auth0Provider>` client component, exactly the same pattern. The script bundle is browser-only — never import it from a server component or `app/layout.tsx`.
