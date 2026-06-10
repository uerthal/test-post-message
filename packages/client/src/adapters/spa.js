export function createSpaJsAdapter(client) {
  return {
    kind: 'spa',
    async getAccessToken(opts) {
      return client.getTokenSilently({ cacheMode: opts?.ignoreCache ? 'off' : 'on' });
    },
    async getUser() {
      const user = await client.getUser();
      return user || null;
    },
    async isAuthenticated() {
      return !!(await client.isAuthenticated());
    },
    async logout(opts) {
      if (opts?.localOnly) {
        if (typeof client.logout === 'function') {
          return client.logout({ openUrl: false, localOnly: true });
        }
        return;
      }
      return client.logout({ logoutParams: { returnTo: typeof location !== 'undefined' ? location.origin : undefined } });
    },
  };
}
