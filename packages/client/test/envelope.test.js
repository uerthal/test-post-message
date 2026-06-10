import { describe, it, expect } from 'vitest';
import { buildEnvelope, safeParse, PROTOCOL_VERSION, MessageType } from '../src/core/envelope.js';

describe('envelope', () => {
  it('builds an envelope with version, id, timestamp', () => {
    const e = buildEnvelope(MessageType.LOGIN, { user: { sub: '1' } }, { clientId: 'c', appName: 'a', origin: 'o' });
    expect(e.v).toBe(PROTOCOL_VERSION);
    expect(e.type).toBe('LOGIN');
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(e.payload.user.sub).toBe('1');
    expect(e.meta).toEqual({ clientId: 'c', appName: 'a', origin: 'o' });
  });

  it('rejects malformed JSON', () => {
    expect(safeParse('not json')).toBeNull();
    expect(safeParse('{}')).toBeNull();
    expect(safeParse('{"x":1}')).toBeNull();
    expect(safeParse('{"type":"LOGIN"}')).toEqual({ type: 'LOGIN' });
  });
});
