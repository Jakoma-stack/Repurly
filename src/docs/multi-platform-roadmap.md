# Repurly multi-platform roadmap

## Principle

Repurly should remain one premium SaaS with one shared core. Every network plugs in through the adapter layer.

## Current state

- LinkedIn is the first-class live integration path.
- X, Facebook Pages, Instagram Business, Threads, and YouTube are scaffolded as adapters.
- The shared schema now supports platform accounts, post targets, post types, and provider-specific publish results.

## Recommended rollout order

1. LinkedIn hardening
2. X
3. Facebook Pages
4. Instagram Business
5. Threads
6. YouTube

## Why this order

- X is the closest to a text-first workflow.
- Facebook and Instagram can share parts of the Meta auth and page/account discovery layer.
- Threads can reuse some Meta-side concepts.
- YouTube has very different asset and publish semantics, so it benefits from a mature shared media pipeline.

## Adapter checklist

For every new platform:

- OAuth scopes and callback route
- token encryption and refresh logic
- account or page discovery
- upload preparation
- provider upload flow
- publish call
- provider-specific failure parsing
- analytics sync
- capability declaration
- end-to-end test coverage
