# ReclaimOS — UI Screens & Route Map

38 screens. MVP set is marked **[MVP]**; everything else is V2+.

## Route map

| # | Route | Screen | Layout | Access | MVP |
|---|---|---|---|---|:--:|
| 1 | `/` | Landing | Marketing | public | ✔ |
| 2 | `/pricing` | Pricing | Marketing | public | |
| 3 | `/login` | Sign in | Auth | public | ✔ |
| 4 | `/register` | Sign up | Auth | public | ✔ |
| 5 | `/forgot-password` | Forgot password | Auth | public | ✔ |
| 6 | `/reset-password/:token` | Reset password | Auth | public | ✔ |
| 7 | `/verify-email/:token` | Verify email | Auth | public | |
| 8 | `/invite/:token` | Accept invitation | Auth | public | |
| 9 | `/onboarding/:step` | Onboarding wizard (6 steps) | Onboarding | auth | ✔ |
| 10 | `/app` | Dashboard | App | member+ | ✔ |
| 11 | `/app/audit` | Time Audit | App | member+ | ✔ |
| 12 | `/app/audit/import` | Calendar import review | App | member+ | |
| 13 | `/app/drip` | DRIP Matrix | App | member+ | ✔ |
| 14 | `/app/advisor` | AI Advisor | App | member+ | ✔ |
| 15 | `/app/advisor/:id` | Recommendation detail | App | member+ | ✔ |
| 16 | `/app/plans` | Buyback plans | App | manager+ | ✔ |
| 17 | `/app/plans/new` | Buyback plan wizard (5 steps) | App | manager+ | ✔ |
| 18 | `/app/plans/:id` | Plan detail + verification | App | manager+ | ✔ |
| 19 | `/app/tasks` | Task list | App | member+ | ✔ |
| 20 | `/app/tasks/:id` | Task detail | App | member+ | ✔ |
| 21 | `/app/delegation` | Delegation queue | App | manager+ | ✔ |
| 22 | `/app/playbooks` | Playbook library | App | member+ | ✔ |
| 23 | `/app/playbooks/new` | Playbook editor (create) | App | member+ | ✔ |
| 24 | `/app/playbooks/:id/edit` | Playbook editor | App | member+ | ✔ |
| 25 | `/app/playbooks/:id` | Playbook reader | App | member+ | ✔ |
| 26 | `/app/playbooks/:id/run` | Playbook runner | App | member+ | ✔ |
| 27 | `/app/playbooks/:id/versions` | Version history / diff | App | manager+ | |
| 28 | `/app/agents` | Agent library | App | manager+ | |
| 29 | `/app/agents/new` · `/:id/edit` | Agent builder | App | manager+ | |
| 30 | `/app/agents/:id/test` | Agent test sandbox | App | manager+ | |
| 31 | `/app/agents/:id/runs` · `/runs/:runId` | Run history / run detail | App | manager+ | |
| 32 | `/app/approvals` | Approvals inbox | App | manager+ | |
| 33 | `/app/calendar` | Calendar & focus | App | member+ | |
| 34 | `/app/review` | Weekly review | App | member+ | ✔ |
| 35 | `/app/analytics` | Analytics | App | manager+ | ✔ |
| 36 | `/app/team` | Team | App | manager+ | |
| 37 | `/app/settings/*` | Settings (6 tabs) | App | varies | ✔ |
| 38 | `/403` `/404` `/500` | Error screens | any | — | ✔ |

**Global, on every app screen:** Command Palette (`⌘K` / `Ctrl+K`),
notification bell, workspace switcher, global search, AI assistant drawer.

**Mobile:** sidebar collapses to a 5-item bottom tab bar —
Home · Audit · Tasks · Advisor · More.

---

## 1. Landing `/`

Marketing site, separate layout, no auth chrome.

- **Hero** — "Stop spending your best hours on work someone, or something, else
  can do." CTA: *Start your time audit* / secondary *See how it works*
- **Problem** — "You don't need another task manager"
- **The loop** — 4 cards: Audit → Decide → Transfer → Measure
- **DRIP Matrix** — interactive demo with sample data
- **AI Advisor** — animated recommendation card
- **Playbooks** · **AI Agents** · **Analytics** sections
- **Pricing** · **FAQ** · **Footer**
- Testimonials section exists in markup but stays hidden until there are real
  ones. No fabricated social proof.

