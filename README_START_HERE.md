# Repurly unified workspace

This folder is designed to work as the main working repo for both GitHub execution and ChatGPT-assisted review.

## How the pieces fit together

- the **repo root** is the working Next.js codebase
- `docs/` contains architecture, launch, provider, execution, and decision materials
- `docs/decision/` contains the latest decision memo and go/no-go checkpoint files
- `docs/qa/` contains repo-level QA reviews and follow-up notes

## Current external positioning

Repurly should currently be presented as:

**A premium LinkedIn-first content operations platform for agencies and B2B teams**

Not as:

- a cheap scheduler
- a broad all-network social suite
- a mini-Sprout clone

## Current product truth

The codebase already supports a real premium LinkedIn workflow, but the product story must stay tightly aligned to what is actually wired today.

### Safe claims

- LinkedIn is the primary launch channel
- teams can connect a personal profile and, when permissions allow, company pages
- teams can draft, request approval, approve/reject/request changes, schedule, queue, and publish content
- workspaces, brands, roles, billing, and reliability views are present
- engagement is **manual-first** today, not a full synced inbox
- the planner is grounded in stored brand context and supplied source material
- queue and activity screens support operator visibility, but the richest delivery forensics are still being completed

### Claims to avoid until they are fully true in product

- advanced multi-step approvals beyond the current single-step response loop
- full synced social inbox
- social listening
- deep cross-channel analytics
- a drag-and-drop calendar planner
- true website crawling / website grounding

## Best way to use this folder

### For GitHub
Use the **repo root** as your repository. Commit:
- application code
- `docs/`
- `.gitignore`
- `.env.example`

Do not commit secrets or temporary local files.

### For a new review or implementation pass
Start with these files:
1. `README.md`
2. `docs/architecture.md`
3. `docs/platform-status-matrix.md`
4. `docs/environment-reference.md`
5. `docs/product-surface-reference.md`
6. `docs/product-market-assessment-2026-04-18.md`
7. `docs/qa/deep-dive-qa-2026-04-15.md`

## Recommended operating stance
- keep the workflow scope narrow and premium
- prioritize workflow completion over more channels
- treat LinkedIn as the hero channel
- optimize for paid subscriptions, not feature breadth
- treat the richer delivery-logs build as the architecture base
- avoid drifting into a mini-Sprout strategy

## Key folders

- `docs/decision/` — latest decision memo and go/no-go checklist
- `docs/project-management/` — board, gates, and execution scaffolding
- `docs/build-decisions/` — build-level decision notes
- `docs/providers/` — provider-specific setup and rollout notes
- `docs/qa/` — QA findings, repo drift, and corrective actions
- `docs/archive-source/` — earlier memo and plan docs

## First actions
1. Review `README.md` and `docs/platform-status-matrix.md` together.
2. Review `docs/product-surface-reference.md` before changing marketing or pricing copy.
3. Configure env vars from `.env.example`.
4. Run migrations and seed a local workspace.
5. Keep execution aligned to the premium LinkedIn-first story even though the adapter layer is broader.
## E2E testing now wired in

The repo now includes both Playwright and Cypress scaffolding for smoke coverage against the marketing surface.

Useful commands:
- `npm run test:e2e:playwright`
- `npm run test:e2e:cypress`
- `npm run test:e2e:playwright:install`
- `npm run test:e2e:cypress:install`

