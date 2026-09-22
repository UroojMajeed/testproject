# backend — the API

Node 20 · Express · Mongoose · Zod · Vitest. Runs on **5000**.

## Layering — do not skip a layer

```
route → validate → controller → service → model
```

- **Controllers** touch `req`/`res` and nothing else. No Mongoose, no rules.
- **Services** hold the logic and take `workspaceId` as an explicit argument.
  They never read `req`.
- **Models** are schemas plus query helpers.
- **Serializers** shape every response. Nothing reaches a client without one.

Adding a domain concept means adding one folder under `src/modules/`, not
editing seven shared files.

## Where things live

| Need | File |
|---|---|
| A new enum | `src/config/constants.js` (mirror it in the frontend) |
| A new env var | `src/config/env.js` — Zod-validated, crashes at boot if missing |
| Recommendation logic | `src/services/recommendations.engine.js` |
| Wording of a recommendation | `src/services/narrator.js` |
| Grouping / recurrence | `src/services/fingerprint.js` |
| Dashboard aggregates | `src/services/metrics.service.js` |
| Verification arithmetic | `src/modules/plans/plan.service.js` → `computeVerification` |

## Route order matters

Express matches in registration order, so a literal path must come **before** a
parameterised one. `/tasks/queue/delegation` has to be registered above
`/tasks/:id` or `:id` swallows the word "queue". `tests/unit/routes.test.js`
asserts this — it caught the bug once already.

## Diagnosing a connection

`npm run db:check` is the first thing to run when Mongo will not connect. It
distinguishes the four real causes — DNS/SRV, credentials, IP allowlist,
unresolvable host — instead of leaving a driver stack trace to interpret. Its
`diagnose` function is exported and unit-tested per branch; add a branch there
rather than teaching people to read stack traces.

## Tests

- `npm test` — unit tests, no database, run anywhere
- `npm run test:integration` — needs a live mongod, covers the full loop

Put pure logic in `src/services/` so it can be unit-tested without a database.
That is why `computeVerification` is a standalone function.

## Auth rules

Access token 15 min, refresh 7 days in an httpOnly cookie, rotation with reuse
detection. Refresh and reset tokens are stored SHA-256 hashed. Wrong-password
and no-such-user return byte-identical responses, including a dummy bcrypt
compare so timing does not distinguish them. Do not soften any of this for
convenience.