## 2. Auth screens `/login` `/register` `/forgot-password` `/reset-password`

Centered card, product mark, split-panel on ≥lg with a value-prop illustration.

- Email + password, Google OAuth, Microsoft OAuth
- Inline field validation from the shared Zod schema (no alert boxes)
- Password strength meter on register
- Generic "if that email exists we sent a link" on forgot — no account enumeration
- Rate-limit lockout message after 5 failures

## 3. Onboarding wizard `/onboarding/:step` **[MVP]**

Six steps, progress rail, resumable (server stores `onboarding.step`),
skippable steps clearly marked *Skip for now*.

| Step | Screen | Collects |
|---|---|---|
| 1 | Welcome | — (value proposition, "Get started") |
| 2 | Create workspace | company name, industry, team size, timezone, currency |
| 3 | Buyback goal | current hrs/wk, target hrs/wk → computed goal; work to do more of; tasks disliked |
| 4 | Buyback rate | annual compensation, annual working hours → rate; editable override |
| 5 | Connect tools | Google Calendar / Outlook / Gmail / Slack / Notion / ClickUp (all optional) |
| 6 | First audit | "What did you work on yesterday?" — 3 quick entries with energy + value |

Step 4 shows the formula transparently:

```
Buyback Rate = Annual compensation ÷ Annual working hours
$400,000 ÷ 8,000 = $50/hour
```

Labelled **"Your estimated internal time value"**, with a one-line note that it
is a planning figure for deciding what to off-load — not a market wage or a
financial valuation. Editable, with an optional reason captured.

Exit criterion: step 6 completion drops the user on the dashboard with at least
one real time entry, so the dashboard is never empty on first view.

## 4. Dashboard `/app` **[MVP]**

The command centre. Greeting + date + workspace switcher + primary action
**Start time audit**.

**Row 1 — four stat cards** (all computed from live data, never placeholders):

| Card | Value | Sub |
|---|---|---|
| Time reclaimed | `verifiedHoursSaved` this month | vs last month delta |
| Buyback potential | Σ estimated hrs/wk of pending recs | "identified opportunity" |
| Tasks to transfer | delegation-queue count | "awaiting decision" |
| Active playbooks | published count | "processes documented" |

**Row 2 — Next Best Action.** Single large card, the product's centrepiece:
task name, hours/week, why it surfaced, recommended action, estimated time
reclaimed. Buttons: *Review* · *Later* · *Dismiss* (dismissal reason feeds back
into ranking).

**Row 3 — Weekly progress chart.** Stacked bars by DRIP quadrant + a line for
hours reclaimed. Range filter: this week / last week / this month / custom.

**Row 4 — three panels:** Focus today (tasks + calendar blocks) ·
Pending approvals · Goals progress.

*Empty state* (no entries yet): the whole grid is replaced by a single
"Start your first audit" panel with a 3-entry inline form. Do not show zeroed
stat cards to a new user.

## 5. Time Audit `/app/audit` **[MVP]**

The data-entry engine. Everything downstream depends on it, so friction here is
the #1 product risk.

- **Header** — date/range picker, view toggle (Timeline · List · Week grid),
  *Start timer*, *Add entry*, *Import calendar*, *Analyze with AI*
- **Sticky timer widget** — start/pause/resume/stop, running elapsed, task +
  category selector. On stop, a modal asks the one question that matters:
  **"How did this feel?"** → Draining · Neutral · Energising. Two taps total.
- **Timeline** — day column, entries as blocks, height ∝ duration, left border
  colour = DRIP quadrant, gaps highlighted as "untracked — add?"
- **Entry form** — title, description, date, start/end **or** duration,
  project, category, energy (5-point), value (4-point), repetition frequency,
  notes
- **Day summary rail** — total tracked, by category donut, energy split,
  untracked gap, est. cost of low-value hours at the buyback rate
- **Bulk actions** — multi-select → set category / energy / value, merge, delete
- **CSV export**

**Calendar import review `/app/audit/import`** — imported events arrive as
*suggestions*, never confirmed entries. Two-column review: event on the left,
proposed entry on the right. Per row: Confirm · Edit duration · Change category ·
Ignore · Convert to task. Bulk-confirm recurring series. The app never writes to
the user's calendar here.

## 6. DRIP Matrix `/app/drip` **[MVP]**

Four-quadrant scatter. X = monetary value, Y = energy.

