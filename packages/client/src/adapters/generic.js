export function createGenericAdapter(impl) {
  const required = ['getAccessToken', 'getUser', 'isAuthenticated', 'logout'];
  for (const fn of required) {
    if (typeof impl?.[fn] !== 'function') {
      throw new Error(`Generic adapter is missing required method: ${fn}`);
    }
  }
  return { kind: 'generic', ...impl };
}
