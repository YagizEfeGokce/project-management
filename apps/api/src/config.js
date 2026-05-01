const OPTIONAL = {
  NODE_ENV: 'development',
  PORT: '3001',
  LOG_LEVEL: 'info',
  DATABASE_URL: null,
  CORS_ORIGIN: '*',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX: '100'
};

function validate() {
  const config = {};

  // JWT_SECRET: required in production, fallback in dev (matches original auth.js behavior)
  if (process.env.JWT_SECRET) {
    config.JWT_SECRET = process.env.JWT_SECRET;
  } else if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    throw new Error('JWT_SECRET is required in production/staging');
  } else {
    // Dev fallback — matches original auth.js default
    config.JWT_SECRET = 'taskflow-dev-secret';
    // eslint-disable-next-line no-console
    console.warn('[config] JWT_SECRET not set, using dev fallback. Set JWT_SECRET in production!');
  }

  for (const [key, defaultValue] of Object.entries(OPTIONAL)) {
    config[key] = process.env[key] ?? defaultValue;
  }

  // Type coercion
  config.PORT = parseInt(config.PORT, 10);
  config.RATE_LIMIT_WINDOW_MS = parseInt(config.RATE_LIMIT_WINDOW_MS, 10);
  config.RATE_LIMIT_MAX = parseInt(config.RATE_LIMIT_MAX, 10);

  // Validate NODE_ENV
  if (!['development', 'staging', 'production', 'test'].includes(config.NODE_ENV)) {
    throw new Error(`Invalid NODE_ENV: ${config.NODE_ENV}. Must be one of: development, staging, production, test`);
  }

  return Object.freeze(config);
}

export const config = validate();
