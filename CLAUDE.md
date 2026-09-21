# ReclaimOS — working agreement

One repository, two applications, two separate jobs.

```
testproject/
├── backend/     the API.  Node + Express + MongoDB.   → http://localhost:5000
├── frontend/    the app.  React + Vite + Bootstrap.   → http://localhost:3000
└── docs/        the specification both were built against
```

## The boundary — treat these as two developers

**Work inside one folder at a time.** When a task is a backend task, change files
under `backend/` only. When it is a frontend task, change files under `frontend/`
only. Do not "helpfully" adjust the other side in the same pass.

**When a change genuinely spans both**, say so before starting, do the backend
first, state the contract it now exposes (endpoint, request shape, response
shape), then do the frontend against that contract. Two commits, not one.

**Never** reach across the boundary to make something work. If the frontend
needs a field the API does not return, that is a backend task — raise it, do not
paper over it in the client.

## The contract between them

The API is the only thing these two share. It is defined by:

- `backend/src/routes.js` — what exists
- each module's `*.validation.js` — what a request must look like
- each module's `*.serializer.js` — what a response contains
- `frontend/src/lib/api/endpoints.js` — the client's view of the same thing

If those four stop agreeing, the bug is real even when both sides pass their own
tests. `endpoints.js` is the file to check first when something 404s or 422s.

Every response has the same envelope:

```json
{ "success": true,  "data": { … }, "meta": { … } }
{ "success": false, "error": { "code": "…", "message": "…", "details": [ … ] } }
```

## Ports and processes

Backend on **5000**, frontend on **3000**, run in two separate terminals. Vite
proxies `/api` to 5000, which keeps the browser same-origin in development so
the refresh cookie behaves exactly as it will in production.

Vite uses `strictPort`, so if 3000 is taken it fails instead of sliding to 3001
and breaking CORS silently.

## Before saying a change is done

```bash
npm run lint      # both projects
npm run test      # 192 unit tests
npm run build     # production build of the frontend
```

Run `npm run verify` to do all three. For backend work that touches the
database, also run `npm run test:integration` (needs a live mongod).

## Rules that are not up for negotiation

1. **Estimated and verified savings are different fields** and never share a
   colour, a component, or a sentence. The dashboard headline reads verified only.
2. **The buyback rate is a planning estimate**, labelled as such wherever it
   appears. Never a wage, never a valuation.
3. **The recommendation engine is deterministic.** Confidence is computed from
   declared signals in `recommendations.engine.js`. A model may phrase the
   sentence in `narrator.js`; it may not change a number.
4. **Baselines are frozen before a transfer**, never after.
5. **No access token in browser storage.** It lives in memory in
   `tokenStore.js`, and there is an eslint rule enforcing it.
6. **Money is integer minor units.** Durations are whole minutes. No floats.
7. **Every query carries `workspaceId`.** A query without it is a cross-tenant
   leak, and the tenant plugin throws.

## Commits

Conventional-ish and scoped to the folder:

```
backend: add pagination to the time-entry list
frontend: show coverage warning on the plan screen
```
