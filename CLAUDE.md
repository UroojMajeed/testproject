# ReclaimOS — working agreement

Built step by step. One repository, two applications, two separate jobs.

```
testproject/
├── backend/     the API.  Node + Express + MongoDB.   → http://localhost:5000
└── frontend/    the app.  React + Vite + Bootstrap.   → http://localhost:3000
```

## Where we are

**Step 1 — authentication.** Sign up, sign in, sign out, session refresh,
password reset. Nothing else exists yet, and nothing else should be added until
the next step is agreed.

When asked for something outside the current step, say so before building it.
Scope creep is the thing this rebuild exists to avoid.

## The boundary — treat these as two developers

**Work inside one folder at a time.** A backend task changes files under
`backend/` only; a frontend task changes files under `frontend/` only. Do not
adjust the other side in the same pass.

**When a change genuinely spans both**, say so first, do the backend, state the
contract it now exposes (endpoint, request shape, response shape), then do the
frontend against that contract. Two commits, not one.

**Never** reach across the boundary to make something work. If the frontend
needs a field the API does not return, that is a backend task — raise it.

## The contract between them

- `backend/src/routes.js` — what exists
- each module's `*.validation.js` — what a request must look like
- each module's `*.serializer.js` — what a response contains
- `frontend/src/lib/api/endpoints.js` — the client's view of the same thing

When those four disagree, the bug is real even though both sides pass their own
tests. `endpoints.js` is the first place to look when something 404s or 422s.

Every response uses one envelope:

```json
{ "success": true,  "data": { … }, "meta": { … } }
{ "success": false, "error": { "code": "…", "message": "…", "details": [ … ] } }
```

## Ports

Backend **5000**, frontend **3000**, two terminals. Vite proxies `/api` to 5000,
which keeps the browser same-origin in development so the refresh cookie behaves
exactly as it will in production. `strictPort` is on, so a taken port fails
loudly instead of sliding to 3001 and breaking CORS silently.

## Before saying a change is done

```bash
npm run verify            # lint + tests + production build
npm run test:integration  # backend work touching the database (needs mongod)
```

## Rules that are not up for negotiation

1. **No access token in browser storage.** It lives in memory in
   `tokenStore.js`, and an eslint rule enforces it.
2. **Money is integer minor units. Durations are whole minutes.** No floats.
3. **Serializers shape every response.** Nothing reaches a client without one —
   that is what stops `passwordHash` leaking.
4. **Secrets are validated at boot**, in `config/env.js`. A missing one stops
   the process rather than failing later.
5. **Auth is not softened for convenience.** Rotation with reuse detection,
   hashed tokens, identical responses for wrong-password and no-such-user.

## Commits

Scoped to the folder:

```
backend: add pagination to the user list
frontend: show the lockout message on sign in
```
