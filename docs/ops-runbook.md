# TaskFlow Operations Runbook

## SLOs (Service Level Objectives)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.5% | `/health/live` probe |
| API p95 latency | < 500ms | `/metrics` histogram |
| Error rate | < 1% | 5xx responses / total requests |
| DB availability | 99.9% | `/health/ready` probe |
| Backup success | 100% daily | Backup script exit code 0 |

## Alert Thresholds

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High error rate | > 1% 5xx in 5min | P1 | Page on-call, check logs |
| High latency | p95 > 500ms for 10min | P2 | Check DB slow queries |
| DB down | `/health/ready` fails 3x | P1 | Check postgres container, restart if needed |
| API down | `/health/live` fails 3x | P1 | Restart API container |
| Disk full | > 85% usage | P2 | Clean old backups, expand volume |
| Rate limit hits | > 10% 429 in 5min | P3 | Review traffic pattern, adjust limits |
| Backup failure | Script exit != 0 | P2 | Investigate, retry manually |

## Health Endpoints

- `GET /health` — Full system status (DB, memory, load)
- `GET /health/ready` — Ready for traffic (DB must be up)
- `GET /health/live` — Process alive
- `GET /metrics` — Prometheus metrics

## Common Failures & Recovery

### API Won't Start
1. Check `.env` — `JWT_SECRET` is required
2. Check `NODE_ENV` is one of: development, staging, production, test
3. Check port 3001 is free

### Database Connection Lost
1. `docker compose ps` — verify postgres is running
2. `docker compose logs postgres` — check OOM or disk full
3. `docker compose restart postgres` — restart if needed
4. If data corruption: restore from latest backup in `backups/`

### High Memory Usage
1. Check `http_connections_active` gauge in `/metrics`
2. Restart API container: `docker compose restart api`
3. Scale up container memory limit in docker-compose.yml

### CI Build Failure
1. Check `npm audit` — fix vulnerabilities or override with `--force`
2. Check `npm run build:web` output for Vite errors
3. Verify postgres service in CI workflow is healthy

## On-Call Rotation

- Primary: Operations Lead
- Secondary: Tech Lead
- Escalation: Project Manager

## Backup Procedures

### Manual Backup
```bash
# Dry run (verify connectivity without writing)
./scripts/db-backup.sh --dry-run

# Full backup
./scripts/db-backup.sh ./backups

# With custom retention (days)
BACKUP_RETENTION_DAYS=7 ./scripts/db-backup.sh ./backups
```

### Automated Backup (Cron)
```bash
# Daily at 02:00
0 2 * * * cd /path/to/project && ./scripts/db-backup.sh >> ./logs/backup.log 2>&1
```

### Validate a Backup
```bash
make validate-backup BACKUP=backups/taskflow_20260501_120000.sql.gz
# or directly:
./scripts/validate-backup.sh backups/taskflow_20260501_120000.sql.gz
```

### Restore from Backup
```bash
# Drop and recreate database
docker compose exec postgres psql -U taskflow -d postgres -c "DROP DATABASE IF EXISTS taskflow; CREATE DATABASE taskflow;"

# Restore
gunzip -c backups/taskflow_20260501_120000.sql.gz | docker compose exec -T postgres psql -U taskflow -d taskflow
```

## Operational Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `./scripts/smoke-test.sh` | Full API health & auth validation | `npm run validate` |
| `./scripts/health-check.sh` | Quick probe of all health endpoints | `make health-check` |
| `./scripts/db-backup.sh` | PostgreSQL backup with retention | `make backup` |
| `./scripts/validate-backup.sh` | Verify backup integrity | `make validate-backup BACKUP=...` |
| `./scripts/setup-hooks.sh` | Configure git pre-commit hooks | Run once after clone |

## Reference Documents

- `docs/alerting-rules.yml` — Prometheus-compatible alerting rules
- `docs/capacity-planning.md` — Scaling triggers, horizontal scaling guidance, latency troubleshooting
- `Makefile` — All operational targets (`make dev`, `make build`, `make validate`, etc.)

## Contacts

- Add on-call phone/email here
- Slack channel: #taskflow-alerts
