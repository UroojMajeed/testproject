# frontend — the app

React 18 · Vite · Bootstrap 5 · TanStack Query. Runs on **3000**.

## Structure

Feature-first, mirroring `backend/src/modules/` one to one.

```
src/features/<feature>/pages/       screens
src/features/<feature>/components/  parts only that feature uses
src/components/                     generic, domain-free UI only
src/lib/api/endpoints.js            one function per API endpoint
src/lib/api/hooks.js                TanStack Query wrappers
```

## Rules

1. **No `fetch` in a component.** Component → hook → `endpoints.js` →
   `apiClient`. One place to change when the API moves.
2. **Query keys come from `src/lib/queryKeys.js`.** Every key is prefixed by
   workspace, so switching workspace cannot show another tenant's cached data.
3. **Bootstrap is themed, not overridden.** Set Sass variables before the
   imports in `src/styles/custom.scss`. There is no `!important` in this
   codebase; keep it that way.
4. **Tokens live in `src/styles/_tokens.scss`.** Every colour there was checked
   for contrast. If you add one, check it — text needs 4.5:1, large text and UI
   marks need 3:1.
5. **Four states per screen**: loading (skeleton), empty (with a real action),
   error (with the message), loaded. Build the empty state first — in this
   product a new user's first week *is* the empty state.

## Accessibility is not a later pass

Real `<button>`, `<a href>`, `<input>` + `<label>` — never a `div` with
`onClick`, which Tab skips. `aria-invalid` drives error styling so the visual
and assistive-tech states cannot disagree. 44px minimum targets. Visible
focus ring. Charts carry a legend and a table view, because identity must never
be colour alone.

## The money rule

`formatMoney` takes **integer minor units**. `5000` is $50.00. If you find
yourself dividing by 100 anywhere else, that is the bug.
