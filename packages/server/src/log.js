const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const level = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function emit(severity, msg, meta) {
  if (LEVELS[severity] < level) return;
  const line = { ts: new Date().toISOString(), level: severity, msg, ...(meta || {}) };
  if (line.token) line.token = '<redacted>';
  if (line.payload && line.payload.token) line.payload = { ...line.payload, token: '<redacted>' };
  const out = severity === 'error' || severity === 'warn' ? process.stderr : process.stdout;
  out.write(JSON.stringify(line) + '\n');
}

export const log = {
  debug: (msg, meta) => emit('debug', msg, meta),
  info:  (msg, meta) => emit('info',  msg, meta),
  warn:  (msg, meta) => emit('warn',  msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
};
