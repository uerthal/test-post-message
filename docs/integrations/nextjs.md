# Next.js

AuthSync runs only in the browser. Mount it from a `"use client"` component that has access to your Auth0 client (either `@auth0/auth0-react`'s `useAuth0()` or `@auth0/nextjs-auth0`'s client hook).

## With `@auth0/auth0-react`

See [`react.md`](./react.md) — same approach, just wrap with `"use client"`.

## With `@auth0/nextjs-auth0`

`@auth0/nextjs-auth0` does not expose an `Auth0Client` instance directly. Use a **generic adapter** that calls your own `/api/auth/token` endpoint to obtain a fresh access token, and `useUser()` for the user shape:

```tsx
// app/components/AuthSyncBridge.tsx
'use client';
import { useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

export default function AuthSyncBridge() {
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) return;

    const AuthSync = (window as any).AuthSync;

    AuthSync.init({
      socketUrl: process.env.NEXT_PUBLIC_AUTH_SYNC_URL!,
      appName: 'console',
      adapter: {
        async getAccessToken() {
          const res = await fetch('/api/auth/access-token', { credentials: 'include' });
          if (!res.ok) throw new Error('No token');
          const { accessToken } = await res.json();
          return accessToken;
        },
        async getUser()         { return user || null; },
        async isAuthenticated() { return !!user; },
        async logout()          { window.location.assign('/api/auth/logout'); },
      },
      onLogout:         () => location.assign('/api/auth/logout'),
      onUserSwitch:     () => location.reload(),
      onSessionExpired: () => location.assign('/api/auth/login'),
    });

    return () => AuthSync.destroy();
  }, [isLoading, user]);

  return null;
}
```

Add an API route that returns the current access token:

```ts
// app/api/auth/access-token/route.ts
import { getAccessToken } from '@auth0/nextjs-auth0';

export async function GET() {
  const { accessToken } = await getAccessToken();
  return Response.json({ accessToken });
}
```
