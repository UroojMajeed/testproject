# ReclaimOS — MongoDB Data Model

23 collections. Written for Mongoose 8.

## Modelling decisions (read this before the schemas)

The source spec was written for PostgreSQL. Porting it to MongoDB means making
four decisions explicitly rather than translating tables one-to-one:

**1. Embed vs. reference**

| Data | Decision | Reason |
|---|---|---|
| Playbook **steps** | **Embed** in `playbooks` | Bounded (~5–40), always read with the parent, edited as a unit |
| Playbook **versions** | Separate collection | Unbounded growth; only read on the history screen |
| Playbook **runs** | Separate collection | Unbounded, high write volume |
| Agent **tools** | **Embed** in `agents` | Small, fixed, always needed for authorisation |
| Agent **runs** | Separate collection | Unbounded, large payloads, different retention |
| Agent run **steps** | **Embed** in the run | Written once, always read together |
| **Time entries** | Separate collection | The highest-volume collection in the system |
| Workspace **goals** | Separate collection | ≤5 but independently tracked and status-changed |
| **Comments** | Separate collection | Unbounded per task |

The rule applied throughout: embed when bounded *and* always read with the
parent; reference otherwise. The 16 MB document cap is the hard ceiling, but
unbounded arrays hurt long before that.

**2. Tenancy.** Every domain document carries `workspaceId`, and every compound
index leads with it. This is enforced by a Mongoose plugin, not by convention.

**3. Money.** Integer minor units + ISO code. `{ amount: 5000, currency: 'USD' }`
is $50.00. Never a float.

**4. Analytics.** Mongo has no `GROUP BY` across joins, so the dashboard must
never scan `timeEntries` live. Two mitigations, both required:
- denormalised rollups on the parent (`task.actualMinutes`, `playbook.stats`)
- a **`metricsDaily`** pre-aggregated collection written by a nightly job and
  incrementally on write, which every dashboard and analytics query reads

---

## Shared plugins

```js
// tenantPlugin   → adds workspaceId (required, indexed) + pre-hook guard that
//                  throws if a find/update runs without it
// timestamps     → createdAt / updatedAt on every schema
// softDelete     → deletedAt + a default query filter excluding deleted docs
// toJSON         → _id → id, strips __v and every field marked `private: true`
```

---

## 1. `users`

```js
{
  _id, 
  name: String,                       // required
  email: String,                      // required, unique, lowercase, indexed
  passwordHash: String,               // private. null for OAuth-only accounts
  authProviders: [{                   // google | microsoft
    provider: String, providerId: String, email: String, linkedAt: Date
  }],
  avatarUrl: String,
  timezone: String,                   // IANA, default 'UTC'
  locale: String,
  emailVerifiedAt: Date,
  mfa: { enabled: Boolean, secret: String /*private*/, backupCodes: [String] /*private*/ },
  defaultWorkspaceId: ObjectId,       // ref Workspace
  notificationPrefs: {
    email: { weeklyReview, approvals, delegation, auditReminder },  // Booleans
    inApp: { … },
    digestHour: Number                // 0–23, local
  },
  status: 'active' | 'suspended' | 'deleted',
  lastLoginAt: Date,
  deletedAt: Date
}
```
Indexes: `{ email: 1 }` unique · `{ 'authProviders.providerId': 1 }` sparse

## 2. `workspaces`

