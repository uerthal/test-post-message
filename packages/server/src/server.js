import { WebSocketServer } from 'ws';
import { verifyAccessToken } from './auth/verify.js';
import { createRegistry } from './registry.js';
import { MessageType, envelope, isRelayable, safeParse } from './protocol.js';
import { log } from './log.js';

const DEFAULTS = {
  authTimeoutMs: 5000,
  pingIntervalMs: 30000,
  pingTimeoutMs: 10000,
};

export function startServer({ port, allowedOrigins } = {}) {
  const wss = new WebSocketServer({
    port,
    handleProtocols: (protocols) => (protocols.has('auth-sync.v1') ? 'auth-sync.v1' : false),
    verifyClient: (info, done) => {
      if (!allowedOrigins || allowedOrigins === '*') return done(true);
      const origin = info.origin || '';
      if (matchesOrigin(origin, allowedOrigins)) return done(true);
      log.warn('origin rejected', { origin });
      done(false, 403, 'forbidden origin');
    },
  });

  const registry = createRegistry();

  wss.on('connection', (ws, req) => {
    const conn = {
      ws,
      sub: null,
      authed: false,
      authDeadline: setTimeout(() => {
        if (!conn.authed) {
          send(ws, envelope(MessageType.AUTH_FAIL, { reason: 'auth_timeout' }));
          terminate(ws, 4002, 'auth_timeout');
        }
      }, DEFAULTS.authTimeoutMs),
      isAlive: true,
      remote: req.socket.remoteAddress,
    };

    ws.on('pong', () => { conn.isAlive = true; });

    send(ws, envelope(MessageType.HELLO, {
      serverVersion: '0.1.0',
      authTimeoutMs: DEFAULTS.authTimeoutMs,
    }));

    ws.on('message', (raw) => handleMessage(conn, raw));

    ws.on('close', () => {
      if (conn.authDeadline) clearTimeout(conn.authDeadline);
      if (conn.sub) registry.remove(conn.sub, conn);
      log.info('connection closed', { sub: conn.sub, total: registry.totalConnections() });
    });

    ws.on('error', (err) => {
      log.warn('socket error', { err: err.message });
    });
  });

  async function handleMessage(conn, raw) {
    const msg = safeParse(raw);
    if (!msg) {
      send(conn.ws, envelope(MessageType.ERROR, { code: 'bad_envelope' }));
      return;
    }

    if (msg.type === MessageType.PONG) return;
    if (msg.type === MessageType.PING) {
      send(conn.ws, envelope(MessageType.PONG, {}));
      return;
    }

    if (msg.type === MessageType.AUTH || msg.type === MessageType.REAUTH) {
      const token = msg.payload && msg.payload.token;
      try {
        const claims = await verifyAccessToken(token);
        const prevSub = conn.sub;
        if (msg.type === MessageType.AUTH) {
          if (conn.authDeadline) { clearTimeout(conn.authDeadline); conn.authDeadline = null; }
          conn.sub = claims.sub;
          conn.authed = true;
          registry.add(conn.sub, conn);
          send(conn.ws, envelope(MessageType.AUTH_OK, {
            sub: claims.sub,
            expiresAt: claims.exp ? claims.exp * 1000 : null,
          }));
          log.info('authed', { sub: conn.sub, peers: registry.countSub(conn.sub) });
        } else {
          if (!conn.authed) {
            send(conn.ws, envelope(MessageType.AUTH_FAIL, { reason: 'not_authenticated' }));
            return;
          }
          if (claims.sub !== prevSub) {
            registry.remove(prevSub, conn);
            conn.sub = claims.sub;
            registry.add(conn.sub, conn);
            log.info('user switched on existing connection', { from: prevSub, to: conn.sub });
            broadcast(prevSub, conn, envelope(MessageType.LOGOUT, { reason: 'user_switch' }, { sub: prevSub }));
            broadcast(conn.sub, conn, envelope(MessageType.LOGIN, {}, { sub: conn.sub }));
          }
          send(conn.ws, envelope(MessageType.AUTH_OK, {
            sub: claims.sub,
            expiresAt: claims.exp ? claims.exp * 1000 : null,
          }));
        }
      } catch (err) {
        log.warn('auth failed', { err: err.message });
        send(conn.ws, envelope(MessageType.AUTH_FAIL, { reason: 'invalid_token', detail: err.message }));
        if (msg.type === MessageType.AUTH) terminate(conn.ws, 4010, 'auth_fail');
      }
      return;
    }

    if (!conn.authed) {
      send(conn.ws, envelope(MessageType.ERROR, { code: 'not_authenticated' }));
      return;
    }

    if (isRelayable(msg.type)) {
      const sanitized = envelope(msg.type, msg.payload, {
        sub: conn.sub,
        sourceClientId: msg.meta && typeof msg.meta.clientId === 'string' ? msg.meta.clientId : null,
        sourceApp: msg.meta && typeof msg.meta.appName === 'string' ? msg.meta.appName : null,
      });
      broadcast(conn.sub, conn, sanitized);
      return;
    }

    send(conn.ws, envelope(MessageType.ERROR, { code: 'unknown_type', type: msg.type }));
  }

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState !== ws.OPEN) return;
      if (ws.__authSync_isAlive === false) return ws.terminate();
      ws.__authSync_isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    });
  }, DEFAULTS.pingIntervalMs);

  wss.on('connection', (ws) => {
    ws.__authSync_isAlive = true;
    ws.on('pong', () => { ws.__authSync_isAlive = true; });
  });

  wss.on('close', () => clearInterval(heartbeat));

  function broadcast(sub, sender, env) {
    const peers = registry.peers(sub, sender);
    for (const peer of peers) send(peer.ws, env);
    log.debug('relayed', { type: env.type, sub, peers: peers.length });
  }

  function send(ws, env) {
    if (ws.readyState !== ws.OPEN) return;
    try { ws.send(JSON.stringify(env)); } catch (err) { log.warn('send failed', { err: err.message }); }
  }

  function terminate(ws, code, reason) {
    try { ws.close(code, reason); } catch { /* ignore */ }
  }

  log.info('auth-sync server listening', { port });
  return wss;
}

function matchesOrigin(origin, allowed) {
  const patterns = allowed.split(',').map((s) => s.trim()).filter(Boolean);
  for (const p of patterns) {
    if (p === '*') return true;
    if (p === origin) return true;
    if (p.startsWith('https://*.')) {
      const suffix = p.slice('https://*.'.length);
      if (origin.startsWith('https://') && origin.endsWith('.' + suffix)) return true;
    }
  }
  return false;
}
