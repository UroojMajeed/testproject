# ReclaimOS

AI-powered time buyback operating system.
**Grow your business. Reclaim your life.**

ReclaimOS finds the work consuming a founder's time, calculates its cost,
creates a plan to eliminate, automate, or delegate it, and helps the team
execute the replacement — then measures how much time actually came back.

> **Status: phases 0–1 built.** Authentication, workspaces, memberships, the
> onboarding wizard and the design system are implemented and tested. The audit,
> sort, advisor and measurement features are specified in `docs/` but not yet
> written — see [`SETUP.md`](SETUP.md) to run what exists.

```
backend/    Node 20 · Express · MongoDB · Mongoose · Zod · Vitest
frontend/   React 18 · Vite · Bootstrap 5 · TanStack Query · react-hook-form
docs/       the specification both were built against
```

## The loop

```
Audit  →  Decide  →  Transfer  →  Measure  →  repeat
```

North-star metric: **verified founder hours reclaimed per active workspace per month.**

## Stack

React 18 (JS) + Vite + Bootstrap 5 · Node 20 + Express 5 · MongoDB + Mongoose ·
Redis + BullMQ · Claude API

## Documentation

| Doc | Contents |
|---|---|
| [`docs/01-architecture.md`](docs/01-architecture.md) | Stack, topology, layering, multi-tenancy, RBAC, security, conventions |
| [`docs/02-folder-structure.md`](docs/02-folder-structure.md) | Full monorepo tree — `shared/`, `server/`, `client/` |
| [`docs/03-ui-screens.md`](docs/03-ui-screens.md) | 38 screens, route map, layouts, states |
| [`docs/04-data-model.md`](docs/04-data-model.md) | 25 MongoDB collections, indexes, embed-vs-reference rationale |
| [`docs/05-api-contract.md`](docs/05-api-contract.md) | REST endpoints, envelope, error codes |
| [`docs/06-ai-layer.md`](docs/06-ai-layer.md) | Orchestrator, prompts, guardrails, cost control |
| [`docs/07-build-order.md`](docs/07-build-order.md) | 12 phases, MVP definition of done, risks |
| [`docs/08-entry-path-revision.md`](docs/08-entry-path-revision.md) | **Calendar-first entry path** — supersedes onboarding + phase order |

## Core product rules

1. **The AI returns intent; the backend decides and executes.** The model never
   holds a database handle or an OAuth token.
2. **Estimated and verified savings are different fields.** The dashboard
   headline only ever shows verified.
3. **Agents default to "suggest only"** and cannot be activated without a stored
   passing test.
4. **Every recommendation shows its evidence.** No unexplained AI output reaches
   the user.
5. **The buyback rate is a planning estimate**, labelled as such everywhere —
   never presented as a wage or a valuation.
6. **First value lands in the first session.** The calendar sort replaces the
   fourteen-day audit as the front door; the timer is optional precision.
