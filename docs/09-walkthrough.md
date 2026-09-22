# ReclaimOS — a guided walkthrough

Written to be followed with the app open at http://localhost:3000. Every module,
what it is for, what to click, and the cases that are easy to trip over.

Seeded sign-in: `founder@reclaimos.test` / `reclaim-your-time-2026`

---

## First, the one idea everything serves

```
Audit  →  Decide  →  Transfer  →  Measure  →  repeat
```

Every screen is one station on that loop. If you ever lose your bearings, ask
which station you are standing on.

The loop's whole point is the last station. Plenty of tools will tell you where
your time went; this one is built to tell you whether the time **came back**,
measured from your own entries rather than asserted.

---

## The order to walk it, first time

1. Dashboard — what the seed data says about your fortnight
2. DRIP Matrix — where those hours sit, and what they cost
3. Advisor — what to do about the worst of it, and why
4. Accept one → Plan detail — the baseline freeze, and projected vs verified
5. Playbooks — draft one from the task, publish it
6. Delegation — the board the transfer moves across
7. Weekly Review — the loop closing
8. Time Audit — where the raw data lives
9. Settings — the buyback rate and the team

Then, separately, walk the **Sort** from scratch (§10) — that is the real new-user
path, and the seed data skips it.

---

## 1. Dashboard — `/app`

**For:** one screen, one decision. What has come back, what could, what needs you.

**Four stat cards.** The two on the left are the point:

- **Time reclaimed** — *verified* hours only. Empty right now, correctly: nothing
  has been transferred and measured yet.
- **Buyback potential** — hours the advisor has identified and nobody has acted
  on. Grey, labelled "identified, not yet actioned".

They never share a colour anywhere in this app. Teal means measured. Grey means
projected. That distinction is the product's spine.

**Next Best Action** appears once the advisor has run. It is the highest-priority
pending recommendation, with the reason it surfaced.

**The chart** is your fortnight stacked by DRIP quadrant. Hover a column for its
total; **Show figures** gives the same numbers as a table — because colour alone
should never be the only way to read a chart.

**What it costs** prices your draining hours at the buyback rate.

### Scenarios

| Situation | What you see |
|---|---|
| Fresh workspace, nothing tracked | The whole grid is replaced by "Let's find out where your week goes" and a link to the sort. Not zeroed tiles pretending to be data. |
| Tracked but never analysed | Stats fill in, no Next Best Action. Go to Advisor and run it. |
| A plan verified at *low* confidence | Time reclaimed stays at `—`. Deliberate: an untrustworthy measurement is not a measurement. |

---

## 2. DRIP Matrix — `/app/drip`

**For:** turning hours into a decision. Energy on the vertical, money on the
horizontal.

```
              Gives energy
                   ▲
   INVESTMENT      │      PRODUCTION
   learning, relationships │ sales, product, strategy
Less ──────────────┼────────────────── More
money              │                   money
   DELEGATION      │      REPLACEMENT
   admin, data entry │ work you are good at but dislike
                   ▼
              Drains energy
```

Each corner shows its own **hours and cost per week**. That is the line that
makes people act — "$390 a week in Delegation" lands differently from "7.8 hours
of admin".

**Click any dot** for its detail: hours, cost, occurrences, and who classified
it. **Move it** with the Energy and Value buttons.

### Scenarios

| Situation | What happens |
|---|---|
| You move a task by hand | Stored as `drip.source = 'user'`. Re-deriving from entries will never overwrite it again. A human always outranks the derivation. |
| A task appears in the wrong quadrant | That is the feature, not a bug — move it. The derivation takes the most common energy and value across your entries, and it can be wrong. |
| Nothing plotted | Needs at least one recurring task with logged time. Sort a week, or add entries. |
| Two tasks overlap on the plot | They share an energy/value pair. Hover to separate them; the label appears on the active one. |

---

## 3. Advisor — `/app/advisor`

**For:** what to buy back next, and the evidence for it.

Press **Re-run analysis** and it works through every task with two or more
occurrences.

Each card carries the action (eliminate / automate / delegate / replace /
simplify), the quadrant, and a confidence level. Then four figures: what it costs
weekly, what is *projected* back, setup effort, annual opportunity.

**Open "Why you are seeing this."** This is the part worth studying:

- the grounded sentence — occurrences, hours, how often you marked it draining
- **evidence chips** — the raw facts that sentence came from
- **five confidence signals** with their weights: sample size, frequency, energy
  consistency, duration variance, weekly volume

Confidence is **computed** from those five signals, server-side. Nothing asserts
it. The same inputs always give the same score, which is why the number can be
trusted and why you can argue with it.

