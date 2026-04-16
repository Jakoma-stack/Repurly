# YouTube Setup Guide

## Required env vars

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI`
- `YOUTUBE_SCOPE`
- `TOKEN_ENCRYPTION_SECRET`

## Current repo direction

- adapter scaffold only
- intended for video-first publishing flows

## Production tasks

- implement Google OAuth and channel selection
- implement resumable upload flow
- support title, description, visibility, and publish timing
- map upload processing statuses back into workflow state
