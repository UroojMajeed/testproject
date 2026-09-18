# ReclaimOS — Repository Structure

npm workspaces monorepo. One `npm install`, one `npm run dev`, and — critically —
**Zod validation schemas shared between client and server** so a field can never
mean two different things on the two sides.

## Root

```
reclaimos/
├── package.json                 # workspaces: ["shared","server","client"]
├── .env.example                 # committed. .env is NOT
├── .gitignore  .editorconfig  .nvmrc  .prettierrc  eslint.config.js
├── docker-compose.yml           # mongo + redis + mongo-express for local dev
├── README.md
├── docs/                        # this specification
└── .github/workflows/ci.yml     # lint → test → build on every PR
```

## `shared/` — the contract between client and server

```
shared/
├── package.json
└── src/
    ├── constants/
    │   ├── roles.js             # OWNER, MANAGER, MEMBER
    │   ├── drip.js              # DELEGATION, REPLACEMENT, INVESTMENT, PRODUCTION
    │   ├── energy.js            # VERY_LOW … VERY_HIGH  (+ numeric scores)
    │   ├── value.js             # LOW, MEDIUM, HIGH, STRATEGIC
    │   ├── statuses.js          # task / plan / run / approval / agent statuses
    │   └── agentPermissions.js  # levels 1–4
    ├── schemas/                 # Zod — imported by server validation AND RHF
    │   ├── auth.schema.js       workspace.schema.js  timeEntry.schema.js
    │   ├── task.schema.js       playbook.schema.js   agent.schema.js
    │   ├── recommendation.schema.js  buybackPlan.schema.js
    │   └── ai/                  # schemas the LLM output must satisfy
    │       ├── dripClassification.schema.js
    │       ├── timeAudit.schema.js
    │       ├── recommendation.schema.js
    │       └── playbookDraft.schema.js
    └── utils/
        ├── buybackRate.js       # ONE implementation, used by both sides
        ├── dripQuadrant.js      # (energy, value) → quadrant. Pure function
        └── duration.js
```

> `buybackRate.js` and `dripQuadrant.js` live here deliberately. They are the two
> formulas the whole product rests on; having a second copy in the frontend is
> how you end up with a dashboard that disagrees with the database.

## `server/`

```
server/
├── package.json
└── src/
    ├── index.js                 # ONLY: env, DB connect, listen, graceful shutdown
    ├── app.js                   # ONLY: express instance + middleware + routes (exported for tests)
    │
    ├── config/
    │   ├── env.js               # Zod-validated process.env — crash at boot if missing
    │   ├── db.js                # mongoose.connect + connection events
    │   ├── redis.js  logger.js  constants.js
    │
    ├── modules/                 # ◄── one folder per domain. This is the spine.
    │   ├── auth/                # auth.routes|controller|service|validation|test.js
    │   ├── users/               # + user.model.js  user.serializer.js
    │   ├── workspaces/          # workspace.model.js, membership.model.js, invites
    │   ├── goals/
    │   ├── timeEntries/         # + timer service, calendar-import reconciliation
    │   ├── tasks/               # + projects
    │   ├── drip/                # matrix aggregation + classification
    │   ├── recommendations/
    │   ├── buybackPlans/        # + verification service (estimated vs verified)
    │   ├── delegation/          # queue views over tasks + plans
    │   ├── playbooks/           # playbook.model.js (steps embedded), versions, runs
    │   ├── agents/              # agent.model.js, agentRun.model.js, tool registry
    │   ├── approvals/
    │   ├── integrations/        # oauth flows, token vault, per-provider adapters
    │   │   └── providers/ google.js  microsoft.js  slack.js  notion.js
    │   ├── calendar/            # events cache, focus blocks, load analysis
    │   ├── analytics/           # aggregation pipelines + metricsDaily rollups
    │   ├── weeklyReview/
    │   ├── notifications/
    │   ├── search/              # global search + Cmd-K resolver
    │   ├── billing/             # stripe webhooks, plan limits
    │   └── audit/               # append-only auditLogs writer + reader
    │
    ├── ai/                      # ◄── the AI orchestrator. Never in a controller.
    │   ├── client.js            # provider abstraction (Claude default)
    │   ├── orchestrator.js      # build context → call → parse → validate → persist
    │   ├── guardrails.js        # output validation, refusal handling, cost caps
    │   ├── contextBuilder.js    # assembles workspace facts for a prompt
    │   ├── costTracker.js       # per-workspace token/spend metering
    │   ├── prompts/             # VERSIONED. Never edit in place — add v2
    │   │   ├── timeAudit.v1.js         dripClassify.v1.js
    │   │   ├── recommendations.v1.js   playbookDraft.v1.js
    │   │   ├── playbookImprove.v1.js   weeklyReview.v1.js
    │   │   └── agentExecutor.v1.js
    │   └── tools/               # tool registry agents may be granted
    │       ├── registry.js      # name → { schema, handler, riskLevel, scopes }
    │       └── impl/ readTimeEntries.js  createTask.js  draftEmail.js  …
    │
    ├── jobs/
    │   ├── queues.js
    │   └── workers/ agentRunner.js  calendarSync.js  weeklyReview.js
    │                 recurrenceDetector.js  metricsRollup.js  notificationSender.js
    │
    ├── middleware/
    │   ├── auth.middleware.js       # verify JWT → req.user
    │   ├── tenantScope.middleware.js# resolve workspace + membership → req.workspace
    │   ├── rbac.middleware.js       # requireRole('owner','manager')
    │   ├── validate.middleware.js   # validate(schema) → 422 with field errors
    │   ├── rateLimiter.js  upload.middleware.js
    │   ├── notFound.js  errorHandler.js   # LAST. the only error formatter
    │
    ├── utils/
    │   ├── ApiError.js  ApiResponse.js  asyncHandler.js
    │   ├── token.js  crypto.js       # AES-256-GCM for integration tokens
    │   ├── paginate.js  email.js
    │
    └── db/
        ├── seed.js
        └── migrations/               # migrate-mongo — yes, Mongo needs them too
```

