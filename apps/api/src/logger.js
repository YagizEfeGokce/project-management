import { config } from './config.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LEVELS[config.LOG_LEVEL] ?? LEVELS.info;

function shouldLog(level) {
  return LEVELS[level] >= CURRENT_LEVEL;
}

function timestamp() {
  return new Date().toISOString();
}

function log(level, message, meta = {}) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: timestamp(),
    level,
    message,
    service: 'taskflow-api',
    environment: config.NODE_ENV,
    ...meta
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  child: (defaultMeta) => ({
    debug: (msg, meta) => log('debug', msg, { ...defaultMeta, ...meta }),
    info: (msg, meta) => log('info', msg, { ...defaultMeta, ...meta }),
    warn: (msg, meta) => log('warn', msg, { ...defaultMeta, ...meta }),
    error: (msg, meta) => log('error', msg, { ...defaultMeta, ...meta })
  })
};
