import { hasDatabaseUrl, getPrisma } from './prisma.js';
import os from 'os';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export async function healthCheck(req, res) {
  const checks = {
    timestamp: new Date().toISOString(),
    service: 'taskflow-api',
    version: process.env.npm_package_version || '0.0.0',
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development'
  };

  // Database connectivity check (only if DATABASE_URL is configured)
  if (hasDatabaseUrl()) {
    const prisma = getPrisma();
    if (prisma) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: 'connected', mode: 'postgresql' };
      } catch (err) {
        checks.database = { status: 'disconnected', mode: 'postgresql', error: err.message };
        checks.status = 'degraded';
      }
    }
  } else {
    checks.database = { status: 'not_configured', mode: 'json_fallback' };
  }

  // Memory usage
  const mem = process.memoryUsage();
  checks.memory = {
    rss: formatBytes(mem.rss),
    heap_total: formatBytes(mem.heapTotal),
    heap_used: formatBytes(mem.heapUsed),
    external: formatBytes(mem.external)
  };

  // System load
  checks.system = {
    load_average: os.loadavg().map(n => n.toFixed(2)),
    free_memory: formatBytes(os.freemem()),
    total_memory: formatBytes(os.totalmem())
  };

  // Determine overall status
  if (!checks.status) {
    checks.status = 'healthy';
  }

  const statusCode = checks.status === 'healthy' ? 200 : checks.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(checks);
}

export async function readinessCheck(req, res) {
  // Readiness = can accept traffic
  // If no DATABASE_URL, we rely on JSON state which is always ready
  if (!hasDatabaseUrl()) {
    return res.status(200).json({ ready: true, checks: { database: 'not_configured', mode: 'json_fallback' } });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return res.status(503).json({ ready: false, checks: { database: 'unavailable', mode: 'postgresql' } });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ready: true, checks: { database: 'connected', mode: 'postgresql' } });
  } catch (err) {
    res.status(503).json({ ready: false, checks: { database: 'disconnected', mode: 'postgresql', error: err.message } });
  }
}

export function livenessCheck(req, res) {
  // Liveness = process is running and not deadlocked
  res.status(200).json({
    alive: true,
    pid: process.pid,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
}
