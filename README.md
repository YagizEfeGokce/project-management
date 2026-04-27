# TaskFlow

TaskFlow is a full-stack task and team productivity management tool. It combines a polished React dashboard with an Express API so a team can track work, projects, risks, stakeholders, activity, and notifications in one place.

## Overview

TaskFlow is designed to answer the main questions a product or delivery team asks every day:

- What is the current status of the work?
- Which tasks need attention now?
- How are projects progressing?
- What risks are open?
- Who needs to be kept aligned?
- What changed recently?

The product ships with a clean purple-themed dashboard and a set of focused views for tasks, projects, risks, stakeholders, activity, and notifications.

## What The App Does

- Shows a live dashboard summary with completion rate, workload, delayed tasks, and unread notifications
- Lets authorized users create, edit, and delete tasks
- Supports task comments and task detail views
- Displays project progress cards and project detail modals
- Lists risks with severity-based visual cues
- Summarizes stakeholder concerns in a compact view
- Shows activity history with filtering by actor, type, and date
- Manages notifications with read/unread state and bulk mark-as-read actions
- Supports JWT-based authentication

## Screens

### Dashboard

The dashboard is the main landing page. It highlights:

- overall completion
- delayed tasks
- unread alerts
- team workload distribution
- recent task updates
- current risks

### Tasks

The tasks page is a card-based work board. It includes:

- task search
- status filtering
- task details
- create/edit/delete actions for managers and admins
- comments on task detail pages

### Projects

The projects page shows a portfolio-style overview of all projects, including:

- project progress
- project status
- task count
- delayed task count
- project detail modal

### Risks

The risks page summarizes open risks with severity-based cards so blockers are easy to scan.

### Stakeholders

The stakeholders page gives a lightweight view of stakeholder names and concerns so communication risks stay visible.

### Activity

The activity page provides a timeline of actions with filters for:

- search text
- actor
- activity type
- date range

### Notifications

The notifications page shows unread and read alerts, and supports marking notifications read or unread individually or in bulk.

## Tech Stack

### Frontend

- React 18
- Vite
- Plain CSS

### Backend

- Node.js
- Express
- JWT authentication
- bcryptjs for password hashing
- CORS

### Data / Persistence

- Prisma schema for PostgreSQL mode
- Local JSON state fallback for quick development
- Seed data in `apps/api/src/data/seed.json`
- Persistent runtime state in `apps/api/src/data/state.json`

### Tooling

- npm workspaces
- concurrently
- Prisma CLI

## Architecture

TaskFlow is structured as a small monorepo:

- `apps/web` contains the React UI
- `apps/api` contains the Express API
- `prisma` contains the database schema and migrations
- `docs` contains product notes and planning docs

The frontend talks to the backend through `/api` requests. In development, Vite proxies `/api` to the API server on port `3001`.

The backend uses a repository layer that can work in two modes:

1. **Local state mode**: If `DATABASE_URL` is not set, the API reads and writes `apps/api/src/data/state.json`.
2. **PostgreSQL mode**: If `DATABASE_URL` is set, Prisma can connect to PostgreSQL for database-backed development.

### High-level Flow

```mermaid
flowchart LR
  Browser[Browser / React UI] -->|/api requests| API[Express API]
  API -->|local fallback| State[(apps/api/src/data/state.json)]
  API -->|optional ORM layer| Prisma[Prisma Client]
  Prisma --> DB[(PostgreSQL)]
  API --> Auth[JWT Auth]
  API --> Data[(Tasks, Projects, Risks, Stakeholders, Activities, Notifications)]
```

## Visual Preview

The app uses a purple-first, card-based interface. If you want to add screenshots later, place them in `docs/screenshots/` and reference them here.

Suggested screenshots:

- Dashboard
- Tasks
- Projects
- Risks
- Stakeholders
- Activity
- Notifications

## Data Model

The Prisma schema defines these entities:

- `Project`
- `Task`
- `Risk`
- `Stakeholder`
- `User`
- `Comment`
- `ActivityLog`
- `Notification`

## API Overview

### Authentication

- `POST /api/auth/login`
- `GET /api/auth/me`

### Dashboard

- `GET /api/dashboard/summary`

### Projects

- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`

### Tasks

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `GET /api/tasks/:id/comments`
- `POST /api/tasks/:id/comments`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

### Risks

- `GET /api/risks`

### Stakeholders

- `GET /api/stakeholders`

### Activity

- `GET /api/activities`

### Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/:id`
- `POST /api/notifications/mark-all-read`
- `PATCH /api/notifications/bulk`

## Project Structure

```text
.
├── apps
│   ├── api
│   │   ├── src
│   │   │   ├── auth.js
│   │   │   ├── prisma.js
│   │   │   ├── repository.js
│   │   │   ├── server.js
│   │   │   ├── store.js
│   │   │   └── data
│   │   │       ├── seed.json
│   │   │       └── state.json
│   └── web
│       └── src
│           ├── App.jsx
│           ├── main.jsx
│           └── styles.css
├── docs
├── prisma
├── docker-compose.yml
├── package.json
└── README.md
```

## Local Setup

### Prerequisites

- Node.js 18+ recommended
- npm
- Optional: Docker for PostgreSQL mode

### 1. Install dependencies

```bash
npm install
```

### 2. Choose a runtime mode

#### Option A: Quick local mode

This mode works without PostgreSQL. The API uses the local JSON state file.

```bash
npm run dev
```

#### Option B: PostgreSQL mode

If you want Prisma-backed persistence, use the provided PostgreSQL container.

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose up -d postgres
```

3. Apply the Prisma schema:

```bash
npm run prisma:migrate
```

4. Start the app:

```bash
npm run dev
```

### 3. Open the app

- Web app: `http://localhost:5173`
- API: `http://localhost:3001`

## Environment Variables

Create a `.env` file if you want database-backed mode.

```env
DATABASE_URL="postgresql://taskflow:taskflow@localhost:5432/taskflow?schema=public"
JWT_SECRET="change-me-in-production"
```

If `DATABASE_URL` is missing, the API falls back to the local JSON store.

## Demo Account

- Email: `admin@taskflow.local`
- Password: `admin123`

## Useful Scripts

From the repository root:

- `npm run dev` - starts API and web together
- `npm run dev:web` - starts only the web app
- `npm run dev:api` - starts only the API
- `npm run build:web` - builds the frontend
- `npm run prisma:migrate` - runs database migrations
- `npm run prisma:deploy` - deploys migrations in production-like environments
- `npm run prisma:studio` - opens Prisma Studio

## Notes

- The frontend is intentionally styled with a purple-first visual language for consistency across all major screens.
- The API and UI are both responsive and can be used on desktop and mobile.
- `apps/api/src/data/state.json` is the editable local data store in fallback mode.
- `apps/api/src/data/seed.json` is the initial seed used when no runtime state exists.
- The project does not depend on any external SaaS API for its core workflow.

## License

No license file is currently provided.
