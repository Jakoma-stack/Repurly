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
5. `docs/decision/Repurly_revised_launch_decision_memo.docx`
6. `docs/decision/Repurly_revised_go_no_go_checklist.docx`
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
2. Configure env vars from `.env.example`.
3. Run migrations and seed a local workspace.
4. Keep execution aligned to the premium LinkedIn-first story even though the adapter layer is broader.