```js
{
  _id, name, slug,                    // slug unique
  industry: String,                   // software|agency|ecommerce|education|consulting|healthcare|realestate|other
  teamSize: String,
  timezone: String,
  currency: String,                   // ISO 4217
  workingHours: { start: '09:00', end: '17:00', days: [1,2,3,4,5] },
  buybackRate: {
    amountMinor: Number,              // e.g. 5000 = $50.00/hr
    currency: String,
    method: 'calculated' | 'manual',
    annualCompensationMinor: Number,
    annualHours: Number,              // default 2000
    overrideReason: String,
    updatedAt: Date, updatedBy: ObjectId
  },
  weeklyBuybackGoalHours: Number,
  currentWeeklyHours: Number,         // self-reported baseline
  targetWeeklyHours: Number,
  onboarding: { step: Number, completedAt: Date, skipped: [String] },
  aiSettings: {
    provider: 'anthropic', model: String,
    monthlySpendCapMinor: Number,
    dataRetentionDays: Number,
    defaultApprovalRequired: Boolean,
    maxAgentPermissionLevel: Number   // 1–4 ceiling for the whole workspace
  },
  ownerId: ObjectId,                  // ref User
  createdBy: ObjectId,
  deletedAt: Date
}
```

> `buybackRate` is stored on the workspace, not the user, because it is a
> business-level figure. It is **displayed with a "planning estimate" label
> everywhere it appears** — never as a wage or a valuation.

## 3. `memberships`

```js
{
  _id, workspaceId, userId,           // userId null while invitation pending
  role: 'owner' | 'manager' | 'member',
  status: 'invited' | 'active' | 'suspended' | 'removed',
  invitedEmail: String,
  invitedBy: ObjectId,
  inviteTokenHash: String,            // private
  inviteExpiresAt: Date,
  joinedAt: Date,
  weeklyCapacityHours: Number         // for workload views
}
```
Indexes: `{ workspaceId, userId }` unique sparse · `{ workspaceId, status }` ·
`{ inviteTokenHash }` sparse

## 4. `goals`

```js
{
  _id, workspaceId, userId,
  title, description,
  type: 'business' | 'personal',
  targetHoursPerWeek: Number,
  targetDate: Date,
  progressHours: Number,              // rollup
  status: 'active' | 'achieved' | 'paused' | 'abandoned',
  order: Number
}
```

## 5. `projects`

```js
{ _id, workspaceId, name, color, description, ownerId, archivedAt }
```

## 6. `tasks`

```js
{
  _id, workspaceId, projectId,
  title, description,
  status: 'inbox'|'planned'|'in_progress'|'waiting'|'review'|'completed'|'cancelled',
  priority: 'low'|'medium'|'high'|'urgent',
  ownerId, createdBy, collaboratorIds: [ObjectId],
  category: String,                   // sales|admin|delivery|meetings|strategy|development|support|finance|other
  estimatedMinutes: Number,
  actualMinutes: Number,              // ROLLUP from timeEntries. denormalised
  dueDate: Date,
  drip: {
    energy: 'very_low'|'low'|'neutral'|'high'|'very_high',
    value:  'low'|'medium'|'high'|'strategic',
    quadrant: 'delegation'|'replacement'|'investment'|'production',
    source: 'user' | 'ai' | 'derived',
    confidence: Number,               // 0–1, only when source='ai'
    classifiedAt: Date, classifiedBy: ObjectId
  },
  recurrence: {                       // detected, not user-entered
    isRecurring: Boolean,
    frequency: 'daily'|'weekly'|'biweekly'|'monthly'|'irregular',
    occurrences: Number,
    avgMinutesPerOccurrence: Number,
    firstSeenAt: Date, lastSeenAt: Date,
    detectedBy: 'system' | 'user'
  },
  buybackCandidate: Boolean,
  fingerprint: String,                // normalised title hash → groups repeats
  playbookId, recommendationId, buybackPlanId,
  source: 'manual'|'timer'|'calendar'|'ai'|'playbook'|'agent',
  tags: [String],
  interventionCount: Number,          // times the founder had to step back in
  completedAt: Date, deletedAt: Date
}
```
Indexes: `{ workspaceId, status, dueDate }` · `{ workspaceId, ownerId, status }` ·
`{ workspaceId, 'drip.quadrant' }` · `{ workspaceId, fingerprint }` ·
`{ workspaceId, title: 'text', description: 'text' }`

