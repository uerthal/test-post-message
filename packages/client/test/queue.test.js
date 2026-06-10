import { describe, it, expect, beforeEach } from 'vitest';
import { createQueue } from '../src/core/queue.js';

describe('queue', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('persists across instances', () => {
    const q1 = createQueue({ logger: { debug() {}, warn() {} } });
    q1.enqueue({ type: 'LOGIN', id: '1', ts: Date.now(), payload: {}, meta: {} });
    const q2 = createQueue({ logger: { debug() {}, warn() {} } });
    expect(q2.size()).toBe(1);
  });

  it('drains FIFO', () => {
    const q = createQueue({ logger: { debug() {}, warn() {} } });
    q.enqueue({ type: 'LOGIN',  id: '1', ts: 1, payload: {}, meta: {} });
    q.enqueue({ type: 'LOGOUT', id: '2', ts: 2, payload: {}, meta: {} });
    const seen = [];
    q.drain((e) => { seen.push(e.type); return true; });
    expect(seen).toEqual(['LOGIN', 'LOGOUT']);
    expect(q.size()).toBe(0);
  });

  it('respects cap', () => {
    const q = createQueue({ cap: 2, logger: { debug() {}, warn() {} } });
    q.enqueue({ id: '1' }); q.enqueue({ id: '2' }); q.enqueue({ id: '3' });
    expect(q.size()).toBe(2);
  });
});
