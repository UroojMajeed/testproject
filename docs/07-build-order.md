# ReclaimOS — Build Order

> **Phase order superseded by [`08-entry-path-revision.md`](08-entry-path-revision.md).** Calendar import moves to phase 2, playbooks leave the MVP, and the timer moves after the sort. The MVP definition of done and the risk table below still apply.

The MVP proves exactly one thing: **can a founder discover and actually reclaim
time?** Everything that doesn't serve that question waits.

| Phase | Scope | Exit criterion |
|---|---|---|
| 0 | Repo, workspaces, lint/format, CI, docker-compose, `shared/` constants + Zod, design tokens | `npm run dev` boots client + server + mongo |
| 1 | Auth, users, workspaces, memberships, tenant guard, RBAC, AppLayout, routing, error handling | A user can sign up, create a workspace, invite someone, and land on an empty dashboard |
| 2 | **Time audit** — entries, timer, categories, energy, value, timeline, day summary, CSV | A user can log a week of work in under 5 min/day |
| 3 | Tasks, `fingerprint`, recurrence detection, `metricsDaily` rollups | Nine "weekly reporting" entries collapse into one recurring task |
| 4 | **DRIP matrix** — aggregation, scatter UI, drag reclassification, quadrant cost | The founder sees $X/month sitting in Delegation |
| 5 | **AI advisor** — orchestrator, guardrails, `aiAnalyses`, recommendations with evidence + computed confidence, Why panel | A recommendation the user can explain back to you |
| 6 | **Buyback plans** — wizard, baseline capture, approval, delegation queue | A task is transferred to a person with a definition of done |
| 7 | **Playbooks** — editor, embedded steps, publish, versions, runner, AI draft | The assignee runs the process without asking the founder |
| 8 | **Verification + weekly review** — baseline vs. current, estimated vs. verified, weekly email | Dashboard shows *verified* hours reclaimed. **MVP complete** |
| 9 | Calendar integration (Google first), import review, focus blocks | Meetings audit themselves |
| 10 | Analytics depth, team views, notifications, billing | — |
| 11 | **AI agents** — builder, tool registry, test sandbox, approvals, run history | An agent runs at level 3 with every action approved and logged |
| 12 | Command palette, global search, assistant drawer, more integrations | — |

## MVP definition of done

Not "every screen exists". This journey, end to end, by a real user:

create workspace → log several activities → classify them → see the DRIP
matrix → run the AI analysis → get recommendations → accept one → create a
buyback plan → generate a playbook → assign it → record the new time →
**see verified hours reclaimed** → receive the next recommendation.

If that works, there's a product. If only the screens exist, there isn't.

## Validation targets (to test, not to assume)

≥60% complete onboarding · ≥40% complete a first audit · ≥25% approve a
recommendation · ≥20% transfer one task · users can explain *why* a task was
recommended · 5 real founders testing · 3 reporting a measurable improvement.

## Risks worth designing against now

| Risk | Mitigation baked into this design |
|---|---|
| Users never finish the audit | 3-entry onboarding, 2-tap energy capture, calendar import, gap prompts |
| Recommendations feel generic | grounded in real entries; mandatory `evidence[]`; visible Why panel |
| Users don't trust agents | default level 1, test required before activation, approvals with payload preview, kill switch |
| It becomes another task manager | every screen routes back to the loop; the north-star metric is verified hours reclaimed |
| Estimated savings mislead | `estimate` and `verification` are separate fields, styled differently, and the headline uses verified only |
| Playbooks go stale | `reviewDueAt` + 60-day nudge + AI improvement suggestions from run data |
| AI costs run away | aggregate-before-prompt, fingerprint caching, scheduled jobs, per-workspace spend cap |
