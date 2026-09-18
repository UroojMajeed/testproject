# ReclaimOS — Architecture & Stack

> Status: design phase. No application code yet. This document is the contract
> the code will be written against.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + **Vite** (JavaScript) | Vite, not CRA — CRA is deprecated and slow |
| UI | Bootstrap 5 + `react-bootstrap` + one `custom.scss` | No jQuery. Theme via Sass variable overrides, not `!important` |
| Routing | `react-router-dom` v6 | Nested layouts + route guards |
| Server state | **TanStack Query v5** | Caching, retries, background refetch. Do not hand-roll with `useEffect` |
| Client state | Context + `useReducer` | Auth, workspace, UI only. Redux is not justified yet |
| Forms | `react-hook-form` + **Zod** | Same Zod schemas shared with the server |
| Charts | Recharts | DRIP matrix (scatter), analytics (bar/line/area) |
| Backend | Node 20 + **Express 5** | Express 5 handles async errors natively |
| Database | **MongoDB 7 + Mongoose 8** | See `04-data-model.md` |
| Jobs | BullMQ + Redis | Agent runs, calendar sync, weekly reviews, AI calls |
| Auth | JWT access (15 min, in memory) + refresh (7 d, httpOnly cookie) | Never `localStorage` — XSS-readable |
| AI | Anthropic Claude (primary), provider-abstracted | Structured JSON output, schema-validated |
| Files | S3-compatible (R2/S3) via presigned URLs | Playbook attachments, avatars |
| Email | Resend or SES + React Email | Invites, resets, weekly review |
| Logging | pino + `pino-http` | Structured JSON, request-id correlation |
| Testing | Vitest + Supertest + `mongodb-memory-server` / RTL + Playwright | Real DB in integration tests |

### Two deviations from the source spec, and why

1. **MongoDB instead of PostgreSQL.** Your call, and workable — the domain is
   document-shaped (playbooks with steps, agent runs with step traces, AI
   payloads). The cost lands on analytics: the DRIP matrix, weekly review, and
   "verified hours reclaimed" are all group-by queries. Those become
   `$facet` aggregation pipelines instead of SQL. Mitigation is in
   `04-data-model.md` §Analytics: denormalised rollup fields + a
   `metricsDaily` pre-aggregated collection so the dashboard never scans
   `timeEntries`.
2. **JavaScript instead of TypeScript.** Also your call. Since there is no
   compiler catching shape drift across ~20 collections and ~60 endpoints,
   two things become mandatory rather than optional: **Zod schemas in
   `shared/`** used by both client and server, and **JSDoc typedefs** on every
   service function so the editor still gives you autocomplete. Without those
   two, an app this size gets painful around month three.

## 2. System topology

```
Browser (React SPA)
   │  HTTPS, JWT access token in memory, refresh in httpOnly cookie
   ▼
Express API  ──► MongoDB (primary store)
   │            
   ├──► Redis + BullMQ ──► Workers  ──► AI Orchestrator ──► Claude API
   │                          │
   │                          └──────► Integrations (Google Calendar, Gmail…)
   └──► S3 (attachments)
```

**The AI never talks to the database.** It returns JSON; the backend validates,
authorises, executes, and logs. This is the single most important architectural
rule in the product:

```
LLM → structured JSON → Zod validation → permission layer → action → audit log
```

## 3. Backend layering

`route → validate → controller → service → model`

- **Controllers** touch `req`/`res` and nothing else. No Mongoose, no business rules.
- **Services** hold all business logic. No `req`/`res`. Unit-testable in isolation.
- **Models** are Mongoose schemas plus query helpers only.
- **Serializers** shape every response. Nothing reaches the client that hasn't
  passed through one — this is what stops `passwordHash`, `accessTokenEnc`, and
  raw LLM payloads leaking.

## 4. Multi-tenancy (non-negotiable)

Every domain document carries `workspaceId`. Every compound index leads with
`workspaceId`. A `tenantScope` middleware resolves the active workspace from the
request, verifies membership, and attaches `req.workspace` + `req.membership`.

Services receive `workspaceId` as an explicit first argument — never read from a
global or from `req`. A query written without `workspaceId` is a cross-tenant
data leak, so there is an integration test that asserts every model query
includes it.

## 5. Authorisation model

Three roles (`owner`, `manager`, `member`) plus AI agents, which are **not user
accounts** and have their own permission ladder.

| Capability | owner | manager | member |
|---|:--:|:--:|:--:|
| Workspace settings, billing, delete | ✔ | | |
| Invite / remove members, change roles | ✔ | ✔ (member only) | |
| View all-workspace analytics | ✔ | ✔ | own only |
| Create/edit playbooks | ✔ | ✔ | ✔ (draft) |
| Publish playbook | ✔ | ✔ | |
| Assign tasks | ✔ | ✔ | |
| Create / configure AI agents | ✔ | ✔ (level ≤ 2) | |
| Approve agent actions | ✔ | ✔ | |
| Connect integrations | ✔ | ✔ | |
| Track own time, run playbooks | ✔ | ✔ | ✔ |

Agent permission levels (default **1**):

1. **Suggest only** — produces recommendations, writes nothing.
2. **Draft** — creates drafts; cannot send, publish, or notify.
3. **Execute with approval** — every action opens an `Approval` first.
4. **Limited autonomous** — pre-approved low-risk actions only, hard rate cap,
   full audit trail, kill switch.

Actions an agent can **never** take at any level: move money, delete business
data, change permissions, invite users, publish externally, send email to an
external address.

## 6. Security baseline

- `helmet`, strict CORS allowlist, `express-rate-limit` (tight on `/auth`, `/ai`)
- bcrypt cost 12; refresh-token rotation with reuse detection (revoke family)
- `express-mongo-sanitize` — blocks `$`/`.` operator injection into queries
- Integration OAuth tokens encrypted at rest (AES-256-GCM, key from KMS/env);
  never serialized to the client under any circumstance
- CSRF token on cookie-authenticated refresh endpoint
- All env vars validated by Zod at boot — the process refuses to start if one is
  missing, rather than failing at 3am on first use
- Append-only `auditLogs` for every state-changing action, human or agent
- Secrets never in the repo; `.env.example` is committed, `.env` is not

## 7. Conventions

- **Money** stored as integer minor units (cents) + ISO currency code. Never floats.
- **Time** stored UTC as `Date`. Workspace/user timezone applied at render and at
  aggregation-bucket boundaries only.
- **Durations** in whole minutes, integer.
- **IDs** `_id` ObjectId internally; serializers emit `id` as a string. `__v`
  never leaves the server.
- **Deletes** are soft (`deletedAt`) for tasks, playbooks, agents, time entries.
  Hard delete only on account/workspace deletion (GDPR export first).
- **Enums** live in `server/src/config/constants.js` and are mirrored in
  `shared/` — one source of truth, imported by both Mongoose and Zod.
- **API envelope** every response:
  `{ success, data, meta?, error?: { code, message, details? } }`
- **Errors** thrown as `ApiError(statusCode, code, message)`; `errorHandler.js`
  is the only place that formats them.
