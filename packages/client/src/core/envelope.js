import { uuid } from './uuid.js';

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

export function buildEnvelope(type, payload, meta) {
  return {
    v: PROTOCOL_VERSION,
    type,
    id: uuid(),
    ts: Date.now(),
    payload: payload || {},
    meta: meta || {},
  };
}

export function safeParse(raw) {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.type !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}

export function isValidEnvelope(msg) {
  return !!msg && typeof msg === 'object' && typeof msg.type === 'string';
}
