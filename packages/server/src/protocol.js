export const PROTOCOL_VERSION = 1;

export const MessageType = Object.freeze({
  HELLO:            'HELLO',
  AUTH:             'AUTH',
  REAUTH:           'REAUTH',
  AUTH_OK:          'AUTH_OK',
  AUTH_FAIL:        'AUTH_FAIL',
  LOGIN:            'LOGIN',
  LOGOUT:           'LOGOUT',
  USER_SWITCHED:    'USER_SWITCHED',
  TOKEN_REFRESHED:  'TOKEN_REFRESHED',
  SESSION_EXPIRED:  'SESSION_EXPIRED',
  PING:             'PING',
  PONG:             'PONG',
  ERROR:            'ERROR',
});

const RELAYABLE = new Set([
  MessageType.LOGIN,
  MessageType.LOGOUT,
  MessageType.USER_SWITCHED,
  MessageType.TOKEN_REFRESHED,
  MessageType.SESSION_EXPIRED,
]);

export function isRelayable(type) {
  return RELAYABLE.has(type);
}

export function safeParse(raw) {
  try {
    const obj = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
    if (!obj || typeof obj.type !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}

export function envelope(type, payload, meta) {
  return {
    v: PROTOCOL_VERSION,
    type,
    id: cryptoUuid(),
    ts: Date.now(),
    payload: payload || {},
    meta: meta || { source: 'server' },
  };
}

function cryptoUuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