> `fingerprint` is how "weekly reporting" entered nine different ways still
> groups into one recurring task. Normalise: lowercase, strip punctuation and
> dates, stem. It is what the entire recommendation engine keys on.

## 7. `timeEntries` — highest volume collection

```js
{
  _id, workspaceId, userId, taskId, projectId,
  title,                              // denormalised so the timeline needs no join
  description, notes,
  date: Date,                         // UTC midnight of the local day — bucket key
  startAt: Date, endAt: Date,
  durationMinutes: Number,            // required, integer
  category: String,
  energy: 'very_low'|'low'|'neutral'|'high'|'very_high',
  value:  'low'|'medium'|'high'|'strategic',
  dripQuadrant: String,               // denormalised at write
  source: 'manual'|'timer'|'calendar'|'imported'|'playbook_run'|'agent',
  externalRef: { provider, eventId, calendarId },
  status: 'draft'|'confirmed'|'ignored',   // calendar imports land as 'draft'
  estimatedCostMinor: Number,         // durationMinutes/60 × buybackRate, frozen at write
  deletedAt: Date
}
```
Indexes: `{ workspaceId, userId, startAt: -1 }` ·
`{ workspaceId, date: -1 }` · `{ workspaceId, taskId }` ·
`{ workspaceId, 'externalRef.eventId' }` unique sparse ·
`{ workspaceId, dripQuadrant, date }`

> `estimatedCostMinor` is frozen at write time on purpose. If the buyback rate
> changes in March, February's audit must not silently rewrite itself.
> Calendar imports are `status: 'draft'` until the human confirms — the app
> never counts an unreviewed meeting as audited time.

## 8. `metricsDaily` — pre-aggregated, read by every dashboard

```js
{
  _id, workspaceId, userId,           // userId null = whole-workspace roll-up
  date: Date,
  trackedMinutes: Number,
  byQuadrant:  { delegation, replacement, investment, production },   // minutes
  byCategory:  Map<String, Number>,
  byEnergy:    { very_low, low, neutral, high, very_high },
  meetingMinutes, focusMinutes, untrackedMinutes,
  costMinor: { delegation, replacement, investment, production },
  reclaimed: { estimatedMinutes, verifiedMinutes },
  delegatedMinutes, automatedMinutes, eliminatedMinutes,
  entryCount, taskCompletedCount, playbookRunCount,
  agentRunCount, agentFailureCount, interventionCount,
  computedAt: Date
}
```
Index: `{ workspaceId, userId, date: -1 }` unique

> This collection is why the dashboard stays fast. Every analytics screen and
> every stat card reads `metricsDaily`, never `timeEntries`. Written
> incrementally on time-entry mutation and rebuilt nightly for correction.

## 9. `aiAnalyses` — every LLM call is a record

```js
{
  _id, workspaceId, requestedBy,
  type: 'time_audit'|'drip_classify'|'recommendations'|'playbook_draft'|
        'playbook_improve'|'weekly_review'|'agent_plan',
  periodStart, periodEnd,
  inputSummary: Mixed,                // the facts sent, NOT the full prompt text
  promptVersion: String,              // e.g. 'timeAudit.v1'
  provider, model,
  rawOutput: String,                  // private, retention-capped
  parsedOutput: Mixed,                // post-Zod-validation
  validationErrors: [String],
  status: 'pending'|'completed'|'failed'|'rejected_invalid_output',
  tokensIn, tokensOut, costMinor,
  latencyMs, error
}
```
Indexes: `{ workspaceId, type, createdAt: -1 }`

> Every recommendation the user sees links back to the analysis that produced
> it. Without this you cannot answer "why did it say that?" three weeks later,
> and you cannot audit or improve prompt versions.

## 10. `recommendations`

