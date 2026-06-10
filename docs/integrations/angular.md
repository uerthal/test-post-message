# Angular + `auth0-js` (legacy)

If your project still uses the legacy `auth0-js` library (`WebAuth`), use the `legacy` adapter.

```ts
// app.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { WebAuth } from 'auth0-js';

declare const AuthSync: any;

@Component({ selector: 'app-root', template: '<router-outlet></router-outlet>' })
export class AppComponent implements OnInit, OnDestroy {
  private webAuth = new WebAuth({
    domain: environment.auth0.domain,
    clientID: environment.auth0.clientId,
    audience: environment.auth0.audience,
    responseType: 'token id_token',
    scope: 'openid profile email',
  });

  ngOnInit() {
    AuthSync.init({
      socketUrl: environment.authSync.url,
      appName: 'console',
      auth0Client: this.webAuth,
      adapter: 'legacy',
      adapterOptions: {
        audience: environment.auth0.audience,
        scope: 'openid profile email',
      },
      onLogout:         () => location.reload(),
      onUserSwitch:     () => location.reload(),
      onSessionExpired: () => this.webAuth.authorize(),
    });
  }

  ngOnDestroy() { AuthSync.destroy(); }
}
```

`index.html`:

```html
<script src="https://cdnjs.maxipublica.com/js/auth-sync@0.1.0.min.js"></script>
```

> The legacy adapter calls `webAuth.checkSession()` to retrieve a fresh access token whenever AuthSync needs one. Silent auth must be enabled in your Auth0 tenant.

## Angular + `@auth0/auth0-angular`

`@auth0/auth0-angular` wraps `@auth0/auth0-spa-js`. Pull out the underlying client via the `Auth0ClientService` token (Angular SDK v2+) and pass it directly:

```ts
import { Auth0ClientService } from '@auth0/auth0-angular';
import { Inject } from '@angular/core';

constructor(@Inject(Auth0ClientService) private auth0: Auth0Client) {}

ngOnInit() {
  AuthSync.init({ socketUrl: '...', auth0Client: this.auth0 }); // autodetected as spa
}
```
