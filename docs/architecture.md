# Repurly v2 architecture

## Product boundaries

Repurly is a premium multi-channel content operations system. It is still positioned LinkedIn-first commercially, but the product foundation is now platform-extensible.

## Core subsystems

### App shell
- Next.js App Router
- Route groups for marketing vs authenticated product
- Server components by default
- Server actions for trusted mutations

### Identity
- Clerk for auth, sessions, passwordless or email/password, org-aware access
- Internal workspace membership tables for product roles and billing tiers

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
  - audit events
  - billing customers

### Media and assets
- S3-compatible storage
- presigned uploads
- object metadata in Postgres
- no runtime dependence on local disk

### Background execution
- Inngest handles:
  - scheduled publish jobs
  - provider token refresh jobs
  - onboarding and lifecycle emails
  - dead-letter / retry visibility

### Billing
- Stripe Checkout for acquisition
- Stripe Billing Portal for self-service changes
- webhooks sync subscription state into Postgres

### Email
- Resend for welcome, invite, reset-adjacent product emails, billing notices, and publish alerts

### Platform adapter layer
Every network sits behind a common interface.

Each adapter owns:
- OAuth scopes and connect path
- token refresh logic
- account discovery
- upload rules
- publish logic
- capability declaration

### Supported channels in this build
- LinkedIn: live-first adapter scaffold with existing token lifecycle and publish path
- X: scaffolded adapter
- Facebook Pages: scaffolded adapter
- Instagram Business: scaffolded adapter
- Threads: scaffolded adapter
- YouTube: scaffolded adapter

## Why this matters

This avoids cloning the entire product per network. The shared product owns workspaces, approvals, storage, billing, and scheduling once. New networks only add adapter logic and provider-specific UX.
