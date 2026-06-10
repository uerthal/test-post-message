# auth-sync

Cross-frontend Auth0 session synchronization over WebSocket.

A drop-in script that any frontend (React, Angular, AngularJS, Next.js, Vanilla JS, Flutter Web) can include via `<script>` to keep login, logout, and user-switch state coherent across multiple apps and tabs that share the same Auth0 user.

## Repo layout

| Path | What |
| --- | --- |
| [packages/client/](packages/client/) | The distributable `auth-sync.js` bundle (UMD + ESM, full + min) and TypeScript types |
| [packages/server/](packages/server/) | Reference Node.js relay server with Auth0 JWKS validation |
| [docs/integrations/](docs/integrations/) | Per-framework integration guides |
| [examples/poc/](examples/poc/) | Original proof-of-concept (kept for reference, not the product) |

## Quick start

```bash
npm install
npm run build:client     # produces packages/client/dist/*
npm run start:server     # boots the relay on ws://127.0.0.1:8081
```

Open the integration docs for your framework under [docs/integrations/](docs/integrations/).

## Production distribution

Built bundles are published to `https://cdnjs.maxipublica.com/js/auth-sync@<version>.{js,min.js}` (UMD) and `https://cdnjs.maxipublica.com/js/auth-sync@<version>.esm.{js,min.js}` (ESM), plus an npm package `@maxipublica/auth-sync`.
