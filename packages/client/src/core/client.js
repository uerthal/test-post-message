import { ConnectionState } from './state.js';
import { buildEnvelope, safeParse, MessageType } from './envelope.js';

const DEFAULT_RECONNECT = { baseMs: 1000, maxMs: 30000, jitter: true };

export function createWsClient({
  socketUrl,
  appName,
  clientId,
  reconnect,
  authTimeoutMs,
  logger,
  state,
  queue,
  onAuthRequested,
  onAuthOk,
  onAuthFail,
  onMessage,
}) {
  const reconnectCfg = { ...DEFAULT_RECONNECT, ...(reconnect || {}) };

  let socket = null;
  let reconnectTimer = null;
  let authTimeoutTimer = null;
  let currentDelay = reconnectCfg.baseMs;
  let destroyed = false;
  let manuallyClosed = false;
  let pendingAuthToken = null;

  function nextDelay() {
    const base = currentDelay;
    currentDelay = Math.min(base * 2, reconnectCfg.maxMs);
    if (reconnectCfg.jitter) {
      const jitter = Math.random() * base * 0.3;
      return base + jitter;
    }
    return base;
  }

  function resetDelay() { currentDelay = reconnectCfg.baseMs; }

  function connect() {
    if (destroyed) return;
    manuallyClosed = false;
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;

    state.set(ConnectionState.CONNECTING);
    try {
      socket = new WebSocket(socketUrl, ['auth-sync.v1']);
    } catch (err) {
      logger.warn('WebSocket constructor failed', err);
      scheduleReconnect();
      return;
    }

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleError);
  }

  function handleOpen() {
    logger.debug('socket open');
    state.set(ConnectionState.AUTHENTICATING);
    Promise.resolve(onAuthRequested()).then((token) => {
      if (!token) {
        logger.warn('No token available; closing socket.');
        close(4001, 'no token');
        return;
      }
      pendingAuthToken = token;
      sendRaw(buildEnvelope(MessageType.AUTH, { token }, baseMeta()));
      authTimeoutTimer = setTimeout(() => {
        logger.warn('AUTH timeout; closing socket.');
        close(4002, 'auth timeout');
      }, authTimeoutMs);
    }).catch((err) => {
      logger.warn('Failed to obtain token for AUTH', err);
      close(4003, 'token error');
    });
  }

  function handleMessage(event) {
    const msg = safeParse(typeof event.data === 'string' ? event.data : event.data?.toString?.() || '');
    if (!msg) {
      logger.warn('Received non-JSON message');
      return;
    }
    if (msg.type === MessageType.AUTH_OK) {
      clearAuthTimeout();
      resetDelay();
      state.set(ConnectionState.OPEN);
      onAuthOk(msg, pendingAuthToken);
      pendingAuthToken = null;
      flushQueue();
      return;
    }
    if (msg.type === MessageType.AUTH_FAIL) {
      clearAuthTimeout();
      onAuthFail(msg);
      close(4010, 'auth fail');
      return;
    }
    if (msg.type === MessageType.PING) {
      sendRaw(buildEnvelope(MessageType.PONG, {}, baseMeta()));
      return;
    }
    onMessage(msg);
  }

  function handleClose(event) {
    logger.debug('socket close', event.code, event.reason);
    clearAuthTimeout();
    socket = null;
    if (manuallyClosed || destroyed) {
      state.set(ConnectionState.CLOSED);
      return;
    }
    state.set(ConnectionState.RECONNECTING);
    scheduleReconnect();
  }

  function handleError() {
    logger.warn('socket error');
  }

  function scheduleReconnect() {
    if (destroyed || manuallyClosed) return;
    const delay = nextDelay();
    logger.debug(`reconnect in ${Math.round(delay)}ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function clearAuthTimeout() {
    if (authTimeoutTimer) { clearTimeout(authTimeoutTimer); authTimeoutTimer = null; }
  }

  function baseMeta() {
    return {
      clientId,
      appName,
      origin: typeof location !== 'undefined' ? location.origin : '',
    };
  }

  function sendRaw(envelope) {
    if (!socket || socket.readyState !== 1) return false;
    try {
      socket.send(JSON.stringify(envelope));
      return true;
    } catch (err) {
      logger.warn('socket.send failed', err);
      return false;
    }
  }

  function send(type, payload) {
    const envelope = buildEnvelope(type, payload, baseMeta());
    if (state.get() === ConnectionState.OPEN && sendRaw(envelope)) return true;
    if (queue) queue.enqueue(envelope);
    return false;
  }

  function sendReauth(token) {
    return sendRaw(buildEnvelope(MessageType.REAUTH, { token }, baseMeta()));
  }

  function flushQueue() {
    if (!queue) return;
    const sent = queue.drain((env) => sendRaw(env));
    if (sent > 0) logger.debug(`flushed ${sent} queued envelope(s)`);
  }

  function close(code, reason) {
    manuallyClosed = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    clearAuthTimeout();
    if (socket) {
      try { socket.close(code || 1000, reason || ''); } catch { /* ignore */ }
    }
    socket = null;
    state.set(ConnectionState.CLOSED);
  }

  function destroy() {
    destroyed = true;
    close(1000, 'destroy');
  }

  return { connect, send, sendReauth, close, destroy };
}