### Why it picks what it picks

| Situation | Action | Reasoning |
|---|---|---|
| Delegation quadrant, repeats, consistent length | **Automate** | Low variance is what rule-shaped work looks like |
| Delegation quadrant, length varies a lot | **Delegate** | Variance means judgement, and judgement needs a person |
| Replacement quadrant | **Delegate** | Valuable *and* draining — transfer the doing, keep the review |
| Low-value meeting, recurring, draining | **Eliminate** | The cheapest hours in the week to reclaim |
| Draining, frequent, inconsistent | **Simplify** | Tighten it before handing it to anyone |
| Production or Investment | **Keep** — never shown | The queue is for things to act on |

### Scenarios

| Situation | What happens |
|---|---|
| Nothing recommended | Nothing recurs twice yet. Sort another week. |
| You **reject** with a reason | That task is excluded from future analyses. Re-running will not resurrect it. |
| You **snooze** | Excluded for 28 days, then eligible again. |
| You re-run after accepting some | Only the *pending* queue is rebuilt. Decisions you already made are untouched. |
| You disagree with the action | Reject it, or change the task's quadrant in the matrix and re-run. The engine follows your classification. |

---

## 4. Buyback Plan — `/app/plans/:id`

**For:** the honest bit. Did the time actually come back?

Accepting a recommendation creates a plan in **draft** and brings you here.

**Projected vs Verified** sit side by side and look nothing alike — projected in a
dashed grey panel, verified in solid teal with its measurement window, sample
size and coverage beside it.

### The baseline freeze

**Approve and freeze the baseline** measures what the task costs you *today*,
from the last 14 days of your entries, and makes that number immutable.

This is the most important mechanic in the product. A baseline captured after the
work has already moved measures nothing — so approval is the moment it is taken,
and nothing can edit it afterwards.

### Scenarios

| Situation | What happens |
|---|---|
| Approving with no logged time for that task | **Refused**, with "there is no logged time for this task in the last 14 days, so there is nothing to measure against." |
| Trying to edit the frozen estimate via the API | **422.** The estimate sub-document is stripped from any update. |
| Verifying immediately | Runs, reports **low** confidence — under two weeks of data is not a measurement. |
| You stopped logging after the transfer | Coverage ratio drops below 0.6, confidence caps at low, and a plain-language warning appears. A gap in your entries would otherwise read as zero minutes and report a *larger* saving than really happened. |
| Two plans for one task | **Conflict.** One active plan per task. |
| Marking work started before approval | **Conflict.** A plan must be approved — and therefore have a baseline — first. |

That coverage guard is the difference between a tool that flatters you and one
you can rely on.

---

## 5. Playbooks — `/app/playbooks`

**For:** the thing that makes a transfer stick. A process someone else can run.

From a plan, **Draft a playbook from this task**. The skeleton is derived from
real data — the task's frequency, average duration, category — and the step
wording is deliberately marked `[Replace this]`. It lands in **draft**; a human
publishes.

The editor holds metadata on the left and drag-ordered steps on the right, each
with instructions, minutes and an approval flag.

### Scenarios

| Situation | What happens |
|---|---|
| Publishing with no steps | **Refused.** "A playbook needs at least one step." |
| Publishing an already-published playbook | Version bumps: v1 → v2. History is kept. |
| Running a draft | **Refused.** Only a published playbook can be run. |
| A playbook untouched for 60 days | Flagged on the library page. Stale instructions are how a transfer quietly comes back to you. |
| Run stats look wrong | They come from completed runs only — duration, quality score, count. |

---

## 6. Delegation Queue — `/app/delegation`

**For:** watching work actually move off your plate. Five columns, because a
transfer has five real states.

```
Needs decision → Ready to delegate → In progress → Needs review → Verified
```

**Needs decision comes first on purpose.** Work stalls far more often for want of
an owner than for want of effort.

The header strip shows verified hours back, projected, and plan counts.

**Step-ins** on a card count how many times you had to take the work back. That
is the signal a transfer has not really completed, whatever the column says.

### Scenarios

| Situation | What it means |
|---|---|
| Everything sits in Needs decision | Recommendations accepted, no owners chosen. The bottleneck is a decision, not capacity. |
| A card in Verified with high step-ins | It measured as a saving but cost you interruptions. Worth revisiting the playbook. |
| Empty board | Nothing accepted yet. Start at the Advisor. |

---

## 7. Weekly Review — `/app/review`

**For:** closing the loop, and the habit that keeps the product alive.

It leads with where the hours **went**, not just how many came back. Reclaiming
four hours into inbox is a failure, and the review says so.

