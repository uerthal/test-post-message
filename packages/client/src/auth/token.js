function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const normalized = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') return atob(normalized);
  if (typeof Buffer !== 'undefined') return Buffer.from(normalized, 'base64').toString('binary');
  throw new Error('No base64 decoder available');
}

export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const binary = base64UrlDecode(parts[1]);
    let json;
    if (typeof TextDecoder !== 'undefined') {
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      json = new TextDecoder('utf-8').decode(bytes);
    } else {
      json = decodeURIComponent(escape(binary));
    }
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getExpiryMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000;
}

export function getSub(token) {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload.sub === 'string' ? payload.sub : null;
}
