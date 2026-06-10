# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`auth-sync` — a drop-in script that synchronizes Auth0 session events (login, logout, user-switch, token refresh, session expiry) across multiple frontend apps (React, Angular, AngularJS, Next.js, Vanilla, Flutter Web) that share the same Auth0 user. Distributed as a single UMD/ESM bundle via `cdnjs.maxipublica.com` + npm.

The repo is an npm workspaces monorepo. The previous proof-of-concept lives under [examples/poc/](examples/poc/) for reference and is **not** the product.

## Layout

| Path | Role |
| --- | --- |
| [packages/client/](packages/client/) | The distributable client bundle. Source in ESM JS with JSDoc, Rollup build → UMD + ESM (full + min) + hand-written `.d.ts` |
| [packages/server/](packages/server/) | Reference Node.js WebSocket relay with Auth0 JWKS validation |
| [docs/integrations/](docs/integrations/) | Per-framework recipes (react / angular / angularjs / nextjs / vanilla / flutter-web) |
| [examples/poc/](examples/poc/) | Original three-page POC; runnable but legacy |

## Commands

From the repo root (npm workspaces):

- `npm install` — installs both packages.
- `npm run build:client` — bundles `packages/client/src/` to `packages/client/dist/` (UMD + ESM, full + min, sourcemaps, copies `types/auth-sync.d.ts` to `dist/`).
- `npm run start:server` — starts the relay (needs `packages/server/.env` with `AUTH0_DOMAIN` + `AUTH0_AUDIENCE`).
- `npm run test:client` — vitest in jsdom for the client.
- `npm run test:server` — `node --test` for the server.
- `npm test` — both.

POC ([examples/poc/](examples/poc/)): `cd examples/poc && npm install && npm run start:ws` then serve the HTML over HTTP.

## Architecture

### Three layers

1. **Public facade** ([packages/client/src/index.js](packages/client/src/index.js)) — `AuthSync.init / on / off / notifyX / getState / destroy`. Holds a single singleton; `init()` called twice closes the previous instance and rebuilds.

2. **Coordinator** ([packages/client/src/core/leader.js](packages/client/src/core/leader.js)) — elects one tab per origin as *leader* using `navigator.locks` (fallback: `localStorage` heartbeat). Only the leader holds the WebSocket; follower tabs receive events via `BroadcastChannel`. This is why N tabs of the same app produce **one** server connection.

3. **WS client** ([packages/client/src/core/client.js](packages/client/src/core/client.js)) — connects with subprotocol `auth-sync.v1`, performs `AUTH { token }` handshake (5s deadline), schedules proactive token refresh via [scheduler.js](packages/client/src/auth/scheduler.js) at `exp − tokenRefreshSkewSec`, exponential-backoff reconnect with jitter, persists outbound queue in `sessionStorage` while down (`auth-sync.queue.v1`).

### Auth0 adapter detection

[packages/client/src/adapters/detect.js](packages/client/src/adapters/detect.js) duck-types the `auth0Client` passed to `init`:

- `getTokenSilently + getUser` → **spa** (`@auth0/auth0-spa-js` v2)
- `getAccessTokenSilently + isAuthenticated` field → **react** (`@auth0/auth0-react` `useAuth0()` snapshot)
- `checkSession + parseHash` → **legacy** (`auth0-js`)
- otherwise → user must pass `adapter: 'spa'|'react'|'legacy'|customAdapter`

The React adapter accepts a getter so it always reads the latest hook snapshot.

### Event semantics

The wire protocol carries `LOGIN`, `LOGOUT`, `USER_SWITCHED`, `TOKEN_REFRESHED`, `SESSION_EXPIRED`. The local adapter loop polls (or uses `onAuthStateChanged` if available) and emits the right wire event:

- Adapter sub changes anonymously → `LOGIN` / `LOGOUT`
- Adapter sub goes from `A` to `B` (no anonymous state in between) → single `USER_SWITCHED` (no logout/login coalescing dance)

Remote receipt behavior is opinionated:
- `LOGIN` remote → emit `login` event only (the receiving app decides).
- `LOGOUT` remote → call `adapter.logout({ localOnly: true })` **and** emit `logout`. Override with `forceLocalLogoutOnRemote: false`.
- `SESSION_EXPIRED` → same as LOGOUT.

### Server contract

[packages/server/src/server.js](packages/server/src/server.js):

1. Reject any subprotocol other than `auth-sync.v1`.
2. Send `HELLO`, expect `AUTH { token }` within `authTimeoutMs`.
3. Validate JWT against Auth0 JWKS ([auth/verify.js](packages/server/src/auth/verify.js) uses `jose.jwtVerify` with `iss`, `aud`, `exp`, RS256).
4. Register connection by `sub` ([registry.js](packages/server/src/registry.js)).
5. Relay only the whitelisted event types ([protocol.js `isRelayable`](packages/server/src/protocol.js)) and **only** to other connections with the same `sub`, sender excluded.
6. **Antispoof rule**: server discards client-supplied `meta` on relayable events and rewrites it with `{ sub, sourceClientId, sourceApp }` from the authenticated connection. A client cannot impersonate another `sub`.
7. `REAUTH` on an authenticated connection with a different `sub` is treated as a user-switch on that connection: emits `LOGOUT` to old peers, `LOGIN` to new peers, never disconnects.

## Things to know before changing the protocol

- The envelope `{ v, type, id, ts, payload, meta }` is shared between [packages/client/src/core/envelope.js](packages/client/src/core/envelope.js) and [packages/server/src/protocol.js](packages/server/src/protocol.js). They are intentionally duplicated (no shared package) because the client must ship as a self-contained bundle. **Both files need to move together.**
- New relayable event types must be added to (a) `MessageType` in both files, (b) the `RELAYABLE` set in the server, (c) the switch in [client.js onMessage](packages/client/src/index.js), (d) the `.d.ts` event union.
- Bumping `PROTOCOL_VERSION` is the breakpoint for incompatible changes — the server should then reject mismatched `v` from the client during `AUTH`.

## Distribution

Built artifacts land in `packages/client/dist/` and are uploaded to `https://cdnjs.maxipublica.com/js/auth-sync@<version>.{js,min.js}` (UMD) / `.esm.{js,min.js}`. The CI workflow at [.github/workflows/build.yml](.github/workflows/build.yml) runs tests and uploads the dist as an artifact; an actual release/deploy job is left for the team's pipeline.
