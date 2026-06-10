import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeParse, isRelayable, envelope, MessageType, PROTOCOL_VERSION } from '../src/protocol.js';

test('safeParse rejects malformed JSON', () => {
  assert.equal(safeParse('not json'), null);
  assert.equal(safeParse('{"no":"type"}'), null);
  assert.deepEqual(safeParse('{"type":"LOGIN"}'), { type: 'LOGIN' });
});

test('isRelayable only allows known event types', () => {
  assert.equal(isRelayable(MessageType.LOGIN), true);
  assert.equal(isRelayable(MessageType.LOGOUT), true);
  assert.equal(isRelayable(MessageType.USER_SWITCHED), true);
  assert.equal(isRelayable(MessageType.AUTH), false);
  assert.equal(isRelayable(MessageType.PING), false);
  assert.equal(isRelayable('CUSTOM'), false);
});

test('envelope shape', () => {
  const e = envelope(MessageType.LOGIN, { x: 1 }, { sub: 's' });
  assert.equal(e.v, PROTOCOL_VERSION);
  assert.equal(e.type, MessageType.LOGIN);
  assert.equal(e.payload.x, 1);
  assert.equal(e.meta.sub, 's');
  assert.ok(typeof e.id === 'string' && e.id.length > 0);
});
