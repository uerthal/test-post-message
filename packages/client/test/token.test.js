import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, getExpiryMs, getSub } from '../src/auth/token.js';

function makeJwt(payload) {
  const header  = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const body    = btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.sig`;
}

describe('token decode', () => {
  it('decodes the payload', () => {
    const token = makeJwt({ sub: 'auth0|42', exp: 1700000000 });
    expect(decodeJwtPayload(token)).toEqual({ sub: 'auth0|42', exp: 1700000000 });
  });

  it('extracts exp in ms', () => {
    const token = makeJwt({ exp: 1700000000 });
    expect(getExpiryMs(token)).toBe(1700000000 * 1000);
  });

  it('extracts sub', () => {
    const token = makeJwt({ sub: 'auth0|7' });
    expect(getSub(token)).toBe('auth0|7');
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtPayload('not a jwt')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
  });
});
