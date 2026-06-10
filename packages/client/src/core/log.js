const PREFIX = '[AuthSync]';

export function createLogger(debug) {
  return {
    debug: (...args) => { if (debug && typeof console !== 'undefined') console.debug(PREFIX, ...args); },
    info:  (...args) => { if (debug && typeof console !== 'undefined') console.info(PREFIX, ...args); },
    warn:  (...args) => { if (typeof console !== 'undefined') console.warn(PREFIX, ...args); },
    error: (...args) => { if (typeof console !== 'undefined') console.warn(PREFIX, ...args); },
  };
}
