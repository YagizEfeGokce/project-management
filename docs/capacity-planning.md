# TaskFlow Capacity Planning Guide

## Current Baseline

### Docker Compose Resource Limits

| Service | CPU Limit | Memory Limit | CPU Reservation | Memory Reservation |
|---------|-----------|--------------|-----------------|--------------------|
| postgres | 1.0 | 512 MB | 0.25 | 128 MB |
| api | 0.5 | 256 MB | 0.1 | 64 MB |
| web (nginx) | — | — | — | — |

### JSON Fallback Mode (No Database)
- API memory usage: ~60–90 MB at idle
- API memory usage under load: ~120–180 MB
- Startup time: ~1–2 seconds
- No connection pool overhead

### PostgreSQL Mode
- API memory usage: ~80–110 MB at idle
- API memory usage under load: ~150–220 MB
- Prisma connection pool: default 2× CPU cores
- First-request seeding delay: ~500–1500 ms

---

## Scaling Triggers

When to scale up **before** hitting limits:

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| API CPU | > 50% sustained | > 70% sustained | Increase CPU limit or add replicas |
| API Memory | > 60% sustained | > 80% sustained | Increase memory limit or add replicas |
| Active Connections | > 50 | > 80 | Add API replicas; check for connection leaks |
| DB CPU | > 60% sustained | > 80% sustained | Scale DB instance; optimize slow queries |
| DB Memory | > 70% sustained | > 85% sustained | Increase DB memory or connection pool |
| Disk Usage | > 70% | > 85% | Expand volume; reduce retention |
| Request Latency (p95) | > 300 ms | > 500 ms | See latency troubleshooting below |

---

## Horizontal Scaling

The TaskFlow API is **stateless**:
- Metrics are in-memory per instance (not shared)
- JSON fallback state is file-based on local disk (not shareable across replicas)
- Rate limiting is in-memory per instance (not distributed)

**Scaling requirements:**
- PostgreSQL mode: safe to run multiple API replicas behind a load balancer
- JSON fallback mode: **not safe** to run multiple replicas — each would have its own state file
- If you need HA with JSON fallback, use a shared volume (NFS/EFS) or switch to PostgreSQL

---

## When to Switch from JSON Fallback to PostgreSQL

| Factor | JSON Fallback | PostgreSQL |
|--------|-------------|------------|
| Team size | ≤ 5 users | > 5 users |
| Data durability | Acceptable risk (file-based) | Required (ACID) |
| Concurrent writes | Low (single instance) | High (multiple clients) |
| Backup strategy | File copy | pg_dump + point-in-time |
| Long-term data | Days to weeks | Months to years |

**Decision rule:** If any of the following are true, migrate to PostgreSQL:
- You plan to run more than 1 API replica
- Data loss of > 1 day is unacceptable
- You need automated backups with validation
- You need analytics / reporting queries

---

## Latency Troubleshooting Tree

```
p95 latency > 500ms
├── Is it all endpoints?
│   ├── Yes → Check CPU/memory; scale API
│   └── No  → Check specific endpoint
│       └── Is it DB-related?
│           ├── Yes → Check Prisma query logs; add indexes
│           └── No  → Check external calls / large payloads
└── Is CPU throttled?
    ├── Yes → Increase CPU limit
    └── No  → Profile with clinic.js or 0x
```

---

## Recommended Monitoring Queries

### Prisma slow queries (PostgreSQL)
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Requires `pg_stat_statements` extension.

### Connection pool health
```bash
curl -s http://api:3001/metrics | grep http_connections_active
```

### Disk usage
```bash
docker system df -v
```

---

## Growth Projection (Simplified)

Assuming 50 tasks/month growth, 10 users:

| Month | DB Size (est.) | Backup Size | Disk Needed |
|-------|---------------|-------------|-------------|
| 1 | 10 MB | 2 MB | 20 MB |
| 6 | 60 MB | 12 MB | 120 MB |
| 12 | 120 MB | 24 MB | 240 MB |
| 24 | 250 MB | 50 MB | 500 MB |

**Rule of thumb:** Allocate 5× current DB size for growth + backups + logs.
