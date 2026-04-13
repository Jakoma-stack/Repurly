# Platform Status Matrix

This document is the single source of truth for what this repository supports today versus what still requires provider-specific implementation and live verification.

## Status key

- **Live-first**: repo includes a meaningful implementation path and is intended to be finished with credentials and provider review.
- **Scaffolded**: architecture, adapter, env placeholders, and docs exist, but the provider flow is not complete.
- **Needs provider approval**: production readiness depends on provider review, product approval, business verification, or live account testing.

| Platform | Account connect | Token lifecycle | Account discovery | Text | Image | Multi-image | Video | Analytics | Status |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| LinkedIn | Yes | Yes | Partial | Yes | Yes | Yes | Yes | Planned | Live-first |
| X | Yes | Yes | Yes | Yes | Planned | Planned | Planned | Planned | Live-first |
| Facebook Pages | Yes | Yes | Yes | Yes | Planned | Planned | Planned | Planned | Live-first |
| Instagram Business | Yes | Yes | Yes | N/A | Yes | Yes | Yes | Planned | Live-first |
| Threads | Planned | Planned | Planned | Planned | Planned | Planned | Planned | Planned | Scaffolded |
| YouTube | Planned | Planned | Channel selection planned | N/A | N/A | N/A | Planned | Planned | Scaffolded |
| TikTok | Planned | Planned | Planned | N/A | N/A | N/A | Planned | Planned | Scaffolded |

## What “future-ready” means in this codebase

The repo is structured to support future channels without duplicating the app:

- shared workspace, brand, content, approvals, billing, and storage layers
- per-platform adapters under `src/lib/platforms/adapters`
- shared publish orchestration through the adapter registry
- shared workflow entrypoints via Inngest
- shared environment patterns and encryption approach for provider tokens

## What still requires real-world work

Every provider still requires some or all of the following before production launch:

- developer app creation
- approved scopes and products
- valid callback URIs
- real content/media testing
- provider-specific publish status handling
- retry and backoff tuning
- final analytics endpoints
- support and reconnect UX
