# Running ReclaimOS locally

Two applications, two folders, no shared build step.

```
reclaimos/
├── backend/     Node + Express + MongoDB API   → http://localhost:5000
├── frontend/    React + Vite + Bootstrap SPA   → http://localhost:5173
└── docs/        the specification this was built against
```

## 1. Prerequisites

- Node 20 or newer
- MongoDB 7 — either running locally, or `npm run db:up` if you have Docker

## 2. Install

```bash
npm run install:all
```

## 3. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Fill in the two secrets. They are validated at boot and the server refuses to
start without them, rather than failing later:

```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
```

The frontend needs no configuration. Vite proxies `/api` to the backend, which
keeps the browser same-origin in development so the refresh cookie behaves
exactly as it will in production.

## 4. Run

```bash
npm run db:up          # or start your own mongod
npm run dev:backend    # terminal 1
npm run dev:frontend   # terminal 2
```

Open http://localhost:5173.

## 5. Verify

```bash
npm run verify           # lint + unit tests + production build
npm run test:integration  # needs a real mongod
```

`test:integration` uses `mongodb-memory-server` by default. To point it at an
instance you already have:

```bash
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/reclaimos-itest npm run test:integration
```

## What is built

Phases 0 and 1 of `docs/08-entry-path-revision.md`: authentication, workspaces,
memberships, the three-step onboarding wizard, and the design system.

The audit, sort, advisor and measurement features are specified but not yet
implemented. The sidebar shows them as unavailable rather than linking to
screens that do not exist, and the dashboard says it has nothing to measure
rather than displaying zeroes as though they were data.
