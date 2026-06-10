# AngularJS (1.x) + `@auth0/auth0-spa-js` v2

```html
<!-- index.html -->
<script src="https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js"></script>
<script src="https://cdnjs.maxipublica.com/js/auth-sync@0.1.0.min.js"></script>
```

Create an AngularJS service that owns the SPA-JS client and wires AuthSync:

```js
angular.module('app').factory('authSyncService', function ($rootScope, $window) {
  var auth0Client;

  function init() {
    return auth0.createAuth0Client({
      domain: 'YOUR_TENANT.us.auth0.com',
      clientId: 'YOUR_CLIENT_ID',
      authorizationParams: { audience: 'https://api.maxipublica.com' },
      cacheLocation: 'localstorage',
    }).then(function (client) {
      auth0Client = client;

      $window.AuthSync.init({
        socketUrl: 'wss://sync.maxipublica.com',
        appName: 'crm-angularjs',
        auth0Client: auth0Client,
        onLogin:          function (e) { $rootScope.$applyAsync(function () { $rootScope.$broadcast('auth:login', e); }); },
        onLogout:         function (e) { $rootScope.$applyAsync(function () { $rootScope.$broadcast('auth:logout', e); }); $window.location.reload(); },
        onUserSwitch:     function (e) { $rootScope.$applyAsync(function () { $rootScope.$broadcast('auth:user-switch', e); }); $window.location.reload(); },
        onSessionExpired: function ()  { $window.location.assign('/login'); },
      });

      return auth0Client;
    });
  }

  return { init: init, getClient: function () { return auth0Client; } };
});

angular.module('app').run(function (authSyncService) { authSyncService.init(); });
```

> AuthSync's event callbacks are not invoked inside an `$apply` cycle. Wrap state changes in `$rootScope.$applyAsync` (or `$scope.$apply`) so Angular re-renders.
