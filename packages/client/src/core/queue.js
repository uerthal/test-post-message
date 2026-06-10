import { safeSessionGet, safeSessionSet, safeSessionRemove } from './storage.js';

const STORAGE_KEY = 'auth-sync.queue.v1';
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CAP = 50;

export function createQueue({ ttlMs = DEFAULT_TTL_MS, cap = DEFAULT_CAP, logger } = {}) {
  let items = load();

  function load() {
    const raw = safeSessionGet(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return parsed.filter((x) => x && typeof x === 'object' && (now - x._enqueuedAt) < ttlMs);
    } catch {
      return [];
    }
  }

  function persist() {
    if (!items.length) {
      safeSessionRemove(STORAGE_KEY);
      return;
    }
    safeSessionSet(STORAGE_KEY, JSON.stringify(items));
  }

  function enqueue(envelope) {
    items.push({ ...envelope, _enqueuedAt: Date.now() });
    if (items.length > cap) items.splice(0, items.length - cap);
    persist();
    if (logger) logger.debug('queued envelope', envelope.type, envelope.id);
  }

  function drain(sender) {
    if (!items.length) return 0;
    const toSend = items;
    items = [];
    persist();
    let sent = 0;
    for (const item of toSend) {
      const { _enqueuedAt, ...envelope } = item;
      if (sender(envelope)) sent++;
    }
    return sent;
  }

  function clear() {
    items = [];
    persist();
  }

  function size() { return items.length; }

  return { enqueue, drain, clear, size };
}
