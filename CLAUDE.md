# ReclaimOS — working agreement

Built step by step. One repository, two applications, two separate jobs.

```
testproject/
├── backend/     the API.  Node + Express + MongoDB.   → http://localhost:5000
└── frontend/    the app.  React + Vite + Bootstrap.   → http://localhost:3000
```

## Where we are

**Step 1 — authentication.** Done. Sign up, sign in, sign out, session refresh,
password reset, plus the landing page and the design system.

**Step 2 — what your week costs.** Done. Rate, weekly audit, dashboard:

```
sign in → buyback rate → first audit (last week) → dashboard → every Friday
```

- A **workspace**, owned by one person. Every document carries `workspaceId`.
- A **buyback rate**, computed from income and hours, kept as dated records.
- **Activities** that persist, so weeks can be compared.
- A **weekly audit** of last week: per activity, estimated hours and energy.
- A **dashboard** that ranks activities by what they cost, and points at the worst.

The weekly audit asks only for hours and energy — fast, factual recall.

**Step 3 — what matters.** Done. One question per activity, asked **once**:

> If you stopped doing this for a month, what happens?
> Revenue stops · Something slips · Not much

That is the value axis. Value against energy gives the DRIP quadrant:

|              | drains you    | does not drain you |
| ------------ | ------------- | ------------------ |
| **low value**  | **Delegate**  | **Invest**         |
| **high value** | **Replace**   | **Produce**        |

The distinction this exists for is Delegate against Replace. Both drain you, and
today they are indistinguishable — one goes to a VA on Friday, the other is a hire
that breaks the business if it goes to the wrong person.

Value is asked once because it barely changes; hours and energy are asked weekly
because they do. That difference in cadence is the reason for the split, and it is
what keeps the Friday habit to two questions.

The flow is now:

```
sign in → buyback rate → first audit → first sort → dashboard → every Friday
```

Only the *first* sort gates. After that an unsorted activity is a prompt on the
dashboard, never a wall in front of figures somebody already has.

Deliberately **not** in step 3, each being a step of its own: bundling activities
into a role, the hiring roadmap, playbooks, delegation tracking, any AI, calendar
import. Step 3 names the quadrant and gives per-quadrant totals; step 4 turns that
into a plan.

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
6. **Every query carries `workspaceId`.** A query without one is a cross-tenant
   leak. The tenant plugin throws rather than quietly returning another
   workspace's rows.
7. **Estimated and verified are different fields, always.** They never share a
   name, a colour or a sentence. Everything in step 2 is estimated — self-reported
   recall — and must be named so it cannot later be mistaken for measured fact.
8. **The buyback rate is a planning estimate**, labelled as such wherever it
   appears. Never a wage, never a valuation.
9. **A computed figure stores its inputs and its formula version.** A rate that
   changed in March must not silently rewrite what June was told. Stamp the rate
   onto anything derived from it rather than looking it up again later.

## Commits

Scoped to the folder:

```
backend: add pagination to the user list
frontend: show the lockout message on sign in
```