```js
{
  _id, workspaceId, analysisId, taskId,
  type: 'eliminate'|'automate'|'delegate'|'replace'|'simplify'|'keep',
  title, description,
  reason: String,                     // the human-readable "why"
  evidence: [{                        // the facts the reason is grounded in
    signal: String,                   // 'frequency'|'duration'|'energy'|'repetition'|'value'|'history'
    label: String, value: Mixed
  }],
  estimatedHoursSavedPerWeek: Number,
  estimatedValueSavedMinor: Number,
  implementationEffortMinutes: Number,
  confidence: {
    level: 'low'|'medium'|'high',
    score: Number,                    // 0–1, COMPUTED from signals below
    signals: [{ name, weight, value }]
  },
  priorityScore: Number,              // internal ranking only. never shown as a "score"
  status: 'pending'|'accepted'|'rejected'|'snoozed'|'implemented'|'verified',
  snoozedUntil: Date,
  decidedBy, decidedAt,
  rejectionReason: String,            // feeds back into ranking
  feedback: { helpful: Boolean, comment: String },
  buybackPlanId
}
```
Indexes: `{ workspaceId, status, priorityScore: -1 }` · `{ workspaceId, taskId }`

> `confidence.score` is derived server-side from `signals` — sample size,
> frequency, energy-rating consistency, duration variance, past delegation
> outcomes. The model does not get to assert its own confidence number.
> `priorityScore` orders the queue internally and is deliberately **never
> rendered to the user as a score of their work**.

## 11. `buybackPlans`

```js
{
  _id, workspaceId, taskId, recommendationId,
  title,
  strategy: 'eliminate'|'delegate'|'automate'|'replace'|'simplify'|'keep',
  currentOwnerId,
  newOwner: { type: 'user'|'agent'|'external'|'none', userId, agentId, externalName },
  currentProcess: String,
  frequency: String,
  successCriteria: {
    definitionOfDone: String,
    qualityChecks: [String],
    approvalRequired: Boolean,
    deadline: Date,
    expectedOutput: String,
    timeLimitMinutes: Number
  },
  estimate: {
    hoursSavedPerWeek: Number,
    baselineMinutesPerWeek: Number,   // measured from timeEntries BEFORE the change
    baselineWindow: { start: Date, end: Date },
    implementationEffortMinutes: Number
  },
  verification: {
    method: 'time_entry_delta'|'manual'|'playbook_run',
    measuredWindow: { start: Date, end: Date },
    currentMinutesPerWeek: Number,
    hoursSavedPerWeek: Number,        // VERIFIED. computed, never AI-asserted
    confidence: 'low'|'medium'|'high',
    sampleWeeks: Number,
    measuredAt: Date
  },
  playbookId, taskIds: [ObjectId],
  status: 'draft'|'approved'|'in_progress'|'completed'|'verified'|'cancelled',
  targetDate, approvedBy, approvedAt, completedAt
}
```
Indexes: `{ workspaceId, status }` · `{ workspaceId, taskId }`

> **`estimate` and `verification` are separate sub-documents by design.** The
> dashboard's "time reclaimed" headline reads `verification.hoursSavedPerWeek`
> only. Estimates are shown as "projected" with distinct styling. Conflating
> the two is the fastest way to lose a user's trust, and the spec calls it out
> as a named product risk.
>
> `baselineWindow` must be captured *before* the transfer, or verification is
> meaningless. The plan cannot move to `approved` without it.

## 12. `playbooks` (steps embedded)

