.PHONY: dev build smoke-test health-check backup validate clean install

# Development
## Start both API and web in dev mode
dev:
	npm run dev

## Start API only
dev-api:
	npm run dev:api

## Start web only
dev-web:
	npm run dev:web

# Build
## Build production web bundle
build:
	npm run build:web

# Quality Gates
## Run full local validation (audit + build + smoke test)
validate:
	npm run validate

## Run security audit
audit:
	npm audit --audit-level=high

## Run smoke tests against running API
smoke-test:
	./scripts/smoke-test.sh

## Run health checks against running API
health-check:
	./scripts/health-check.sh

# Operations
## Run database backup
backup:
	./scripts/db-backup.sh

## Validate a backup file (usage: make validate-backup BACKUP=backups/taskflow_YYYYMMDD_HHMMSS.sql.gz)
validate-backup:
	@test -n "$(BACKUP)" || (echo "Usage: make validate-backup BACKUP=backups/taskflow_YYYYMMDD_HHMMSS.sql.gz"; exit 1)
	./scripts/validate-backup.sh $(BACKUP)

## Setup git hooks
setup-hooks:
	./scripts/setup-hooks.sh

# Maintenance
## Clean all build artifacts and dependencies
clean:
	rm -rf node_modules apps/*/node_modules apps/web/dist

## Install dependencies
install:
	npm install
