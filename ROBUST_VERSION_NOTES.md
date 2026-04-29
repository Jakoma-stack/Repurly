# Repurly robust source package

This package is a cleaned source-of-truth copy prepared for GitHub and Render.

## What was removed

- `.git/` history from the ZIP handoff.
- `node_modules/` and generated build/test artefacts.
- Accidental empty command-output files: `cd`, `npm`, `rg`, `winget`, `11.12.1`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Duplicated root project/config files that had been copied into `src/`.
- Duplicate `src/docs`, `src/public`, `src/scripts`, and `src/drizzle` folders where root-level equivalents are canonical.

## Canonical project layout

- App source: `src/app`, `src/components`, `src/lib`, `src/server`, `src/types`, `src/emails`.
- Database schema and migrations: `drizzle/`.
- Operational scripts: `scripts/`.
- Docs and launch notes: `docs/` plus root commercial docs.
- E2E test wiring: `tests/playwright`, `cypress/`, `playwright.config.ts`, `cypress.config.ts`.

## Local verification

Run these before pushing:

```bash
npm ci
SKIP_ENV_VALIDATION=true npm run typecheck
SKIP_ENV_VALIDATION=true npm run lint
SKIP_ENV_VALIDATION=true npm run build
```

For real staging/production readiness, fill all required environment variables and run:

```bash
npm run commercial:check
npm run commercial:verify
```

Do not deploy with `SKIP_ENV_VALIDATION=true`.

## GitHub sync suggestion

After checking the app locally:

```bash
git add .
git commit -m "Use robust commercial source of truth"
git switch commercial-test-suite
git push origin commercial-test-suite
git switch main
git reset --hard commercial-test-suite
git push --force-with-lease origin main
```
