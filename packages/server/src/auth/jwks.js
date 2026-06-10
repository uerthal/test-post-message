import { createRemoteJWKSet } from 'jose';

let jwks = null;

export function getJwks() {
  if (jwks) return jwks;
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) {
    throw new Error('AUTH0_DOMAIN environment variable is required.');
  }
  const url = new URL(`https://${domain}/.well-known/jwks.json`);
  jwks = createRemoteJWKSet(url, { cacheMaxAge: 10 * 60 * 1000, cooldownDuration: 30 * 1000 });
  return jwks;
}

export function resetJwksCache() { jwks = null; }
