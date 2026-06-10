import { getExpiryMs } from './token.js';

export function createTokenScheduler({ skewSec, onRefresh, logger }) {
  let timer = null;

  function schedule(token) {
    cancel();
    const expMs = getExpiryMs(token);
    if (!expMs) {
      logger.warn('Cannot schedule token refresh — token has no exp claim.');
      return;
    }
    const delay = Math.max(1000, expMs - Date.now() - (skewSec * 1000));
    logger.debug(`token refresh scheduled in ${Math.round(delay / 1000)}s`);
    timer = setTimeout(() => {
      timer = null;
      Promise.resolve(onRefresh()).catch((err) => logger.warn('Token refresh failed', err));
    }, delay);
  }

  function cancel() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  return { schedule, cancel };
}
