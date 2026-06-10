import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/registry.js';

test('registry groups by sub and excludes sender', () => {
  const r = createRegistry();
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };
  r.add('u1', a);
  r.add('u1', b);
  r.add('u2', c);

  const peersOfA = r.peers('u1', a);
  assert.deepEqual(peersOfA.map(p => p.id), ['b']);
  assert.equal(r.countSub('u1'), 2);
  assert.equal(r.totalConnections(), 3);

  r.remove('u1', a);
  assert.equal(r.countSub('u1'), 1);
});
