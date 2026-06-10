# @maxipublica/auth-sync

Cross-frontend Auth0 session sync client. Drop-in `<script>` (UMD) or ESM import.

```html
<script src="https://cdnjs.maxipublica.com/js/auth-sync@0.1.0.min.js"></script>
<script>
  AuthSync.init({
    socketUrl: 'wss://sync.maxipublica.com',
    auth0Client: myAuth0Client,
    onLogout: () => location.reload(),
  });
</script>
```

See [`../../docs/integrations/`](../../docs/integrations/) for per-framework recipes.

## Build

```bash
npm install
npm run build
```

Outputs to `dist/`:

| File | Format | Min |
| --- | --- | --- |
| `auth-sync.umd.js` | UMD (global `AuthSync`) | no |
| `auth-sync.umd.min.js` | UMD | yes |
| `auth-sync.esm.js` | ESM | no |
| `auth-sync.esm.min.js` | ESM | yes |
| `auth-sync.d.ts` | TypeScript types | — |

## Test

```bash
npm test
```