The projected-vs-verified chart shows every active plan together — including ones
honestly marked *"not yet measurable — 1 week of data"* rather than shown as zero.

Then one recommended next step, which hands straight back to the Advisor.

### Scenarios

| Situation | What you see |
|---|---|
| Nothing tracked this week | Empty state with a link to the sort. |
| A plan under two weeks old | "Not yet measurable", with the week count. Not a zero. |
| Tracked more than last week | The delta is named explicitly — more tracking is not automatically progress. |

---

## 8. Time Audit — `/app/audit`

**For:** the raw entries everything else is computed from.

Add an entry with title, date, minutes, category, energy and value. Entries are
grouped by day with the day's total.

Each entry shows its quadrant, and a **precision badge** when it is not a timed
measurement — `recalled` or `from calendar`. A sorted group is a coarser estimate
than a stopwatch, and the data says which it is rather than pretending they are
the same.

### Scenarios

| Situation | What happens |
|---|---|
| You add an entry with a new title | A task is created for it, fingerprinted. Nine wordings of the same work collapse into one recurring task. |
| You add one matching an existing task | It joins that task and updates its rollups. |
| You delete an entry | Day metrics and task rollups recompute immediately. |
| You edit someone else's entry | **Forbidden.** Members own their own time. |
| Cost per entry looks stale after a rate change | Correct. Cost is frozen at write time — changing your rate in March must not rewrite February's audit. |

---

## 9. Settings — `/app/settings`

**For:** the buyback rate, the weekly goal, and the team.

The **buyback rate** is annual compensation ÷ annual working hours. It is labelled
a planning estimate everywhere it appears — a figure for comparing options, never
a wage and never a valuation.

### Scenarios

| Situation | What happens |
|---|---|
| You change the rate | Future entries use it. Past entries keep the cost they were written with. |
| A manager opens Settings | Rate and goal are read-only. Team invitations still work. |
| You invite someone | The invite token is issued server-side and never shown in the response. Email delivery is not built yet. |
| Sign out | Revokes the refresh token on the server, not just locally. |

---

## 10. The Sort — `/sort`

**The real new-user path, which the seed data skips.** Worth walking once.

Sign out, register a fresh account, finish the three onboarding steps, and you
land here.

List what you did last week — roughly is fine — with minutes and how many times.
The server groups the repeats by fingerprint, so ~30 occurrences become ~12
groups. **That collapse is what turns a two-week audit into a ten-minute sitting.**

Then two questions per group, keyboard-driven: `D`/`N`/`E` for energy, `1`–`4` for
value, Enter to advance. The matrix fills in live beside you with a running cost.

At the end: one number, what it cost, the matrix you just built, and one
recommendation.

### Scenarios

| Situation | What happens |
|---|---|
| Starting a second sort while one runs | **Conflict.** Finish or abandon the first. |
| Classifying a group twice | **Conflict.** Each group is decided once. |
| Classifying one group | Writes one time entry per occurrence, marked `precision: recalled`. |
| Skipping a group | Counted as skipped, no entries written. Use it for anything that is not work. |
| Reloading mid-sort | Resumes where you were. Progress lives on the server. |

---

## Who can do what

| Action | Owner | Manager | Member |
|---|:--:|:--:|:--:|
| Track own time, view matrix and advisor | ✔ | ✔ | ✔ |
| Read and run published playbooks | ✔ | ✔ | ✔ |
| Run the analysis, accept/reject/snooze | ✔ | ✔ | |
| Create, approve, update a plan | ✔ | ✔ | |
| Publish a playbook | ✔ | ✔ | |
| See the delegation queue | ✔ | ✔ | |
| Invite people | ✔ | ✔ | |
| Workspace settings and the buyback rate | ✔ | | |

A member who tries a manager action gets a 403 with the role named. The UI hides
what it can, but the server is the authority — never the other way round.

---

## What is deliberately not built

| | Why it matters to you |
|---|---|
| Calendar sync (Google, Outlook) | The sort takes manual recall instead. Everything downstream is identical; only the input differs. |
| Email delivery | Invite and reset tokens are issued and hashed, never mailed. |
| AI agents | Phase 11. Agents default to suggest-only and need a passing test before activation. |
| Billing | Not started. |

---

## When something looks wrong

1. **Is it the data or the code?** Check the Time Audit first — most surprises
   upstream are an entry with the wrong energy or value.
2. **404 or 422 from a screen?** `frontend/src/lib/api/endpoints.js` against
   `backend/src/routes.js`. When those two disagree, both sides can pass their own
   tests and the app still breaks.
3. **Mongo will not connect?** `npm run db:check`.
4. **Is it really broken?** `npm run verify` — 207 backend tests, 34 frontend.
