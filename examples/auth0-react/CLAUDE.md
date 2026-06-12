# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 8080
npm run build     # Type-check (tsc -b) then build with Vite
npm run lint      # ESLint across the project
npm run preview   # Preview production build locally
```

There is no test suite configured.

## Architecture

Single-page Auth0 authentication demo app — React 19 + TypeScript + Vite. No routing library; the entire app is a single conditional render in `App.tsx` based on Auth0 state.

**Auth flow:**
- `main.tsx` validates `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` env vars at startup and throws if missing; it also `console.warn`s if the domain doesn't match known Auth0 suffixes (`.auth0.com`, `.us.auth0.com`, etc.) — this is a warning only, not a hard failure, so custom domains like `auth.maxipublica.com` work fine.
- `Auth0Provider` wraps the whole app; `redirect_uri` is set to `window.location.origin`.
- `App.tsx` uses `useAuth0()` to branch on `isLoading` / `error` / `isAuthenticated`.
- `LogoutButton` passes `logoutParams: { returnTo: window.location.origin }` — this URL must be whitelisted in the Auth0 dashboard under Allowed Logout URLs.

**Token display (`Profile.tsx`):**
- Fetches both Access Token (`getAccessTokenSilently`) and ID Token (`getIdTokenClaims().__raw`) on mount.
- Includes a client-side JWT decoder that splits on `.` and base64url-decodes header and payload. Opaque/JWE tokens that can't be decoded are caught and shown as-is.
- Uses inline styles throughout (not CSS classes), unlike the rest of the app.

## Environment Variables

A `.env` file already exists at the project root. Edit it directly:

```
VITE_AUTH0_DOMAIN=     # e.g. auth.maxipublica.com
VITE_AUTH0_CLIENT_ID=  # Auth0 application client ID
```

All Vite env vars must be prefixed `VITE_` to be exposed to the browser bundle.

**Auth0 dashboard requirements** — the following URLs must be configured in the Auth0 application settings:
- Allowed Callback URLs: `http://localhost:8080`
- Allowed Logout URLs: `http://localhost:8080`
- Allowed Web Origins: `http://localhost:8080`

## ESLint Config

Uses ESLint 9 flat config (`eslint.config.js`) — not the legacy `.eslintrc` format. React Hooks and React Refresh rules are enabled.