```js
{
  _id, workspaceId,
  name, slug, description, purpose,
  trigger: String,
  ownerId, backupOwnerId,
  frequency: 'ad_hoc'|'daily'|'weekly'|'biweekly'|'monthly'|'quarterly',
  category, tags: [String],
  requiredTools: [String],
  inputs: [String], outputs: [String],
  steps: [{                           // EMBEDDED
    _id, stepNumber: Number,
    title, instructions,              // rich text / markdown
    assignedToId, assignedRole,
    estimatedMinutes: Number,
    requiredInput, expectedOutput,
    attachments: [{ name, url, mimeType, sizeBytes }],
    approvalRequired: Boolean,
    aiAssisted: Boolean, aiPrompt: String
  }],
  qualityChecklist: [{ item: String, required: Boolean }],
  escalationRules: String,
  commonMistakes: [String],
  status: 'draft'|'published'|'archived',
  version: Number,
  publishedAt, publishedBy,
  reviewDueAt: Date,                  // drives the "not updated in 60 days" nudge
  aiGenerated: Boolean, sourceAnalysisId,
  visibility: 'workspace'|'restricted', allowedMemberIds: [ObjectId],
  stats: { runCount, avgDurationMinutes, avgQualityScore, successRate, lastRunAt },
  createdBy, deletedAt
}
```
Indexes: `{ workspaceId, status }` · `{ workspaceId, ownerId }` ·
`{ workspaceId, name: 'text', description: 'text' }` · `{ workspaceId, reviewDueAt }`

## 13. `playbookVersions`

```js
{ _id, workspaceId, playbookId, version, snapshot: Mixed,
  changeSummary, changedBy, changedAt, aiSuggested: Boolean }
```

## 14. `playbookRuns`

```js
{
  _id, workspaceId, playbookId, playbookVersion,
  executor: { type: 'user'|'agent', userId, agentId },
  taskId,
  startedAt, completedAt,
  status: 'in_progress'|'completed'|'abandoned'|'failed',
  durationMinutes,
  stepResults: [{ stepId, status, startedAt, completedAt,
                  durationMinutes, notes, blockedReason, approvedBy }],
  qualityScore: Number,               // 1–5, from reviewer
  checklistResults: [{ item, passed }],
  reviewedBy, reviewedAt, reviewNotes,
  interventionCount: Number
}
```
Indexes: `{ workspaceId, playbookId, startedAt: -1 }`

## 15. `agents`

```js
{
  _id, workspaceId,
  name, description, purpose,
  systemInstructions: String,
  model: String,
  permissionLevel: 1 | 2 | 3 | 4,     // default 1. see 01-architecture §5
  status: 'draft'|'testing'|'active'|'paused'|'disabled',
  trigger: { type: 'manual'|'schedule'|'event', cron: String, event: String },
  inputSchema: Mixed, outputSchema: Mixed,   // JSON Schema
  tools: [{                           // EMBEDDED — needed on every authz check
    toolName: String,
    scopes: [String],
    enabled: Boolean,
    constraints: Mixed,               // e.g. { maxRecipients: 1, domainsAllowed: [...] }
    riskLevel: 'low'|'medium'|'high'
  }],
  integrationIds: [ObjectId],
  maxRunsPerDay: Number, maxCostPerRunMinor: Number,
  failureBehavior: 'stop'|'retry'|'notify_owner',
  maxRetries: Number,
  approvalRequired: Boolean, approverIds: [ObjectId],
  ownerId, successMetric: String,
  reliability: { runCount, successCount, failureCount,
                 interventionCount, successRate, avgCostMinor },
  validation: { testedAt, testedBy, testRunId, passed: Boolean },
  lastRunAt, disabledReason, deletedAt
}
```

> **`status` cannot become `active` unless `validation.passed === true`.**
> Enforced in the service layer and by a schema-level pre-save hook, not by the
> UI. Raising `permissionLevel` above the workspace's
> `aiSettings.maxAgentPermissionLevel` is rejected.

## 16. `agentRuns`

