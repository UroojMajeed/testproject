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

## 6. Try the whole loop

```bash
npm run seed --prefix backend
```

That creates a demo workspace with a fortnight of realistic activity. Sign in
with `founder@reclaimos.test` / `reclaim-your-time-2026` and the dashboard, the
matrix and the advisor are populated immediately.

To walk the loop from nothing instead: register, finish the three onboarding
steps, and you land straight in the ten-minute sort.

```
sign up → onboarding (3 steps) → sort last week (~10 min) → your week and its cost
   → advisor recommends → accept → plan approved, baseline frozen
   → draft a playbook → assign it → log the reduced time → verify
   → weekly review proposes the next one
```

## What is built

The complete MVP loop from `docs/08-entry-path-revision.md`:

| Area | State |
|---|---|
| Auth, workspaces, memberships, RBAC | built |
| Onboarding (3 steps) | built |
| The sort — grouping + classification | built |
| Time audit, manual entries | built |
| DRIP matrix with manual reclassification | built |
| Recommendation engine + evidence + confidence | built |
| Buyback plans, frozen baseline, verification + coverage | built |
| Playbooks, drafting, publishing, versions, runs | built |
| Delegation queue | built |
| Weekly review | built |
| Settings, buyback rate, invitations | built |
| Calendar (Google/Outlook) sync | **not built** — the sort takes manual recall |
| Email delivery (invites, resets) | **not built** — tokens are issued server-side, not mailed |
| AI narration via an LLM | **not built** — the engine is deterministic; see below |
| Billing | **not built** |

### About the "AI"

The advisor is a deterministic engine (`backend/src/services/recommendations.engine.js`).
Every number a user sees — the action, the hours, the confidence — is computed
from their own entries, so it can be explained, tested and reproduced. A
language model is optional and confined to `narrator.js`, where it would phrase
the sentence and nothing else. Swapping that one file changes the prose and no
figure on the screen.

This is not a stand-in for a missing API key. Confidence computed from declared
signals is the design; a model-asserted confidence number is not evidence of
anything.
