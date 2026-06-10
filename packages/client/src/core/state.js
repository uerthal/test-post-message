export const ConnectionState = Object.freeze({
  CLOSED:           'CLOSED',
  CONNECTING:       'CONNECTING',
  AUTHENTICATING:   'AUTHENTICATING',
  OPEN:             'OPEN',
  RECONNECTING:     'RECONNECTING',
});

export function createStateMachine(onChange) {
  let current = ConnectionState.CLOSED;

  function get() { return current; }

  function set(next) {
    if (next === current) return;
    const prev = current;
    current = next;
    try { onChange(next, prev); } catch { /* swallow */ }
  }

  return { get, set };
}
