# Verification report

## What the latest uploaded `Repurly.zip` contained
Verified from the uploaded archive in this session:
- homepage branding files (`index.html`, `brand.css`, `assets/*`)
- docs and migrations
- no complete app feature merge for the requested operator/reporting/team-flow changes

The uploaded archive did **not** already contain these requested additions:
- workspace invite flow and accept page
- operator controls using `feature_flags`
- support snapshot in Settings
- reports page
- clear queued posts action wired into Calendar
- scheduling guard for paused publishing
- scheduling guard for past dates
- LinkedIn per-day overload guard
- improved provider retry guidance for LinkedIn day-limit throttles and token issues

## What was added into this merged build
### Team invites and role flow
- `drizzle/schema.ts` -> `workspaceInvites`
- `drizzle/migrations/0002_team_invites_ops.sql`
- `src/server/actions/settings.ts`
- `src/server/queries/settings.ts`
- `src/app/accept-invite/page.tsx`
- `src/app/app/settings/page.tsx`

### Operator controls and support snapshot
- `src/lib/ops/feature-flags.ts`
- `src/server/actions/settings.ts`
- `src/server/queries/settings.ts`
- `src/app/app/settings/page.tsx`

### Publish resilience and recovery
- `src/server/actions/workflow.ts`
- `src/app/app/calendar/page.tsx`
- `src/lib/notifications/retry-guidance.ts`

### Operational reporting
- `src/server/queries/reports.ts`
- `src/app/app/reports/page.tsx`
- `src/components/layout/app-shell.tsx`

### Onboarding and signed-in UX polish
- `src/app/app/page.tsx`
- `src/components/layout/app-shell.tsx`

### Branding and public-facing polish
- `index.html`
- `brand.css`
- `app-shell-brand-tokens.css`
- `assets/repurly-logo.png`
- `assets/jakoma-logo.jpg`

## Validation note
This environment does not contain a working project-local dependency install for full repo validation. The repo's own `npm run typecheck` fails because `./node_modules/typescript/bin/tsc` is missing from the uploaded bundle, and global `tsc` reports broad missing-module errors from the incomplete dependency state.

Because of that, this merged build should be treated as a **staging-first** package, not a blindly production-deployed one.

## Minimum staging checks
1. Homepage loads and CTAs go to `https://app.repurly.org/sign-in` and `https://app.repurly.org/sign-up`
2. Settings -> Operator controls toggles save
3. Settings -> Team invite can be created and revoked
4. `/accept-invite?token=...` renders and accepts only matching email
5. Reports page loads
6. Calendar -> Clear queued posts works
7. Scheduling while publishing is paused shows the expected block
8. Scheduling a LinkedIn-heavy day triggers the overload guard
9. Failed LinkedIn 429 items show the improved retry guidance
