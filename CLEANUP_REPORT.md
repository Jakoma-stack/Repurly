# Repurly robust cleanup report

Prepared from the uploaded `Repurly.zip`.

## Result

This is a cleaned source package intended for GitHub branches `main` and `commercial-test-suite`.

## Removed from the handoff

- `.git/` repository history
- `node_modules/`
- Generated build/test artefacts
- Duplicate root project files inside `src/`
- Duplicate `src/docs`, `src/public`, `src/scripts`, and `src/drizzle` folders
- Accidental command-output files

## Preserved

- Next.js app source under `src/app`
- Reusable UI/components under `src/components`
- Business/server logic under `src/lib` and `src/server`
- Email templates under `src/emails`
- Database schema and migrations under `drizzle`
- Operational scripts under `scripts`
- Playwright and Cypress test wiring
- Render deployment configuration
- Commercial readiness documentation

## Verification performed during package preparation

- Confirmed expected root files are present.
- Confirmed `.git`, `node_modules`, build artefacts, and duplicate project config files under `src` are absent from this ZIP.
- Dependency install/build was not completed inside the packaging container because `npm ci` did not finish within the execution window. Run the verification commands locally before pushing.

## Recommended local verification

```bash
npm ci
SKIP_ENV_VALIDATION=true npm run typecheck
SKIP_ENV_VALIDATION=true npm run lint
SKIP_ENV_VALIDATION=true npm run build
```

Then with real staging/production env values:

```bash
npm run commercial:check
npm run commercial:verify
```
