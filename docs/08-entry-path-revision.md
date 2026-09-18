# ReclaimOS — Entry Path Revision

> Supersedes the onboarding and first-run behaviour in `03-ui-screens.md` §3 and
> the phase order in `07-build-order.md`. The loop, the data model and the
> verification mechanism are unchanged.

## The problem

As originally specified, the product asks for **fourteen days of manual timer
tracking before it delivers anything**. The spec's own validation targets
concede the cost: 60% complete onboarding, 40% complete a first audit, 25%
approve a recommendation, 20% transfer a task. Four in five signups never reach
the moment the product does its job.

Manual time tracking has a poor retention record even where tracking *is* the
product. Here it is a tax paid up front, for a payoff two weeks away. And
competitors already automate the hardest part — Timely captures work without a
timer at all.

Two secondary failures compound it:

- **The no-team dead end.** Every path ends at "assign it to someone". A solo
  founder or a three-person agency often has nobody to assign to, and the
  product stops.
- **Verification decay.** The measurement window needs the founder to keep
  logging their *reduced* involvement. Once the pain is gone, so is the
  motivation — and a missing log reads as zero, which **overstates** the saving.
  The exact failure the design exists to prevent.

## The change

**Calendar import becomes the front door; the timer becomes optional
enrichment.**

| | As specified | Calendar first |
|---|---|---|
| Time to first value | 14 days | 10 minutes |
| Sessions before value | ~15 | 1 |
| Steps before payoff | ~20 | 4 |
| Works with no team | No | Yes |

### Onboarding: 6 steps → 3

1. Create workspace
2. Buyback goal **and** rate (merged — same mental frame)
3. **Connect calendar** — the whole screen, not a skippable option at step 5

Then straight into the sort. The manual path survives as a link for people with
no calendar ("walk through last week from memory, about 6 minutes").

### The Sort — the screen that replaces the fourteen days

The unlock is **groups, not events**. ~32 calendar events collapse into ~12
recurring groups using the `fingerprint` the schema already needed, so one
classification covers five meetings. That is what makes a two-week chore a
ten-minute sitting.

Per group, two questions, keyboard-driven, 78px targets:
energy (draining / neutral / energising), then value (low / medium / high /
strategic). The matrix fills live in the right rail with a running cost, so the
payoff is visible *while they work*, not only at the end. Progress and time
remaining are always on screen — an unbounded queue is a quit.

### First Look — minute 10

One number in the first sentence, then its cost, then the matrix they just built
themselves (which is why they believe it), then one recommendation.

The recommendation offers **three routes, with automate first**:

- **Automate it** — rule-based, no team needed
- **Hand it to someone** — and when there is nobody, the output is a **job spec
  plus a ready playbook** for a VA marketplace, not a dead end
- **Keep it, for now** — schedules a re-ask in four weeks, not a dismissal

Closing line sells session two: next week's sort is ~3 minutes, because only
unseen groups are asked about.

## Schema deltas

Small. The model was already close.

```js
// calendarEvents  — gains grouping, so the sort works on groups
groupFingerprint: String,      // normalised title hash, shared with tasks.fingerprint
groupId:          ObjectId,    // the sortGroup this event was folded into

// NEW: sortGroups  — one row per group presented in a sort session
{ _id, workspaceId, userId, sessionId, fingerprint, title,
  eventIds: [ObjectId], eventCount, totalMinutes, occurrencePattern,
  energy, value, dripQuadrant, decidedAt, skipped: Boolean }

// NEW: sortSessions — so "we only ask about groups we have not seen"
{ _id, workspaceId, userId, periodStart, periodEnd,
  source: 'calendar' | 'recall',
  groupCount, classifiedCount, skippedCount,
  startedAt, completedAt, durationSeconds,      // the activation metric
  status: 'in_progress' | 'completed' | 'abandoned' }

// timeEntries — gains a provenance level, since sorted groups are coarser
precision: 'timed' | 'calendar_sorted' | 'recalled'

// buybackPlans.verification — closes the decay hole
coverage: {
  expectedLogDays: Number,     // working days in the measurement window
  actualLogDays:   Number,     // days with any entry from this user
  ratio:           Number      // below 0.6 → confidence capped at 'low'
}
```

**`precision` matters**: a `calendar_sorted` entry is a coarser estimate than a
`timed` one, and analytics should say so rather than pretending they are the
same measurement.

**`coverage` is the verification-decay fix**: if the founder stopped logging
during the measurement window, the saving is not reported as high-confidence —
and the Weekly Review asks them to confirm their current time on the task rather
than silently reading zero.

## Revised build order

| Phase | Scope | Exit criterion |
|---|---|---|
| 0 | Repo, workspaces, CI, shared Zod, design tokens | `npm run dev` boots |
| 1 | Auth, workspaces, memberships, tenant guard, RBAC, shell | Sign up → empty dashboard |
| 2 | **Google Calendar read + event cache + grouping** | 32 events become ~12 groups |
| 3 | **The Sort + First Look** | A stranger sees their matrix and cost in under 12 minutes |
| 4 | Recommendations with evidence + computed confidence | One recommendation they can explain back to you |
| 5 | Three routes: automate / hand off (job spec + playbook) / keep | A founder with no team still gets an outcome |
| 6 | Buyback plans, baseline capture, verification + coverage | Dashboard shows verified hours. **MVP complete** |
| 7 | Timer + manual entries (optional precision) | — |
| 8 | Playbooks proper, delegation queue, weekly review | — |
| 9+ | Analytics, team, notifications, billing, AI agents | — |

Two changes from the original order beyond the entry path: **playbooks move out
of the MVP** (they make a transfer stick, but they are not what proves the
product works), and **the timer moves after the sort** — it is enrichment, not
the gate.

## What this costs

The first classification is coarser than two weeks of timed entries would be.
That is the trade, and it is the right one: a rough matrix a founder actually
sees beats a precise one they never reach. `precision` keeps the distinction
honest in the data, and the timer is still there for anyone who wants per-task
accuracy.

## What to measure

The percentages above are targets and hypotheses, not forecasts. The honest
next step is five real founders through the ten-minute sort, watching where they
stall. The one metric that matters:

**% of signups who see their DRIP matrix in their first session** — and
`sortSessions.durationSeconds` for the ones who do.
