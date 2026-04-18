# E2E testing reference

Last reviewed: 2026-04-18

Repurly now includes both Playwright and Cypress scaffolding so the repo can carry lightweight smoke coverage without relying on ad hoc manual checks alone.

## Included files

- `playwright.config.ts`
- `tests/playwright/marketing-home.spec.ts`
- `cypress.config.ts`
- `cypress/e2e/marketing-home.cy.ts`

## Commands

- `npm run test:e2e:playwright`
- `npm run test:e2e:playwright:headed`
- `npm run test:e2e:playwright:install`
- `npm run test:e2e:cypress`
- `npm run test:e2e:cypress:open`
- `npm run test:e2e:cypress:install`

## Current scope

The included specs are smoke checks for the public marketing page.

That is deliberate. Authenticated workflow coverage should be added next with either:

- dedicated preview/staging credentials, or
- deterministic local fixtures for Clerk-authenticated workspace sessions

## Recommended next coverage

1. LinkedIn connection setup state
2. content studio save / request approval / schedule happy path
3. approval queue response flow
4. publish activity and retry actions
5. billing-plan gating around approval routing
