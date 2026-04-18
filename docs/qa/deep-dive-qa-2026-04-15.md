# Deep dive QA review — 2026-04-15

## Scope reviewed

- repo structure and product docs
- environment/config alignment
- TypeScript and ESLint health
- platform posture vs implementation claims
- launch/readiness narrative consistency

## What passed cleanly

- `npm run typecheck`
- `npm run lint`
- overall schema, route, and adapter structure is coherent
- LinkedIn-first product wedge is consistently reflected in the main product UX
- adapter registry, publish orchestration, delivery logs, and retry posture show real technical progress beyond a single-channel prototype

## High-value findings

### 1. `.env.example` was materially out of sync with the live code

Before this QA pass, the example env file still referenced older and/or non-authoritative variables such as Better Auth, `FROM_EMAIL`, Upstash Redis, blob storage, and feature flags that are not the main configuration model of the current app.

Impact:
- slows setup
- increases risk of broken local runs
- reduces trust in repo documentation

Action taken:
- rewrote `.env.example` to reflect the current Clerk + Stripe + Postgres + Resend + S3 + Inngest build
- added missing active variables such as `EMAIL_FROM`, Stripe price IDs, alerts, and provider redirect settings

### 2. Starter repo guidance pointed to a missing `_chatgpt/` folder

`README_START_HERE.md` referred to an `_chatgpt/` directory that is not present in this package.

Impact:
- creates immediate confusion for anyone opening the repo cold
- makes the package feel partially consolidated

Action taken:
- rewrote `README_START_HERE.md` so it points to files that actually exist

### 3. Docs needed a clearer distinction between “technical progress” and “launch-ready”

The codebase now contains more than a single LinkedIn implementation, but the safest product posture remains LinkedIn-first.

Impact:
- without clear wording, readers can either understate the repo’s progress or overstate launch readiness for secondary providers

Action taken:
- updated `README.md`, `docs/architecture.md`, and `docs/platform-status-matrix.md`
- introduced clearer terms: launch path, implemented path, scaffolded

### 4. Environment documentation was scattered

Impact:
- setup knowledge was spread across README, provider docs, and code
- operator onboarding required too much inference

Action taken:
- added `docs/environment-reference.md` as a fast source of truth

## Remaining issues worth addressing next

### Code / configuration
- `src/lib/env/index.ts` is not currently imported anywhere, so it is not acting as an enforced runtime contract.
- `src/lib/env/index.ts` also omits some variables used elsewhere in code, especially Instagram-specific env vars.
- `src/lib/app-url.ts` still includes legacy Better Auth fallback names. That is harmless for compatibility, but it can confuse future cleanup unless explicitly treated as legacy compatibility.

### Build verification
- full production-build verification was less conclusive than lint/typecheck in this environment. The repo began the Next.js production build, but the container session did not provide a clean final completion signal during this QA pass.
- treat `typecheck + lint` as confirmed, and re-run production build in the target deployment environment before launch sign-off.

### Product truth / messaging
- capability maps in code are broader than current launch messaging. Keep docs disciplined so “capability exists in code” is not mistaken for “provider is commercially ready.”
- platform claims should continue to be grounded in real provider approval, live posting tests, and operational support readiness.

## Recommended next pass

1. Make `src/lib/env/index.ts` the actual enforced config entrypoint or remove it.
2. Add a small CI workflow that runs `npm run typecheck`, `npm run lint`, and `npm run build` with a safe example env.
3. Add a concise release checklist for “LinkedIn launch path” versus “secondary-provider validation”.
4. Add smoke tests for the highest-risk route handlers: OAuth callbacks, Stripe webhook, media presign, and publish dispatch.

## Bottom line

The repository is directionally strong: the implementation has moved beyond a narrow prototype, and the main quality risk was no longer core code shape but **documentation and operational truth drift**.

This QA pass corrected the highest-friction repo mismatches so the package now communicates the current state more honestly:
- LinkedIn-first launch posture
- broader adapter progress in code
- current environment model
- cleaner starting docs for the next execution cycle
