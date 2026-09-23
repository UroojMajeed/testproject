# ReclaimOS

Built one agreed step at a time. **Step 1 is authentication** — sign up, sign in,
sign out, session refresh and password reset. Nothing else exists yet.

```
testproject/
├── backend/     the API.  Node + Express + MongoDB   → http://localhost:5000
├── frontend/    the app.  React + Vite + Bootstrap   → http://localhost:3000
└── CLAUDE.md    the working agreement both are built to
```

## First time

```bash
npm run install:all          # installs both projects
cp backend/.env.example backend/.env
```

Then fill in `backend/.env`. Three values matter:

| Variable | What to put |
| --- | --- |
| `MONGODB_URI` | Your Atlas driver string, or `mongodb://127.0.0.1:27017/reclaimos` |
| `JWT_ACCESS_SECRET` | 48 random bytes — see below |
| `JWT_REFRESH_SECRET` | 48 more, **different** from the first |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The server validates all of this at boot and refuses to start if something is
missing or malformed, so a typo fails immediately rather than at 3am.

Check the database before anything else:

```bash
npm run db:check
```

That connects, reports what it found, and names the specific problem when it
cannot — a wrong password, a DNS failure on the SRV lookup, an IP that is not on
the Atlas allowlist. It masks the connection string, so its output is safe to
paste when asking for help.

## Running it

Two terminals, on purpose — the two halves restart independently.

```bash
npm run dev:backend     # terminal 1 → http://localhost:5000
npm run dev:frontend    # terminal 2 → http://localhost:3000
```

Open **http://localhost:3000**. Sign up, and you land on the signed-in page.

Vite proxies `/api` to port 5000, which keeps the browser same-origin in
development so the refresh cookie behaves exactly as it will in production. If
port 3000 is taken, Vite fails rather than moving to 3001 — sliding ports would
break the Origin check on the auth routes with no obvious cause.

## Before saying a change is done

```bash
npm run verify              # lint + 222 unit tests + production build
npm run test:integration    # backend only; needs a running mongod
```

The integration suite spins up an in-memory MongoDB, or uses a live one if you
set `MONGODB_TEST_URI`. Point it at a throwaway database — it drops the database
when it finishes.

## Useful to know

- **`npm run db:reset`** empties the database. It refuses to run in production,
  prints what it is about to destroy, and needs `-- --yes` to go ahead.
- **The access token never touches browser storage.** It lives in memory, and a
  reload re-obtains one from the httpOnly refresh cookie. There is an eslint rule
  and a test enforcing that.
- **`frontend/src/lib/api/endpoints.js`** is the client's view of the API. When
  something 404s or 422s, read it next to `backend/src/routes.js` — one of the two
  has drifted.
