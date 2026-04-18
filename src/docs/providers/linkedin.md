# LinkedIn Setup Guide

## Intended role

Primary launch channel for Repurly.

## Required env vars

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`
- `LINKEDIN_SCOPE`
- `TOKEN_ENCRYPTION_SECRET`

## Production tasks

- create LinkedIn app
- configure production callback URL
- request and verify required scopes
- verify member and organization posting flows
- verify token refresh if programmatic refresh tokens are enabled on the app
- test text, image, multi-image, and video publishing with real accounts

## Notes

LinkedIn is the strongest implementation path in this repo, but production readiness still depends on approved app settings and real account verification.
