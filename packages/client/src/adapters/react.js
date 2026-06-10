function resolve(snapshot) {
  return typeof snapshot === 'function' ? snapshot() : snapshot;
}

export function createReactAdapter(snapshotOrGetter) {
  return {
    kind: 'react',
    async getAccessToken(opts) {
      const s = resolve(snapshotOrGetter);
      if (!s || typeof s.getAccessTokenSilently !== 'function') {
        throw new Error('Auth0 React snapshot is missing getAccessTokenSilently.');
      }
      return s.getAccessTokenSilently(opts?.ignoreCache ? { cacheMode: 'off' } : undefined);
    },
    async getUser() {
      const s = resolve(snapshotOrGetter);
      return (s && s.user) || null;
    },
    async isAuthenticated() {
      const s = resolve(snapshotOrGetter);
      return !!(s && s.isAuthenticated);
    },
    async logout(opts) {
      const s = resolve(snapshotOrGetter);
      if (!s || typeof s.logout !== 'function') return;
      if (opts?.localOnly) {
        return s.logout({ openUrl: false, localOnly: true });
      }
      return s.logout({ logoutParams: { returnTo: typeof location !== 'undefined' ? location.origin : undefined } });
    },
  };
}
