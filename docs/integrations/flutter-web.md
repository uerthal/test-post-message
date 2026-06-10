# Flutter Web

Flutter Web does not expose a JS-friendly Auth0 SDK out of the box. Two practical options:

## Option A — Use `@auth0/auth0-spa-js` from `web/index.html` and a generic adapter

Load both scripts in `web/index.html`:

```html
<script src="https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js"></script>
<script src="https://cdnjs.maxipublica.com/js/auth-sync@0.1.0.min.js"></script>
<script>
  window.__bootAuthSync = async () => {
    const auth0Client = await auth0.createAuth0Client({
      domain: 'YOUR_TENANT.us.auth0.com',
      clientId: 'YOUR_CLIENT_ID',
      authorizationParams: { audience: 'https://api.maxipublica.com' },
      cacheLocation: 'localstorage',
    });
    window.__auth0Client = auth0Client;

    AuthSync.init({
      socketUrl: 'wss://sync.maxipublica.com',
      appName: 'mobile-web',
      auth0Client,
      onLogout:         () => location.reload(),
      onUserSwitch:     () => location.reload(),
      onSessionExpired: () => location.assign('/login'),
    });
  };
</script>
```

Call it from Dart after the engine is ready:

```dart
import 'dart:js_interop';

@JS('__bootAuthSync')
external JSPromise<JSAny?> _bootAuthSync();

Future<void> initAuthSync() => _bootAuthSync().toDart;
```

## Option B — Provide a Dart-side adapter

If your Flutter app already holds the access token (e.g. obtained via `flutter_appauth`), bridge it manually:

```dart
import 'dart:js_interop';

@JS('AuthSync.init')
external void initAuthSync(JSAny options);

initAuthSync(jsifyAdapter(
  socketUrl: 'wss://sync.maxipublica.com',
  appName: 'mobile-web',
  adapter: jsifyAdapter(
    getAccessToken: () => myTokenStore.getToken(),
    getUser:        () => myUser.toJsMap(),
    isAuthenticated:() => myUser != null,
    logout:         () => myAuth.logout(),
  ),
));
```

(Boilerplate for `jsifyAdapter` will depend on your `package:js`/`js_interop` setup.)
