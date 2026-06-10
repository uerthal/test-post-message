import { createSpaJsAdapter } from './spa.js';
import { createReactAdapter } from './react.js';
import { createLegacyAdapter } from './legacy.js';
import { createGenericAdapter } from './generic.js';

function isSpaJsClient(c) {
  return c && typeof c.getTokenSilently === 'function' && typeof c.getUser === 'function';
}

function isReactSnapshot(c) {
  if (typeof c === 'function') return true;
  return c && typeof c.getAccessTokenSilently === 'function' && 'isAuthenticated' in c;
}

function isLegacyWebAuth(c) {
  return c && typeof c.checkSession === 'function' && typeof c.parseHash === 'function';
}

function looksLikeAdapter(c) {
  return c && typeof c.getAccessToken === 'function' && typeof c.getUser === 'function';
}

export function resolveAdapter({ adapter, auth0Client, adapterOptions }) {
  if (adapter && typeof adapter === 'object' && looksLikeAdapter(adapter)) {
    return adapter;
  }
  if (typeof adapter === 'string') {
    switch (adapter) {
      case 'spa':     return createSpaJsAdapter(auth0Client);
      case 'react':   return createReactAdapter(auth0Client);
      case 'legacy':  return createLegacyAdapter(auth0Client, adapterOptions);
      case 'generic': return createGenericAdapter(auth0Client);
      default: throw new Error(`Unknown adapter "${adapter}"`);
    }
  }
  if (looksLikeAdapter(auth0Client)) {
    return auth0Client;
  }
  if (isSpaJsClient(auth0Client)) return createSpaJsAdapter(auth0Client);
  if (isReactSnapshot(auth0Client)) return createReactAdapter(auth0Client);
  if (isLegacyWebAuth(auth0Client)) return createLegacyAdapter(auth0Client, adapterOptions);
  throw new Error(
    'AuthSync could not detect the Auth0 SDK shape. Pass `adapter: "spa" | "react" | "legacy"` ' +
    'or a custom adapter object via `init({ adapter })`.'
  );
}
