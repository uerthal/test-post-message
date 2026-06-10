import { describe, it, expect, vi } from 'vitest';
import { resolveAdapter } from '../src/adapters/detect.js';

describe('adapter detection', () => {
  it('detects @auth0/auth0-spa-js v2', async () => {
    const client = {
      getTokenSilently: vi.fn(async () => 'TOK'),
      getUser:          vi.fn(async () => ({ sub: 'auth0|1' })),
      isAuthenticated:  vi.fn(async () => true),
      logout:           vi.fn(),
    };
    const adapter = resolveAdapter({ auth0Client: client });
    expect(adapter.kind).toBe('spa');
    await expect(adapter.getAccessToken()).resolves.toBe('TOK');
    expect((await adapter.getUser()).sub).toBe('auth0|1');
  });

  it('detects an @auth0/auth0-react snapshot', async () => {
    const snapshot = {
      getAccessTokenSilently: vi.fn(async () => 'TOK'),
      user: { sub: 'auth0|2' },
      isAuthenticated: true,
      logout: vi.fn(),
    };
    const adapter = resolveAdapter({ auth0Client: snapshot });
    expect(adapter.kind).toBe('react');
    await expect(adapter.getAccessToken()).resolves.toBe('TOK');
    expect((await adapter.getUser()).sub).toBe('auth0|2');
  });

  it('detects legacy auth0-js WebAuth', async () => {
    const webAuth = {
      checkSession: (opts, cb) => cb(null, { accessToken: 'TOK', idTokenPayload: { sub: 'auth0|3' } }),
      parseHash:    () => {},
      logout:       vi.fn(),
    };
    const adapter = resolveAdapter({ auth0Client: webAuth });
    expect(adapter.kind).toBe('legacy');
    await expect(adapter.getAccessToken()).resolves.toBe('TOK');
    expect((await adapter.getUser()).sub).toBe('auth0|3');
  });

  it('accepts an explicit adapter object', () => {
    const custom = {
      getAccessToken: async () => 'x',
      getUser: async () => null,
      isAuthenticated: async () => false,
      logout: async () => {},
    };
    const adapter = resolveAdapter({ adapter: custom, auth0Client: null });
    expect(adapter).toBe(custom);
  });

  it('throws when nothing matches', () => {
    expect(() => resolveAdapter({ auth0Client: { foo: 'bar' } })).toThrow(/could not detect/i);
  });
});
