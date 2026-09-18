# ReclaimOS — AI Layer

## The pipeline (non-negotiable)

```
User action
   ↓
Backend builds context from the DATABASE (never from user free-text alone)
   ↓
Versioned prompt  +  required JSON output schema
   ↓
LLM
   ↓
Zod validation  ── invalid ──► retry once ──► fail loudly. never guess
   ↓
Permission layer  (role? agent level? tool scope? approval needed?)
   ↓
Action executed by normal service code
   ↓
Audit log
```

The model returns **intent**. The backend decides whether that intent is
permitted and performs it. The model never holds a database handle, never holds
a token, and never calls an integration directly.

## AI functions

| Function | Input | Output | Prompt |
|---|---|---|---|
| Time audit analysis | aggregated entries for a period | patterns, drains, summary | `timeAudit.v1` |
| DRIP classification | task + entries + energy/value history | suggested quadrant + reason | `dripClassify.v1` |
| Buyback recommendations | audit + goals + buyback rate + team capacity | ranked actions + reasons | `recommendations.v1` |
| Playbook drafting | user description or task history | structured procedure | `playbookDraft.v1` |
| Playbook improvement | existing playbook + run data | suggested revisions (diff) | `playbookImprove.v1` |
| Weekly review | week metrics | summary + next step | `weeklyReview.v1` |
| Agent execution | approved inputs + tool results | structured result | `agentExecutor.v1` |
| Assistant | question + workspace context | insight + **action list** | `assistant.v1` |

Prompts are **versioned files, never edited in place**. Every `aiAnalysis` row
stores `promptVersion`, so a regression is traceable to a specific change.

## Automation vs. delegation decision

For `POST /ai/generate-recommendations`, the model is given these structured
signals and must weigh them explicitly in its reasoning:

repetition count · rule-based vs. judgement · exception rate · data sensitivity ·
current team capacity · estimated implementation cost · ongoing maintenance ·
required quality and approval level · estimated time saved

Required output shape:

```json
{
  "recommendation": "delegate",
  "reason": "Occurs ~40×/month, rule-based, low exception rate, marked draining 8 of 9 times.",
  "evidence": [
    { "signal": "frequency",  "label": "occurrences (14d)", "value": 9 },
    { "signal": "duration",   "label": "hours/week",        "value": 4.1 },
    { "signal": "energy",     "label": "draining ratio",    "value": 0.89 }
  ],
  "estimatedHoursSavedPerWeek": 3,
  "implementationEffortMinutes": 120,
  "nextStep": "Review an automated reminder workflow"
}
```

Note what is absent: no `confidence` number. **Confidence is computed
server-side** from sample size, frequency, energy-rating consistency, duration
variance, and historical delegation outcomes. A model-asserted confidence is
not evidence of anything.

Phrasing rules enforced in the prompt and checked in review:
- "appears repetitive", "estimated", "pending validation" — never "will save you 4 hours"
- never assert a task is *safe* to automate without its requirements reviewed
- savings are always labelled **projected** until `buybackPlans.verification` exists

## Guardrails

**AI may:** analyse, recommend, draft, classify, plan, prepare playbooks.

**AI may never, at any permission level:** move money · delete business data ·
change permissions · invite users · publish externally · send email outside the
workspace · make irreversible changes.

Runtime controls: per-workspace monthly spend cap · per-run cost cap · retry
limits · timeouts · a global kill switch per agent and per workspace · every
live action in `auditLogs` · every high-risk action through `approvals` with the
exact payload shown to the approver before execution.

## Cost control

Aggregate before prompting — send "9 entries, 4.1h, category=admin, draining 8/9",
not 9 raw documents. Cache classifications by `task.fingerprint`. Run heavy
analyses on a schedule via BullMQ, not on page load. Meter every call into
`aiAnalyses.costMinor` and `subscriptions.usage`, and enforce the cap before the
call, not after.