```js
{
  _id, workspaceId, agentId, agentVersion,
  mode: 'test' | 'live',
  triggeredBy: { type: 'user'|'schedule'|'event', userId, detail },
  startedAt, completedAt,
  status: 'pending'|'running'|'awaiting_approval'|'completed'|'failed'|'cancelled',
  input: Mixed,
  steps: [{ index, type: 'thought'|'tool_call'|'output',
            toolName, args: Mixed, result: Mixed,
            riskLevel, approved: Boolean, at: Date, durationMs }],
  output: Mixed, proposedActions: [Mixed],   // in test mode: what it WOULD do
  error: { code, message, stack },
  tokensIn, tokensOut, costMinor,
  humanIntervention: Boolean,
  approvalId, cancelledBy
}
```
Indexes: `{ workspaceId, agentId, startedAt: -1 }` · `{ workspaceId, status }`
TTL: raw `input`/`output` purged per `aiSettings.dataRetentionDays`.

## 17. `approvals`

```js
{
  _id, workspaceId,
  subjectType: 'agent_run'|'agent_action'|'buyback_plan'|'playbook_publish'|
               'delegation_review'|'task_completion'|'integration_connect',
  subjectId,
  requestedBy: { type: 'user'|'agent'|'system', userId, agentId },
  action: String, description: String,
  riskLevel: 'low'|'medium'|'high',
  payloadPreview: Mixed,              // EXACTLY what will execute, shown verbatim
  status: 'pending'|'approved'|'rejected'|'expired'|'cancelled',
  approverIds: [ObjectId],
  decidedBy, decidedAt, rejectionReason,
  expiresAt: Date
}
```
Indexes: `{ workspaceId, status, createdAt: -1 }` · `{ subjectType, subjectId }`

## 18. `integrations`

```js
{
  _id, workspaceId, userId,
  provider: 'google_calendar'|'microsoft_calendar'|'gmail'|'outlook'|'slack'|
            'teams'|'notion'|'clickup'|'asana'|'trello'|'zapier',
  externalAccountId, externalAccountEmail,
  accessTokenEnc: String,             // private. AES-256-GCM
  refreshTokenEnc: String,            // private. AES-256-GCM
  tokenExpiresAt: Date,
  scopes: [String],
  status: 'connected'|'expired'|'revoked'|'error',
  lastSyncAt, syncCursor, lastError,
  connectedBy, deletedAt
}
```

> Both token fields are `select: false` **and** excluded by the `toJSON`
> plugin. There is a unit test asserting a serialized integration contains
> neither. Encryption key comes from KMS/env, never the repo.

## 19. `calendarEvents`

```js
{
  _id, workspaceId, userId, integrationId,
  externalId, calendarId,
  title, description, location,
  startAt, endAt, isAllDay,
  attendeeCount: Number, isOrganizer: Boolean, isRecurring: Boolean,
  recurringEventId: String,
  suggestedCategory: String, suggestedEnergy: String,
  status: 'pending_review'|'confirmed'|'ignored',
  timeEntryId: ObjectId,              // set once converted
  raw: Mixed
}
```
Index: `{ workspaceId, userId, startAt: -1 }` · `{ integrationId, externalId }` unique

## 20. `focusBlocks`

```js
{ _id, workspaceId, userId, startAt, endAt, purpose, taskId, goalId,
  protectedBlock: Boolean, source: 'user'|'ai_suggested',
  status: 'scheduled'|'completed'|'skipped', externalEventId }
```

## 21. `notifications`

```js
{ _id, workspaceId, userId,
  type: 'audit_reminder'|'delegation_ready'|'approval_request'|'agent_failed'|
        'overload_warning'|'playbook_review'|'weekly_summary'|'task_assigned'|'mention',
  title, body, data: Mixed, actionUrl,
  channels: ['in_app','email'],
  readAt, sentAt, emailSentAt,
  priority: 'low'|'normal'|'high' }
```
Index: `{ workspaceId, userId, readAt: 1, createdAt: -1 }`

## 22. `weeklyReviews`

