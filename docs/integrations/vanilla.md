# Vanilla JS + `@auth0/auth0-spa-js`

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js"></script>
  <script src="https://cdnjs.maxipublica.com/js/auth-sync@0.1.0.min.js"></script>
</head>
<body>
<script>
  (async () => {
    const auth0Client = await auth0.createAuth0Client({
      domain: 'YOUR_TENANT.us.auth0.com',
      clientId: 'YOUR_CLIENT_ID',
      authorizationParams: { audience: 'https://api.maxipublica.com' },
      cacheLocation: 'localstorage',
    });

    AuthSync.init({
      socketUrl: 'wss://sync.maxipublica.com',
      appName: 'admin-vanilla',
      auth0Client,                       // autodetected → spa adapter
      onLogout:        () => location.reload(),
      onUserSwitch:    () => location.reload(),
      onSessionExpired:() => location.assign('/login'),
      debug: false,
    });
  })();
</script>
</body>
</html>
```

The script autodetects the SPA-JS v2 client. No additional config required.