**Rule:** a module folder owns its model, routes, controller, service,
validation, serializer, and tests. Adding a domain concept means adding one
folder — not editing seven shared files.

## `client/`

```
client/
├── index.html  vite.config.js       # dev proxy /api → localhost:5000
└── src/
    ├── main.jsx                     # Router + QueryClient + providers
    ├── App.jsx                      # route tree only
    │
    ├── routes/
    │   ├── paths.js                 # EVERY url as a constant. no magic strings
    │   ├── ProtectedRoute.jsx       # redirect to /login, preserve intended url
    │   ├── RoleRoute.jsx
    │   └── OnboardingGate.jsx       # force incomplete onboarding into the wizard
    │
    ├── layouts/
    │   ├── MarketingLayout.jsx      # landing page
    │   ├── AuthLayout.jsx           # centered card
    │   ├── OnboardingLayout.jsx     # progress rail, no sidebar
    │   ├── AppLayout.jsx            # sidebar + topbar + <Outlet/>
    │   └── components/ Sidebar.jsx  Topbar.jsx  MobileTabBar.jsx
    │                    WorkspaceSwitcher.jsx  NotificationBell.jsx
    │
    ├── features/                    # ◄── mirrors server/src/modules 1:1
    │   ├── auth/      pages/ components/ api.js hooks.js
    │   ├── onboarding/
    │   ├── dashboard/
    │   ├── timeAudit/ components/ TimerWidget.jsx  EntryForm.jsx
    │   │                          DayTimeline.jsx  CalendarImportReview.jsx
    │   ├── drip/      components/ DripMatrix.jsx  QuadrantPanel.jsx  TaskChip.jsx
    │   ├── advisor/   components/ RecommendationCard.jsx  WhyPanel.jsx
    │   │                          BuybackPlanWizard.jsx
    │   ├── tasks/     delegation/  playbooks/  agents/  approvals/
    │   ├── calendar/  analytics/   weeklyReview/  team/  settings/  search/
    │   │
    │   └── (each feature = pages/ · components/ · api.js · hooks.js · schemas.js)
    │
    ├── components/                  # ONLY generic, domain-free UI
    │   ├── ui/     Button Modal ConfirmDialog Badge Toast EmptyState
    │   │           Skeleton DataTable Pagination Tabs Drawer StatCard
    │   ├── form/   TextField SelectField DateField DurationField
    │   │           EnergyPicker ValuePicker FileField   # RHF-bound
    │   ├── charts/ BarChart LineChart ScatterChart DonutChart
    │   ├── ai/     AiBadge ConfidenceMeter ExplanationBox EstimateVsVerified
    │   └── feedback/ ErrorBoundary LoadingScreen OfflineBanner
    │
    ├── hooks/      useAuth useWorkspace useDebounce useMediaQuery
    │               useCommandPalette useTimer useToast
    ├── context/    AuthContext.jsx  WorkspaceContext.jsx  UIContext.jsx
    ├── lib/        apiClient.js     # axios + interceptors + refresh-token retry
    │               queryClient.js  queryKeys.js  formatters.js  analytics.js
    └── styles/     custom.scss      # Bootstrap variable overrides FIRST, then imports
                    _variables.scss  _tokens.scss  _theme-dark.scss
```

### Frontend rules

1. **Feature-first, not type-first.** A `components/` folder holding the whole
   app stops scaling around 40 files. Only truly generic, domain-free UI lives in
   `src/components/`.
2. **No `fetch` in a component.** Components call hooks; hooks call `api.js`;
   `api.js` calls `apiClient`. One place to change when the API moves.
3. **`queryKeys.js` is centralised** — invalidation bugs are otherwise unfixable.
4. **Bootstrap is themed, not overridden.** Set Sass variables before
   `@import "bootstrap"`. Zero `!important` in the codebase.
5. Every list screen ships with four states: loading (skeleton), empty
   (with a primary action), error (retry), loaded. Build the empty state first —
   in this product the user's first week *is* the empty state.
