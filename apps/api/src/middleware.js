import { logger } from './logger.js';
import { incCounter, observeHistogram } from './metrics.js';

// Request ID generation
function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Request logging + timing + metrics
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  req.id = req.get('x-request-id') || generateRequestId();
  res.setHeader('x-request-id', req.id);

  const logRequest = () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;

    // Increment request counter (done here so req.route is resolved)
    incCounter('http_requests_total', { method: req.method, path: req.route?.path || req.path });

    // Record latency histogram
    observeHistogram('http_request_duration_seconds', durationMs / 1000, {
      method: req.method,
      path: req.route?.path || req.path,
      status: statusClass
    });

    // Record error counter if 5xx
    if (res.statusCode >= 500) {
      incCounter('http_errors_total', { method: req.method, path: req.route?.path || req.path, status: String(res.statusCode) });
    }

    const logData = {
      request_id: req.id,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: Number(durationMs.toFixed(3)),
      content_length: res.get('content-length'),
      user_agent: req.get('user-agent'),
      ip: req.ip || req.connection?.remoteAddress
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  };

  res.on('finish', logRequest);
  next();
}

// Global error handler
export function errorHandler(err, req, res, _next) {
  const errorId = generateRequestId();
  logger.error('Unhandled error', {
    error_id: errorId,
    request_id: req.id,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: {
      message: 'Internal server error',
      error_id: errorId,
      ...(isDev && { detail: err.message, stack: err.stack })
    }
  });
}

// Rate limiter (simple in-memory)
const requests = new Map();
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs) {
  const now = Date.now();
  if (now - lastCleanup < windowMs) return;
  lastCleanup = now;
  const windowStart = now - windowMs;
  for (const [key, timestamps] of requests.entries()) {
    const filtered = timestamps.filter(t => t > windowStart);
    if (filtered.length === 0) {
      requests.delete(key);
    } else {
      requests.set(key, filtered);
    }
  }
}

export function rateLimiter({ windowMs = 15 * 60 * 1000, max = 100 } = {}) {
  return (req, res, next) => {
    cleanupStaleEntries(windowMs);
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    if (!requests.has(key)) {
      requests.set(key, []);
    }

    const windowStart = now - windowMs;
    const timestamps = requests.get(key).filter(t => t > windowStart);
    timestamps.push(now);
    requests.set(key, timestamps);

    res.setHeader('x-ratelimit-limit', max);
    res.setHeader('x-ratelimit-remaining', Math.max(0, max - timestamps.length));

    if (timestamps.length > max) {
      logger.warn('Rate limit exceeded', { ip: key, path: req.path });
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }

    next();
  };
}
