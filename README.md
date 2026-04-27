# TaskFlow

Task & Team Productivity Management Tool.

## Structure

- `apps/web`: React dashboard
- `apps/api`: Express API
- `docs`: project notes and planning

## Goal

Track tasks, projects, team workload, risks, and system health from a single product.

## Local Setup

1. Copy `.env.example` to `.env` and fill `DATABASE_URL` and `JWT_SECRET`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Run `npm run prisma:migrate`.
4. Run `npm run dev`.

## Demo Credentials

- Email: `admin@taskflow.local`
- Password: `admin123`
