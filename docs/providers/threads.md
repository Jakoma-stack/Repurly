# Threads Setup Guide

## Required env vars

- `THREADS_APP_ID`
- `THREADS_APP_SECRET`
- `THREADS_REDIRECT_URI`
- `THREADS_SCOPE`
- `TOKEN_ENCRYPTION_SECRET`

## Current repo direction

- adapter scaffold only
- shared multi-platform architecture already supports adding Threads cleanly

## Production tasks

- implement OAuth flow
- discover connected Threads profile/account
- implement text and media publish flows
- add status mapping and reconnect UX
