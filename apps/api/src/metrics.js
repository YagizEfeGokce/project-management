import { logger } from './logger.js';

// Simple in-memory metrics registry (no external deps)
const counters = new Map();
const histograms = new Map();
const gauges = new Map();

export function incCounter(name, labels = {}, value = 1) {
  const key = `${name}${formatLabels(labels)}`;
  counters.set(key, (counters.get(key) || 0) + value);
}

export function observeHistogram(name, value, labels = {}) {
  const key = `${name}${formatLabels(labels)}`;
  if (!histograms.has(key)) {
    histograms.set(key, { sum: 0, count: 0, buckets: [] });
  }
  const h = histograms.get(key);
  h.sum += value;
  h.count += 1;
  h.buckets.push(value);
}

export function setGauge(name, value, labels = {}) {
  const key = `${name}${formatLabels(labels)}`;
  gauges.set(key, value);
}

function formatLabels(labels) {
  const entries = Object.entries(labels);
  if (!entries.length) return '';
  return `{${entries.map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`).join(',')}}`;
}

function renderCounter(name, key, value) {
  return `# TYPE ${name} counter\n${key} ${value}`;
}

function renderGauge(name, key, value) {
  return `# TYPE ${name} gauge\n${key} ${value}`;
}

function renderHistogram(name, key, data) {
  const labels = key.replace(`${name}`, '') || '{}';
  const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  let out = `# TYPE ${name} histogram\n`;

  for (const b of buckets) {
    const count = data.buckets.filter(v => v <= b).length;
    out += `${name}_bucket{le="${b}"${labels === '{}' ? '' : ',' + labels.slice(1, -1)}} ${count}\n`;
  }
  out += `${name}_bucket{le="+Inf"${labels === '{}' ? '' : ',' + labels.slice(1, -1)}} ${data.count}\n`;
  out += `${name}_sum${labels} ${data.sum.toFixed(3)}\n`;
  out += `${name}_count${labels} ${data.count}`;
  return out;
}

export function metricsHandler(req, res) {
  const lines = [];

  // Counters
  for (const [key, value] of counters) {
    const name = key.split('{')[0];
    lines.push(renderCounter(name, key, value));
  }

  // Gauges
  for (const [key, value] of gauges) {
    const name = key.split('{')[0];
    lines.push(renderGauge(name, key, value));
  }

  // Histograms
  for (const [key, data] of histograms) {
    const name = key.split('{')[0];
    lines.push(renderHistogram(name, key, data));
  }

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n\n') + '\n');
}

// Active connections gauge updater
let activeConnections = 0;
export function trackConnections(server) {
  server.on('connection', (socket) => {
    activeConnections += 1;
    setGauge('http_connections_active', {}, activeConnections);
    socket.on('close', () => {
      activeConnections = Math.max(0, activeConnections - 1);
      setGauge('http_connections_active', {}, activeConnections);
    });
  });
}
