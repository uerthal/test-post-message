export function createEmitter() {
  const listeners = new Map();

  function on(event, handler) {
    if (typeof handler !== 'function') return () => {};
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    const set = listeners.get(event);
    if (set) set.delete(handler);
  }

  function emit(event, payload) {
    const exact = listeners.get(event);
    const wildcard = listeners.get('*');
    if (exact) for (const h of [...exact]) safeCall(h, payload, event);
    if (wildcard) for (const h of [...wildcard]) safeCall(h, payload, event);
  }

  function clear() {
    listeners.clear();
  }

  function safeCall(handler, payload, event) {
    try {
      handler(payload, event);
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[AuthSync] listener error', err);
    }
  }

  return { on, off, emit, clear };
}
