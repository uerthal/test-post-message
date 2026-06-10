import { safeLocalGet, safeLocalSet } from './storage.js';

const LOCK_NAME_PREFIX = 'auth-sync.leader.';
const HEARTBEAT_KEY_PREFIX = 'auth-sync.leader-beat.';
const HEARTBEAT_INTERVAL_MS = 1000;
const HEARTBEAT_STALE_MS = 3000;

export function createCoordinator({ channelKey, clientId, logger, onMessage, onLeadershipChange }) {
  const channelName = `auth-sync.${channelKey}`;
  const lockName = `${LOCK_NAME_PREFIX}${channelKey}`;
  const beatKey = `${HEARTBEAT_KEY_PREFIX}${channelKey}`;

  let channel = null;
  let isLeader = false;
  let lockRelease = null;
  let lockPromise = null;
  let pollTimer = null;
  let beatTimer = null;
  let destroyed = false;

  function openChannel() {
    if (typeof BroadcastChannel === 'undefined') {
      logger.warn('BroadcastChannel is not available; cross-tab sync within the same origin will be disabled.');
      return;
    }
    channel = new BroadcastChannel(channelName);
    channel.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.from === clientId) return;
      onMessage(data);
    });
  }

  function broadcast(message) {
    if (!channel) return;
    try {
      channel.postMessage({ ...message, from: clientId });
    } catch (err) {
      logger.warn('BroadcastChannel postMessage failed', err);
    }
  }

  function acquireLeadership() {
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
      lockPromise = new Promise((resolve) => {
        navigator.locks.request(lockName, { mode: 'exclusive' }, () => {
          setLeader(true);
          return new Promise((release) => { lockRelease = release; resolve(); });
        }).catch((err) => {
          logger.warn('navigator.locks failed, falling back to storage', err);
          startStorageFallback();
        });
      });
    } else {
      startStorageFallback();
    }
  }

  function startStorageFallback() {
    const tick = () => {
      if (destroyed) return;
      const beat = safeLocalGet(beatKey);
      const now = Date.now();
      let active = null;
      if (beat) {
        try { active = JSON.parse(beat); } catch { active = null; }
      }
      const stale = !active || (now - active.ts) > HEARTBEAT_STALE_MS;
      if (stale || active.id === clientId) {
        safeLocalSet(beatKey, JSON.stringify({ id: clientId, ts: now }));
        setLeader(true);
      } else {
        setLeader(false);
      }
    };
    tick();
    pollTimer = setInterval(tick, HEARTBEAT_INTERVAL_MS);
  }

  function setLeader(value) {
    if (value === isLeader) return;
    isLeader = value;
    if (isLeader) startHeartbeat(); else stopHeartbeat();
    try { onLeadershipChange(isLeader); } catch { /* swallow */ }
    broadcast({ type: '__leader', isLeader, leaderId: clientId });
  }

  function startHeartbeat() {
    if (beatTimer) return;
    safeLocalSet(beatKey, JSON.stringify({ id: clientId, ts: Date.now() }));
    beatTimer = setInterval(() => {
      safeLocalSet(beatKey, JSON.stringify({ id: clientId, ts: Date.now() }));
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (beatTimer) {
      clearInterval(beatTimer);
      beatTimer = null;
    }
  }

  function start() {
    openChannel();
    acquireLeadership();
  }

  function destroy() {
    destroyed = true;
    stopHeartbeat();
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (lockRelease) { try { lockRelease(); } catch { /* ignore */ } lockRelease = null; }
    if (channel) {
      try { channel.close(); } catch { /* ignore */ }
      channel = null;
    }
  }

  function leader() { return isLeader; }

  return { start, destroy, broadcast, isLeader: leader };
}
