# E2E testing reference

Last reviewed: 2026-04-28

Repurly includes both Playwright and Cypress scaffolding so the repo carries lightweight smoke coverage without relying on ad hoc manual checks alone.

## Included files

- `playwright.config.ts`
- `tests/playwright/marketing-home.spec.ts`
- `cypress.config.ts`
- `cypress/e2e/marketing-home.cy.ts`
- `docs/LIVE_SITE_TEST_SCRIPT.md`

## Commands

- `npm run test:e2e:playwright`
- `npm run test:e2e:playwright:headed`
- `npm run test:e2e:playwright:install`
- `npm run test:e2e:cypress`
- `npm run test:e2e:cypress:open`
- `npm run test:e2e:cypress:install`

## Current automated scope

The included specs smoke-check the public marketing page and pricing story:

- premium LinkedIn positioning
- Starter / Operator / Studio plan names
- Starter at £79/mo
- Operator at £249/mo
- Studio from £699/mo
- no legacy low-price plan language on the homepage

That is deliberate. Authenticated workflow coverage should be added after dedicated preview/staging credentials exist for Clerk, Stripe, and LinkedIn.

## Required manual live scope

Use `docs/LIVE_SITE_TEST_SCRIPT.md` before inviting any real customer.

The manual live script covers:

1. public site and pricing
2. sign-up and checkout
3. billing portal
4. workspace setup
5. LinkedIn connection
6. text-only post creation
7. approval flow
8. schedule and publish
9. recovery/reconnect
10. tenant isolation

## Recommended next automated coverage

1. billing-plan gating around Starter and Operator
2. LinkedIn connection setup state
3. content studio save / request approval / schedule happy path
4. approval queue response flow
5. publish activity and retry actions
