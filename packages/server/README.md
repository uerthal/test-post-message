# @maxipublica/auth-sync-server

Reference WebSocket relay for [`@maxipublica/auth-sync`](../client/). Validates Auth0 access tokens against your tenant JWKS and fans events out only to other connections authenticated for the same `sub`.

## Run

```bash
cp .env.example .env   # fill in AUTH0_DOMAIN and AUTH0_AUDIENCE
npm install
npm start              # listens on ws://0.0.0.0:8081 by default
```

## Environment variables

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `AUTH0_DOMAIN` | yes | — | e.g. `tenant.us.auth0.com` |
| `AUTH0_AUDIENCE` | yes | — | Access token audience |
| `AUTH0_ISSUER` | no | `https://$AUTH0_DOMAIN/` | Override if you use a custom domain |
| `WS_PORT` | no | `8081` | |
| `ALLOWED_ORIGINS` | no | `*` | Comma list; supports `https://*.domain` |
| `LOG_LEVEL` | no | `info` | `debug` / `info` / `warn` / `error` |

## Protocol summary

1. Client connects with subprotocol `auth-sync.v1`.
2. Server sends `HELLO { serverVersion, authTimeoutMs }`.
3. Client sends `AUTH { token }` within `authTimeoutMs` (5s default).
4. Server verifies the JWT against the Auth0 JWKS, checks `iss` / `aud` / `exp`, records the `sub`.
5. Server responds `AUTH_OK { sub, expiresAt }` or `AUTH_FAIL { reason }` (and closes).
6. Relayable events from authenticated clients (`LOGIN`, `LOGOUT`, `USER_SWITCHED`, `TOKEN_REFRESHED`, `SESSION_EXPIRED`) are re-stamped with the connection's `sub` and forwarded to every other connection sharing that `sub`. Client-supplied `meta` is **discarded** and replaced with `{ sub, sourceClientId, sourceApp }`.

## Test

```bash
npm test
```
