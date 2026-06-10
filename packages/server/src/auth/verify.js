import { jwtVerify } from 'jose';
import { getJwks } from './jwks.js';

const FALLBACK_ISSUER = () => `https://${process.env.AUTH0_DOMAIN}/`;

export async function verifyAccessToken(token) {
  if (typeof token !== 'string' || !token) {
    throw new Error('Missing token');
  }
  const audience = process.env.AUTH0_AUDIENCE;
  if (!audience) {
    throw new Error('AUTH0_AUDIENCE environment variable is required.');
  }
  const issuer = process.env.AUTH0_ISSUER || FALLBACK_ISSUER();
  const { payload } = await jwtVerify(token, getJwks(), { audience, issuer, algorithms: ['RS256'] });
  if (!payload.sub) throw new Error('Token has no sub claim.');
  return payload;
}
