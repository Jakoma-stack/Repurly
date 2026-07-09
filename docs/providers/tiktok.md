# TikTok Setup Guide

## Required env vars

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TIKTOK_SCOPE`
- `TOKEN_ENCRYPTION_SECRET`

## Current repo direction

- adapter scaffold only
- architecture supports video-first provider workflows

## Production tasks

- obtain access to TikTok content publishing product
- implement OAuth connect and refresh handling
- implement upload/publish/status workflow
- handle webhook or polling updates for async processing
- test real publish flows with approved app/account setup