```js
{
  _id, workspaceId, userId,
  weekStart, weekEnd,
  metrics: {
    trackedHours, reclaimedHoursEstimated, reclaimedHoursVerified,
    tasksDelegated, tasksCompleted, playbooksCreated, playbookRuns,
    agentRuns, agentFailures, interventions,
    byQuadrant: { delegation, replacement, investment, production },
    meetingHours, focusHours
  },
  topTimeDrain: { taskId, title, hours },
  biggestImprovement: String,
  goalProgress: [{ goalId, progressHours, targetHours }],
  summary: String,                    // AI-generated, grounded in metrics above
  nextStepRecommendationId,
  analysisId,
  status: 'generated'|'viewed'|'acknowledged'|'dismissed',
  viewedAt, acknowledgedAt
}
```
Index: `{ workspaceId, userId, weekStart: -1 }` unique

## 23. `auditLogs` — append-only

```js
{
  _id, workspaceId,
  actor: { type: 'user'|'agent'|'system', userId, agentId, name },
  action: String,                     // AGENT_CREATED, TASK_DELEGATED, RECOMMENDATION_ACCEPTED,
                                      // INTEGRATION_CONNECTED, MEMBER_INVITED, PLAYBOOK_PUBLISHED,
                                      // AGENT_ACTION_APPROVED, PERMISSION_CHANGED …
  entityType, entityId,
  before: Mixed, after: Mixed,        // diff for state changes
  metadata: Mixed,
  ipAddress, userAgent,
  createdAt: Date
}
```
Indexes: `{ workspaceId, createdAt: -1 }` · `{ workspaceId, entityType, entityId }` ·
`{ workspaceId, 'actor.agentId', createdAt: -1 }`

No update or delete path exists on this collection at the service layer. It
becomes the compliance backbone the moment agents can act.

## 24. `refreshTokens`

```js
{ _id, userId, tokenHash, family, userAgent, ipAddress,
  expiresAt, revokedAt, replacedBy, createdAt }
```
TTL index on `expiresAt`. Rotation with reuse detection: presenting a revoked
token revokes the entire `family` and forces re-login.

## 25. `subscriptions`

```js
{ _id, workspaceId, plan: 'free'|'pro'|'business'|'team'|'enterprise',
  status, provider: 'stripe', customerId, subscriptionId,
  currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, seats,
  usage: { aiCallsThisPeriod, aiCostMinorThisPeriod, agentRunsThisPeriod,
           timeEntriesThisPeriod, workspaceCount } }
```

---

## Relationship map

```
User ──< Membership >── Workspace
                          │
      ┌───────────────────┼────────────────────┬──────────────┐
      │                   │                    │              │
  TimeEntry ──► Task ──► Recommendation ──► BuybackPlan ──► Playbook
      │           │            │                 │              │
      │           │            ▼                 │              ├─► PlaybookVersion
      │           │       AiAnalysis             │              └─► PlaybookRun
      │           │                              │
      │           └──────────────────────────────┴──► Agent ──► AgentRun ──► Approval
      │
      └──► MetricsDaily (pre-aggregated)          AuditLog ◄── everything
```

## The core data flow this model has to support

```
4h logged on "weekly reporting"        → timeEntries (×N)
recurrence detector groups them        → tasks.recurrence, tasks.fingerprint
classified low-value / draining        → tasks.drip.quadrant = 'replacement'
AI analyses the period                 → aiAnalyses
advisor proposes delegation            → recommendations (+ evidence, + confidence signals)
founder accepts                        → buybackPlans (baseline captured HERE)
AI drafts the process                  → playbooks (status: draft → published)
assigned to a team member              → tasks + playbookRuns
team member executes                   → timeEntries under THEIR userId
founder now spends 30 min reviewing    → timeEntries, reduced
verification job compares windows      → buybackPlans.verification.hoursSavedPerWeek
dashboard reads the rollup             → metricsDaily.reclaimed.verifiedMinutes
weekly review proposes the next one    → weeklyReviews + a new recommendation
```

Every arrow in that chain is a field in this model. If a step has no home, the
loop breaks and "verified hours reclaimed" — the product's north-star metric —
cannot be computed.
