# Future Platform Adapter Guide

Repurly v2 is designed so new channels plug into a shared core instead of becoming separate apps.

## Adapter contract

Each platform implements a `PlatformAdapter` in `src/lib/platforms/adapters`.

The minimum responsibilities are:

1. `connectPath`
2. `getAuthScopes()`
3. token retrieval / refresh integration
4. optional account discovery
5. `publish()`

## Recommended implementation order for a new platform

1. Add platform key to `PlatformKey`
2. Add capability map entry in `src/lib/platforms/capabilities.ts`
3. Create adapter file in `src/lib/platforms/adapters`
4. Register adapter in `src/lib/platforms/registry.ts`
5. Add provider env vars to `.env.example`
6. Add provider setup guide in `docs/providers/`
7. Add workflow integration notes if publishing is asynchronous
8. Add publish result status mapping and failure classification
9. Add account discovery sync into platform accounts
10. Add customer-facing reconnect and health messaging

## Design principles

- keep workspace, billing, approvals, scheduling, and assets shared
- isolate provider-specific rules inside adapters and provider services
- avoid provider-specific database tables unless truly required
- model capabilities honestly so the UI only offers what the provider supports
- treat media upload and publish status as separate concerns
