function promisify(fn, ctx) {
  return (...args) => new Promise((resolve, reject) => {
    fn.call(ctx, ...args, (err, result) => err ? reject(err) : resolve(result));
  });
}

export function createLegacyAdapter(webAuth, options) {
  if (!webAuth || typeof webAuth.checkSession !== 'function') {
    throw new Error('auth0-js legacy adapter requires a WebAuth instance with checkSession.');
  }
  const checkSession = promisify(webAuth.checkSession, webAuth);
  const audience = options && options.audience;
  const scope    = options && options.scope;

  let lastAuthResult = null;

  return {
    kind: 'legacy',
    async getAccessToken() {
      const result = await checkSession({ audience, scope });
      lastAuthResult = result;
      if (!result || !result.accessToken) throw new Error('auth0-js checkSession returned no accessToken.');
      return result.accessToken;
    },
    async getUser() {
      if (lastAuthResult && lastAuthResult.idTokenPayload) return lastAuthResult.idTokenPayload;
      if (!lastAuthResult || !lastAuthResult.accessToken) return null;
      if (typeof webAuth.client?.userInfo !== 'function') return null;
      return new Promise((resolve) => {
        webAuth.client.userInfo(lastAuthResult.accessToken, (err, user) => resolve(err ? null : user));
      });
    },
    async isAuthenticated() {
      try {
        await checkSession({ audience, scope });
        return true;
      } catch {
        return false;
      }
    },
    async logout(opts) {
      if (typeof webAuth.logout !== 'function') return;
      const returnTo = typeof location !== 'undefined' ? location.origin : undefined;
      webAuth.logout({ returnTo, federated: !opts?.localOnly });
    },
  };
}