```
                 Gives energy
                      ▲
        INVESTMENT    │    PRODUCTION
        learn, relationships │ sales, product, strategy
   Less ─────────────┼───────────────── More
   money             │                  money
        DELEGATION   │    REPLACEMENT
        admin, data entry │ work you're good at but dislike
                      ▼
                 Drains energy
```

- Tasks render as draggable chips: name · hrs/week · est. cost/week · energy dot
- Drag between quadrants → persists `drip.source = 'user'` (user always overrides AI)
- Quadrant headers show aggregate hours + cost, so "you spend $1,840/mo in
  Delegation" is visible at a glance
- Click a chip → side drawer: task detail, contributing time entries, AI
  classification with **why**, buttons *Accept* · *Change* · *Create buyback plan*
- Filters: date range, person, category, minimum hours
- Toggle: bubble size = hours vs = cost
- AI classification appears as a **suggestion badge**, never applied silently

## 7. AI Advisor `/app/advisor` **[MVP]**

- **Time-health summary** — one paragraph, generated, grounded in the period's data
- **Top time drains** — ranked bars
- **Buyback opportunities** — recommendation cards
- **Recent analyses** — history with the period each covered

**Recommendation card** carries: task, current time/week, estimated annual cost,
energy impact, recommended action (eliminate / automate / delegate / replace /
simplify / keep), **confidence with its signals shown**, implementation effort,
expected time reclaimed.

Actions: Accept · Edit · Reject · Snooze · Convert to task · Create playbook ·
Delegate · Automate · Ask a follow-up.

**Every card has an expandable "Why?" panel.** Never "AI says delegate this."
Instead: *"You spent ~4h/week on this over the last 14 days across 9 entries.
It's repetitive, requires limited strategic judgement, and you marked it
draining 8 of 9 times. Suggested: delegate data collection, keep final review."*

Confidence is computed from declared signals — sample size, frequency,
consistency of energy rating, duration variance, historical delegation success —
**not** a number the model invents. The signal breakdown is visible on hover.

**Buyback Plan Wizard `/app/plans/new`** — 5 steps:
1. Define task (title, current owner, current process, frequency, time spent)
2. Choose action (eliminate / automate / delegate / replace / simplify / keep)
3. Execution method (team member · AI agent · external automation · new process)
4. Success criteria (definition of done, quality checks, deadline, approval required)
5. Review & create → generates task(s), owner, due dates, optional playbook,
   approvals, and **the measurement method**

**Plan detail `/app/plans/:id`** — the accountability screen. Side-by-side
**Estimated vs Verified** hours reclaimed, the baseline it was measured against,
measurement window, confidence, and a timeline of the plan's lifecycle. This
screen is what makes the product honest.

## 8. Tasks `/app/tasks` · `/app/tasks/:id` **[MVP]**

List view: Task · Status · Owner · Priority · Source · Est. time · Actual time ·
Due · DRIP. Grouping (status/owner/quadrant), saved filters, board toggle.

Statuses: Inbox → Planned → In progress → Waiting → Review → Completed / Cancelled.

Detail: description, owner + collaborators, dates, estimated vs actual time with
variance, linked playbook / recommendation / plan, comments with @mentions,
attachments, full activity history. Actions: Assign · Delegate · Convert to
playbook · Ask AI · Complete · Duplicate · Archive.

## 9. Delegation Queue `/app/delegation` **[MVP]**

Five-column board, purpose-built for transferring work away:

**Needs decision** → **Ready to delegate** → **In progress** → **Needs review** → **Completed**

