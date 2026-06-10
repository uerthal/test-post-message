import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../src/core/emitter.js';

describe('emitter', () => {
  it('dispatches to exact and wildcard handlers', () => {
    const emitter = createEmitter();
    const exact = vi.fn();
    const wildcard = vi.fn();
    emitter.on('login', exact);
    emitter.on('*', wildcard);
    emitter.emit('login', { user: { sub: 'a' } });
    expect(exact).toHaveBeenCalledWith({ user: { sub: 'a' } }, 'login');
    expect(wildcard).toHaveBeenCalledWith({ user: { sub: 'a' } }, 'login');
  });

  it('unsubscribes via the returned function', () => {
    const emitter = createEmitter();
    const handler = vi.fn();
    const off = emitter.on('logout', handler);
    off();
    emitter.emit('logout', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('swallows handler errors', () => {
    const emitter = createEmitter();
    const ok = vi.fn();
    emitter.on('login', () => { throw new Error('boom'); });
    emitter.on('login', ok);
    emitter.emit('login', {});
    expect(ok).toHaveBeenCalled();
  });
});
