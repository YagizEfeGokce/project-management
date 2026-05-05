# Project Plan

## Scope

- Dashboard KPI tracking
- Task and project management
- Risk monitoring
- Stakeholder visibility
- System health monitoring

## Criteria Mapping

- Software design: modular frontend/backend layers, clear data flow
- UI design: simple dashboard, detail views, filters, status indicators
- Value creation: better execution, fewer delays, clearer decisions
- Stakeholder management: role-based views and communication needs
- Risk management: register, severity, mitigation, monitoring

---

## Milestones

### M1 — Foundation (Completed)
**Target:** 2026-04-28

- Express API with JWT auth and bcrypt password hashing
- React 18 + Vite frontend with purple-first design
- JSON fallback state for zero-config development
- Prisma schema for PostgreSQL upgrade path
- Dashboard, Tasks, Projects, Risks, Stakeholders, Activity, Notifications screens
- Demo account seeded (`admin@taskflow.local` / `admin123`)

**Definition of done:**
- `npm run dev` starts both API and web
- All screens render without errors
- Login/logout works
- CRUD on tasks and projects works in JSON mode

---

### M2 — Operations Hardening (Completed)
**Target:** 2026-05-05

- Multi-stage Docker builds for API and web
- docker-compose.yml with health checks, resource limits, and restart policies
- GitHub Actions CI pipeline (audit, build, smoke, docker)
- Smoke tests and health checks against all API endpoints
- Prometheus-style `/metrics` endpoint
- Graceful shutdown and rate limiting
- Database backup/validation scripts
- Operations runbook, capacity planning, and risk register
- Playwright E2E test suite (auth + dashboard navigation)

**Definition of done:**
- `npm run validate` passes (audit + build + smoke)
- `docker compose up` brings up full stack
- Playwright E2E tests pass locally
- CI is green on `main`
- All docs in `docs/` are up to date

---

### M3 — PostgreSQL Production Mode
**Target:** 2026-05-12

- Switch from JSON fallback to PostgreSQL as default in production
- Prisma migrations applied and version-controlled
- Connection pooling tuned for concurrent load
- pg_stat_statements extension enabled for query profiling
- Automated daily backups with retention policy
- Backup restore procedure tested end-to-end

**Definition of done:**
- `DATABASE_URL` set → API uses Prisma, not `state.json`
- Migrations run cleanly on a fresh database
- Backup script runs on cron without errors
- Restore from backup verified in staging

---

### M4 — Team Collaboration
**Target:** 2026-05-19

- Real-time comment threads on tasks
- Notification system delivers in-app alerts for task changes
- Activity log captures all mutations with actor + timestamp
- Role-based permissions enforced (admin / manager / member)
- Task assignment notifications

**Definition of done:**
- Comments CRUD works on task detail modal
- Creating/updating a task generates an activity entry
- Notifications appear for the assignee when a task is assigned
- Non-managers cannot create or delete tasks

---

### M5 — Polish & Launch
**Target:** 2026-05-26

- Responsive mobile layout
- Loading skeletons and empty states on all screens
- Search and filter persistence in URL query params
- Export dashboard summary to PDF/CSV
- Final security audit and dependency updates
- README screenshots added
- v1.0.0 tagged

**Definition of done:**
- App is usable on 375px-wide viewport
- No uncaught errors in browser console
- `npm audit --audit-level=high` passes
- Git tag `v1.0.0` exists

---

## Sprint Cadence

- **Sprint length:** 1 week
- **Sprint start:** Monday
- **Standup:** Daily async updates
- **Sprint review:** Friday demo + retrospectives
- **Backlog refinement:** Wednesday

## Definition of Ready

A task is ready when it has:
1. Clear acceptance criteria
2. Estimated effort (hours)
3. No unresolved dependencies
4. Assigned owner

## Definition of Done

A task is done when:
1. Code is written and reviewed
2. `npm run validate` passes locally
3. Playwright E2E tests pass (or new tests added for the feature)
4. GitNexus impact analysis run for any modified symbols
5. CI is green on the branch
6. Documentation updated if user-facing behavior changed
7. Merged to `main` via PR

## Release Checklist

Before any release:
- [ ] `npm run validate` passes
- [ ] `docker compose build` succeeds
- [ ] Playwright E2E tests pass
- [ ] `npm audit --audit-level=high` passes (or documented exceptions)
- [ ] `docs/` updated if ops behavior changed
- [ ] Version bumped in `package.json`
- [ ] Git tag created

## Current Status

**Date:** 2026-05-05
**Milestone:** M2 complete — moving into M3 (PostgreSQL Production Mode)
**Health:** Green