Card: task, assignee, due, estimated time, approval required, training status,
**intervention count** (how many times the founder had to step back in — the key
signal that a transfer hasn't actually completed).
Actions: Approve · Request changes · Reassign · View instructions.
Header strip: hours transferred this month, delegation cost at buyback rate, net.

## 10. Playbooks `/app/playbooks` **[MVP]**

- **Library** — cards: name, category, owner, step count, last updated, avg
  completion time, success rate, assignees, AI-generated badge. Filters + search.
- **Editor** — metadata panel (name, purpose, trigger, owner, backup owner,
  frequency, tools, inputs, outputs) + ordered drag-reorder step list. Each step:
  title, instructions (rich text), responsible person, estimated duration,
  required input, expected output, attachment, approval-required toggle,
  AI-assist toggle. Plus quality checklist and escalation rules. Draft/Published,
  autosave, version bump on publish.
- **AI generator** — "Describe how you currently do this task" → drafts title,
  objective, steps, tools, common mistakes, quality checklist, delegation notes.
  Lands in **draft**, diff-highlighted, requires human review before publish.
- **Reader** — clean read view for the person doing the work.
- **Runner** — step-by-step execution with checkboxes, per-step timer, notes,
  blockers, approval gates; on finish records duration, quality score, and
  produces a `playbookRun`.
- **Version history** — side-by-side diff, who changed what, restore.

## 11. AI Agents `/app/agents` (V2)

- **Library** — name, purpose, status, permission level badge, last run,
  success rate, tools, owner. Global kill switch in the header.
- **Builder** — name, purpose, system instructions, input/output format, allowed
  tools (each with explicit scopes), connected services, trigger (manual /
  schedule / event), max runs per day, failure behaviour, approval requirements,
  owner, success metric. **Permission level defaults to 1 (Suggest only)** and
  cannot be raised until a test has passed.
- **Test sandbox** — sample input → dry run → shows *proposed* output, the exact
  actions it would take, tools touched, estimated cost, and flagged risks.
  Approve · Edit instructions · Test again · Cancel. A stored passing test is a
  hard precondition for activation.
- **Run history / run detail** — start, end, input, step-by-step trace, tools
  used, output, errors, approval history, cost. Statuses: pending · running ·
  awaiting approval · completed · failed · cancelled.

## 12. Approvals `/app/approvals` (V2)

Unified inbox for everything awaiting a human: agent actions, delegated work
review, playbook publishes, plan approvals. Each row shows requester (person or
agent), action, risk level, a **preview of the exact payload**, and Approve /
Reject-with-reason. Bulk approve only for low-risk. Expiry visible.

## 13. Calendar & Focus `/app/calendar` (V2)

Week/day view overlaying meetings, scheduled tasks, focus blocks, delegation
deadlines. Overload detection (meeting density, no focus time, out-of-hours
work, context switching). Suggestions are **proposals with a confirm button** —
the app never moves a meeting on its own.

## 14. Weekly Review `/app/review` **[MVP]**

The habit loop. Time reclaimed (estimated vs verified), tasks delegated,
playbooks created, top time drain, biggest improvement, goal progress, and one
recommended next step. Actions: Accept next step · Schedule review · Dismiss ·
Open full report. Also delivered by email.

## 15. Analytics `/app/analytics` **[MVP, reduced]**

Hours tracked · hours reclaimed (est. vs verified) · avg reclaimed per week ·
delegated / automated / eliminated hours · time by DRIP quadrant over time ·
meeting load · delegation cost vs value · playbook adoption · agent success and
failure counts · intervention count · trends.

Team analytics show workload, completion, rework rate, and bottlenecks — framed
as **process diagnostics**. Deliberately no per-employee leaderboard or ranking.

## 16. Team `/app/team` (V2)

Members, roles, workload, invite (email + role + message + initial
tasks/playbooks), pending invites, permissions matrix, transfer ownership,
remove member.

## 17. Settings `/app/settings/*` **[MVP, partial]**

| Tab | Contents |
|---|---|
| Workspace | name, industry, timezone, working hours, currency, buyback rate, weekly goal |
| Account | name, email, password, avatar, timezone, notification preferences |
| AI | provider, model, data-retention, approval defaults, agent permission ceiling, monthly usage + spend cap |
| Integrations | connect/disconnect, granted scopes, last sync, re-auth |
| Security | active sessions, 2FA, audit log viewer, API keys, connected apps |
| Billing | plan, usage vs limits, invoices, payment method, cancel, export & delete |

## 18. Command Palette (`⌘K`) — global

Not a chatbot. A verb launcher: *Start timer · Add time entry · Create task ·
Show my time drains · Find tasks I should delegate · Create a playbook · Run
weekly review · Go to…* Fuzzy-searches tasks, playbooks, people, agents.

## 19. AI Assistant drawer — global

Workspace-aware, and it always ends in a **button, not a paragraph**:

> **"What's wasting most of my time?"**
> Over the last 14 days your largest recurring category is reporting and admin.
> `Reporting 8.2h` `Admin 6.5h` `Meetings 5.8h`
> I found 3 tasks that may suit delegation. **[Review 3 tasks →]**

The UX rule for every AI surface in the product:
**question → insight → recommendation → action button → execution → measurement.**
A response that ends without an action the user can take is a bug.
