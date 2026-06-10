import { createLogger } from './core/log.js';
import { createEmitter } from './core/emitter.js';
import { createStateMachine, ConnectionState } from './core/state.js';
import { createQueue } from './core/queue.js';
import { createWsClient } from './core/client.js';
import { createCoordinator } from './core/leader.js';
import { MessageType } from './core/envelope.js';
import { createTokenScheduler } from './auth/scheduler.js';
import { resolveAdapter } from './adapters/detect.js';
import { uuid } from './core/uuid.js';

const DEFAULTS = {
  appName: 'app',
  debug: false,
  reconnect: { baseMs: 1000, maxMs: 30000, jitter: true },
  authTimeoutMs: 5000,
  tokenRefreshSkewSec: 60,
  pollIntervalMs: 5000,
  channelKey: 'default',
  forceLocalLogoutOnRemote: true,
};

const EVENTS = Object.freeze({
  LOGIN:             'login',
  LOGOUT:            'logout',
  USER_SWITCH:       'user-switch',
  TOKEN_REFRESHED:   'token-refreshed',
  SESSION_EXPIRED:   'session-expired',
  CONNECTION_CHANGE: 'connection-change',
  ERROR:             'error',
});

let instance = null;

function createInstance(rawOptions) {
  const options = { ...DEFAULTS, ...rawOptions };
  if (!options.socketUrl) throw new Error('AuthSync.init: socketUrl is required.');
  if (!options.auth0Client && !options.adapter) {
    throw new Error('AuthSync.init: provide auth0Client (autodetect) or adapter.');
  }

  const logger = createLogger(options.debug);
  const emitter = createEmitter();
  const clientId = uuid();

  if (typeof options.onLogin === 'function')             emitter.on(EVENTS.LOGIN, options.onLogin);
  if (typeof options.onLogout === 'function')            emitter.on(EVENTS.LOGOUT, options.onLogout);
  if (typeof options.onUserSwitch === 'function')        emitter.on(EVENTS.USER_SWITCH, options.onUserSwitch);
  if (typeof options.onTokenRefreshed === 'function')    emitter.on(EVENTS.TOKEN_REFRESHED, options.onTokenRefreshed);
  if (typeof options.onSessionExpired === 'function')    emitter.on(EVENTS.SESSION_EXPIRED, options.onSessionExpired);
  if (typeof options.onConnectionChange === 'function')  emitter.on(EVENTS.CONNECTION_CHANGE, options.onConnectionChange);
  if (typeof options.onError === 'function')             emitter.on(EVENTS.ERROR, options.onError);

  const adapter = resolveAdapter({
    adapter: options.adapter,
    auth0Client: options.auth0Client,
    adapterOptions: options.adapterOptions,
  });

  let lastUser = null;
  let lastSub = null;
  let currentToken = null;
  let detectionTimer = null;
  let destroyed = false;

  const state = createStateMachine((next, prev) => {
    emitter.emit(EVENTS.CONNECTION_CHANGE, { state: next, previous: prev });
  });

  const queue = createQueue({ logger });

  function applyRemote(eventName, payload) {
    emitter.emit(eventName, payload);
  }

  const coordinator = createCoordinator({
    channelKey: options.channelKey,
    clientId,
    logger,
    onMessage: (msg) => {
      if (msg.type === '__leader') return;
      if (msg.type === '__event' && msg.eventName) {
        applyRemote(msg.eventName, msg.payload);
      }
    },
    onLeadershipChange: (isLeader) => {
      logger.debug('leadership change → ' + (isLeader ? 'leader' : 'follower'));
      if (isLeader) {
        wsClient.connect();
      } else {
        wsClient.close(1000, 'no longer leader');
      }
    },
  });

  function fanOutLocal(eventName, payload) {
    emitter.emit(eventName, payload);
    coordinator.broadcast({ type: '__event', eventName, payload });
  }

  const tokenScheduler = createTokenScheduler({
    skewSec: options.tokenRefreshSkewSec,
    logger,
    onRefresh: async () => {
      try {
        const token = await adapter.getAccessToken({ ignoreCache: true });
        currentToken = token;
        wsClient.sendReauth(token);
        tokenScheduler.schedule(token);
        fanOutLocal(EVENTS.TOKEN_REFRESHED, { at: Date.now() });
      } catch (err) {
        logger.warn('Token refresh failed; emitting session-expired and forcing logout.', err);
        fanOutLocal(EVENTS.SESSION_EXPIRED, { reason: 'refresh_failed' });
        try { await adapter.logout({ localOnly: true }); } catch { /* swallow */ }
      }
    },
  });

  const wsClient = createWsClient({
    socketUrl: options.socketUrl,
    appName: options.appName,
    clientId,
    reconnect: options.reconnect,
    authTimeoutMs: options.authTimeoutMs,
    logger,
    state,
    queue,
    onAuthRequested: async () => {
      try {
        const token = await adapter.getAccessToken();
        currentToken = token;
        return token;
      } catch (err) {
        emitter.emit(EVENTS.ERROR, { code: 'token_unavailable', cause: err });
        return null;
      }
    },
    onAuthOk: (msg, token) => {
      logger.debug('AUTH_OK', msg.payload);
      tokenScheduler.schedule(token);
    },
    onAuthFail: (msg) => {
      logger.warn('AUTH_FAIL', msg.payload);
      emitter.emit(EVENTS.ERROR, { code: 'auth_failed', payload: msg.payload });
    },
    onMessage: (msg) => {
      switch (msg.type) {
        case MessageType.LOGIN:
          applyRemote(EVENTS.LOGIN, msg.payload || {});
          break;
        case MessageType.LOGOUT:
          applyRemote(EVENTS.LOGOUT, msg.payload || {});
          if (options.forceLocalLogoutOnRemote) {
            adapter.logout({ localOnly: true }).catch((err) => logger.warn('Local logout failed', err));
          }
          break;
        case MessageType.USER_SWITCHED:
          applyRemote(EVENTS.USER_SWITCH, msg.payload || {});
          break;
        case MessageType.TOKEN_REFRESHED:
          applyRemote(EVENTS.TOKEN_REFRESHED, msg.payload || {});
          break;
        case MessageType.SESSION_EXPIRED:
          applyRemote(EVENTS.SESSION_EXPIRED, msg.payload || {});
          if (options.forceLocalLogoutOnRemote) {
            adapter.logout({ localOnly: true }).catch(() => {});
          }
          break;
        default:
          logger.debug('unhandled message type', msg.type);
      }
    },
  });

  function send(type, payload) {
    return wsClient.send(type, payload);
  }

  async function syncFromAdapter() {
    if (destroyed) return;
    try {
      const authed = await adapter.isAuthenticated();
      const user = authed ? await adapter.getUser() : null;
      const sub = user && user.sub ? user.sub : null;

      if (sub && !lastSub) {
        lastUser = user; lastSub = sub;
        fanOutLocal(EVENTS.LOGIN, { user });
        if (coordinator.isLeader()) send(MessageType.LOGIN, { user });
      } else if (!sub && lastSub) {
        const prev = lastUser;
        lastUser = null; lastSub = null;
        fanOutLocal(EVENTS.LOGOUT, { user: prev, reason: 'adapter_detected' });
        if (coordinator.isLeader()) send(MessageType.LOGOUT, { user: prev, reason: 'adapter_detected' });
      } else if (sub && lastSub && sub !== lastSub) {
        const from = lastUser; const to = user;
        lastUser = user; lastSub = sub;
        fanOutLocal(EVENTS.USER_SWITCH, { from, to });
        if (coordinator.isLeader()) send(MessageType.USER_SWITCHED, { from, to });
      }
    } catch (err) {
      logger.debug('adapter sync failed', err);
    }
  }

  function startDetection() {
    if (typeof adapter.onAuthStateChanged === 'function') {
      adapter.onAuthStateChanged(() => syncFromAdapter());
    }
    detectionTimer = setInterval(syncFromAdapter, options.pollIntervalMs);
    syncFromAdapter();
  }

  function stopDetection() {
    if (detectionTimer) { clearInterval(detectionTimer); detectionTimer = null; }
  }

  coordinator.start();
  startDetection();

  return {
    on(event, handler) {
      return emitter.on(event, handler);
    },
    off(event, handler) {
      emitter.off(event, handler);
    },
    async notifyLogin(payload) {
      const user = (payload && payload.user) || await adapter.getUser();
      lastUser = user;
      lastSub = user && user.sub ? user.sub : null;
      fanOutLocal(EVENTS.LOGIN, { user });
      if (coordinator.isLeader()) send(MessageType.LOGIN, { user });
    },
    notifyLogout(payload) {
      const previous = lastUser;
      lastUser = null; lastSub = null;
      fanOutLocal(EVENTS.LOGOUT, { user: previous, reason: payload?.reason || 'manual' });
      if (coordinator.isLeader()) send(MessageType.LOGOUT, { user: previous, reason: payload?.reason || 'manual' });
    },
    notifyUserSwitch(payload) {
      const from = (payload && payload.from) || lastUser;
      const to   = (payload && payload.to)   || null;
      lastUser = to; lastSub = to && to.sub ? to.sub : null;
      fanOutLocal(EVENTS.USER_SWITCH, { from, to });
      if (coordinator.isLeader()) send(MessageType.USER_SWITCHED, { from, to });
    },
    getState() {
      return state.get();
    },
    getUser() {
      return lastUser;
    },
    isLeaderTab() {
      return coordinator.isLeader();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopDetection();
      tokenScheduler.cancel();
      wsClient.destroy();
      coordinator.destroy();
      emitter.clear();
    },
  };
}

export const AuthSync = {
  init(options) {
    if (instance) {
      instance.destroy();
      instance = null;
    }
    instance = createInstance(options);
    return AuthSync;
  },
  on(event, handler) {
    if (!instance) throw new Error('AuthSync.init must be called before on().');
    return instance.on(event, handler);
  },
  off(event, handler) {
    if (!instance) return;
    instance.off(event, handler);
  },
  notifyLogin(payload)        { if (instance) return instance.notifyLogin(payload); },
  notifyLogout(payload)       { if (instance) return instance.notifyLogout(payload); },
  notifyUserSwitch(payload)   { if (instance) return instance.notifyUserSwitch(payload); },
  getState()                  { return instance ? instance.getState() : ConnectionState.CLOSED; },
  getUser()                   { return instance ? instance.getUser() : null; },
  isLeaderTab()               { return instance ? instance.isLeaderTab() : false; },
  destroy() {
    if (instance) {
      instance.destroy();
      instance = null;
    }
  },
  ConnectionState,
  Events: EVENTS,
};

export default AuthSync;
