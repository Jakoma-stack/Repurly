# Channel implementation checklist

Use this when turning a scaffolded adapter into a live integration.

## Required pieces

- environment variables and secret storage
- OAuth entry and callback routes
- token encryption and refresh behavior
- account discovery and default target selection
- provider upload flow for images and or video
- publish call
- provider-specific error parser
- analytics sync and reporting map
- test coverage for happy path and failure path

## Shared product assumptions

Do not duplicate:
- billing
- workspaces
- team roles
- assets
- approvals
- scheduling
- audit logs

Only implement provider-specific code inside the adapter layer.
