# Platform Status Matrix

This document is the single source of truth for what this repository supports today versus what still requires provider-specific implementation and live verification.

## Status key

- **Launch path**: aligned with the current product wedge and intended for near-term live rollout.
- **Implemented path**: meaningful connect/publish code exists, but it is not the main launch path and still needs provider approval or live validation.
- **Scaffolded**: architecture, adapter, env placeholders, and docs exist, but the provider flow is not complete.

| Platform | Account connect | Token lifecycle | Account discovery | Text | Image | Multi-image | Video | Analytics | Current posture |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| LinkedIn | Yes | Yes | Partial | Yes | Yes | Yes | Yes | Partial / planned | Launch path |
| X | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Planned | Implemented path |
| Facebook Pages | Yes | Yes | Yes | Yes | Planned | Planned | Planned | Planned | Implemented path |
| Instagram Business | Yes | Yes | Yes | N/A | Yes | Yes | Yes | Planned | Implemented path |
| Threads | Planned | Planned | Planned | Planned | Planned | Planned | Planned | Planned | Scaffolded |
| YouTube | Planned | Planned | Channel selection planned | N/A | N/A | N/A | Planned | Planned | Scaffolded |
| TikTok | Planned | Planned | Planned | N/A | N/A | N/A | Planned | Planned | Scaffolded |

## How to read this correctly

- Repurly is still commercially **LinkedIn-first**.
- X, Facebook, and Instagram have real technical progress in the repo, but they should not be described as fully launch-ready without live provider verification.
- Threads, YouTube, and TikTok remain future-facing scaffolds.

## What “future-ready” means in this codebase

The repo is structured to support future channels without duplicating the app:

- shared workspace, brand, content, approvals, billing, and storage layers
- per-platform adapters under `src/lib/platforms/adapters`
- shared publish orchestration through the adapter registry
- shared workflow entrypoints via Inngest
- shared encryption and token-storage patterns for provider integrations

## What still requires real-world work

Every provider still requires some or all of the following before production launch:

- developer app creation
- approved scopes and products
- valid callback URIs
- real content and media testing
- provider-specific publish status handling
- retry and backoff tuning
- analytics endpoint completion
- reconnect and support UX
