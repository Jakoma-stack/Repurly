# Repurly v2 architecture

## Product boundaries

Repurly is a premium content-operations system with a **LinkedIn-first launch wedge** and a **platform-extensible adapter layer** behind it.

That distinction matters:

- the commercial story is intentionally narrow and premium
- the implementation is broader so additional channels can be added without cloning the product
- launch readiness should not be inferred from adapter presence alone

## Core subsystems

### App shell
- Next.js App Router
- route groups for marketing vs authenticated product
- server components by default
- server actions for trusted mutations

### Identity
- Clerk for auth, sessions, passwordless or email/password, org-aware access
- internal workspace membership tables for product roles and billing tiers

### Data
- Postgres as source of truth
- Drizzle schema with explicit tables for:
  - workspaces
  - brands
  - workspace memberships
  - connected integrations
  - platform accounts
  - content assets
  - posts
  - post targets
  - publish jobs
  - delivery logs
  - audit events
  - usage events
  - billing fields on workspaces

### Media and assets
- S3-compatible storage
- presigned uploads
- object metadata in Postgres
- no runtime dependence on local disk

### Background execution
- Inngest handles:
  - scheduled publish dispatch
  - per-post publish execution
  - retry and dead-letter posture
  - onboarding and lifecycle messaging hooks

### Billing
- Stripe Checkout for acquisition
- Stripe Billing Portal for self-service changes
- webhook-driven subscription state sync into Postgres

### Email and ops awareness
- Resend for welcome, invite, billing-adjacent, and alert emails
- optional webhook/email alerts for publish failures and reconnect warnings

### Platform adapter layer
Every network sits behind a common interface.

Each adapter owns:
- OAuth scopes and connect path
- token refresh logic
- account discovery
- upload rules
- publish logic
- capability declaration

## Channel posture in this repo

### Operational launch focus
- LinkedIn is the primary launch channel and onboarding path

### Implemented provider paths in code
- LinkedIn
- X
- Facebook Pages
- Instagram Business

These have meaningful code for connect and/or publish flows, but still require provider approval, credential setup, and live verification before claiming production readiness.

### Scaffolded / future-facing providers
- Threads
- YouTube
- TikTok

These have adapter placeholders and related docs/hooks, but not full production workflows.

## Why this matters

This architecture avoids duplicating the product per network. Shared layers own workspaces, approvals, storage, billing, scheduling, delivery logs, and recovery posture once. New networks should mainly add adapter logic plus provider-specific UX and operational hardening.
