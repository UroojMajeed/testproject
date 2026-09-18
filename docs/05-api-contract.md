# ReclaimOS — API Contract

REST, `/api/v1`. Every response uses one envelope:

```json
{ "success": true,  "data": {...}, "meta": { "page":1,"limit":25,"total":132 } }
{ "success": false, "error": { "code":"VALIDATION_ERROR","message":"...","details":[...] } }
```

Workspace scope travels in the `X-Workspace-Id` header (not the path) — it keeps
URLs short and makes the tenant guard a single middleware.

**Standard list params:** `?page&limit&sort&order&q&from&to` plus per-resource filters.
**Error codes:** `VALIDATION_ERROR` 422 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 ·
`NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `AI_UNAVAILABLE` 503 ·
`AI_INVALID_OUTPUT` 502 · `PLAN_LIMIT_EXCEEDED` 402 · `APPROVAL_REQUIRED` 428

```
AUTH
POST   /auth/register                 POST   /auth/login
POST   /auth/logout                   POST   /auth/refresh          # httpOnly cookie
GET    /auth/me                       POST   /auth/forgot-password
POST   /auth/reset-password           POST   /auth/verify-email
GET    /auth/oauth/:provider          GET    /auth/oauth/:provider/callback
POST   /auth/mfa/enable|verify|disable

WORKSPACES & TEAM
GET    /workspaces                    POST   /workspaces
GET    /workspaces/:id                PATCH  /workspaces/:id        DELETE /workspaces/:id
PATCH  /workspaces/:id/buyback-rate   PATCH  /workspaces/:id/onboarding
GET    /workspaces/:id/members        POST   /workspaces/:id/invites
POST   /invites/:token/accept         DELETE /members/:id           PATCH  /members/:id/role
POST   /workspaces/:id/transfer-ownership
GET    /workspaces/:id/export         # GDPR data export

GOALS
GET|POST /goals          GET|PATCH|DELETE /goals/:id

TIME AUDIT
GET|POST /time-entries                GET|PATCH|DELETE /time-entries/:id
POST   /time-entries/bulk             PATCH  /time-entries/bulk
POST   /timer/start                   POST   /timer/stop     POST /timer/pause
GET    /timer/current
GET    /time-entries/summary          ?groupBy=category|energy|quadrant|day
GET    /time-entries/export           # CSV
GET    /calendar-events/pending       POST /calendar-events/:id/confirm|ignore
POST   /calendar-events/bulk-confirm

TASKS
GET|POST /tasks                       GET|PATCH|DELETE /tasks/:id
POST   /tasks/:id/delegate            POST /tasks/:id/complete
POST   /tasks/:id/convert-to-playbook GET|POST /tasks/:id/comments
GET    /tasks/:id/time-entries        GET  /tasks/recurring

DRIP
GET    /drip-matrix                   ?from&to&userId&minHours
PATCH  /tasks/:id/drip                # manual classification, always wins
POST   /ai/classify-tasks             # batch AI suggestion

AI ADVISOR
POST   /ai/analyze-time               { periodStart, periodEnd }
POST   /ai/generate-recommendations
GET    /recommendations               ?status&type
GET    /recommendations/:id
POST   /recommendations/:id/accept|reject|snooze
POST   /recommendations/:id/feedback
POST   /ai/ask                        # workspace-aware assistant. returns insight + actions[]

BUYBACK PLANS
GET|POST /buyback-plans               GET|PATCH /buyback-plans/:id
POST   /buyback-plans/:id/approve|complete|cancel
GET    /buyback-plans/:id/verification
POST   /buyback-plans/:id/verify      # recompute verified savings from time entries

DELEGATION
GET    /delegation/queue              ?section=needs_decision|ready|in_progress|review|completed
POST   /delegation/:taskId/assign|approve|request-changes|reassign
GET    /delegation/stats

PLAYBOOKS
GET|POST /playbooks                   GET|PATCH|DELETE /playbooks/:id
POST   /playbooks/:id/publish|duplicate|archive
GET    /playbooks/:id/versions        POST /playbooks/:id/restore/:version
POST   /playbooks/:id/runs            PATCH /playbook-runs/:id
POST   /playbook-runs/:id/complete|review
POST   /ai/generate-playbook          { description | taskId }
POST   /ai/improve-playbook/:id

AGENTS
GET|POST /agents                      GET|PATCH|DELETE /agents/:id
POST   /agents/:id/test               # dry run. required before activate
POST   /agents/:id/activate|pause|disable
GET    /agents/:id/runs               GET /agent-runs/:id
POST   /agent-runs/:id/cancel
GET    /ai/tools                      # tool registry available to agents

APPROVALS
GET    /approvals                     ?status&subjectType
POST   /approvals/:id/approve|reject

INTEGRATIONS
GET    /integrations                  GET /integrations/:provider/connect
GET    /integrations/:provider/callback
DELETE /integrations/:id              POST /integrations/:id/sync

CALENDAR & FOCUS
GET    /calendar                      ?from&to
GET|POST /focus-blocks                PATCH|DELETE /focus-blocks/:id
GET    /calendar/load-analysis

ANALYTICS
GET    /analytics/dashboard           GET /analytics/time
GET    /analytics/buyback             GET /analytics/delegation
GET    /analytics/playbooks           GET /analytics/agents
GET    /analytics/team
GET    /weekly-reviews                GET /weekly-reviews/:id
POST   /weekly-reviews/:id/acknowledge

MISC
GET    /notifications                 POST /notifications/:id/read  POST /notifications/read-all
GET    /search                        ?q&types=tasks,playbooks,people,agents
GET    /audit-logs                    ?entityType&entityId&actorId
GET    /billing/subscription          POST /billing/checkout|portal
POST   /webhooks/stripe               POST /webhooks/:provider
GET    /health                        GET /health/ready
```

## Endpoints that need care

| Endpoint | Why |
|---|---|
| `POST /ai/*` | Rate-limited per workspace, cost-capped, always writes an `aiAnalysis`, always returns `analysisId` so the UI can show "why" |
| `POST /agents/:id/activate` | **Rejects with 428 unless `validation.passed`.** The single most important guard in the product |
| `POST /agent-runs` (live) | Every tool call checked against `agent.tools` scopes; high-risk opens an `Approval` and returns `awaiting_approval`, never executes optimistically |
| `POST /buyback-plans/:id/approve` | Captures the baseline window from `timeEntries` at approval time — after this, baseline is immutable |
| `PATCH /workspaces/:id/buyback-rate` | Does **not** retroactively recompute `estimatedCostMinor` on historical entries |
| `GET /analytics/*` | Reads `metricsDaily` only. If it touches `timeEntries`, it's wrong |
| `DELETE /workspaces/:id` | Soft-delete + 30-day grace, export offered first |
