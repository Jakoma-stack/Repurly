# Phase 1B workplan

## What this build adds
- workspaces and workspace memberships
- customer dashboard with workspace context
- invite flow now creates a workspace automatically
- brands can be linked to a workspace from brand onboarding

## What you still need to do outside the code
1. Deploy the new build to Render.
2. Keep the existing customer auth environment variables in place.
3. Set strong production values for:
   - OPS_USERNAME
   - OPS_PASSWORD
   - FLASK_SECRET_KEY
4. Run one live test flow:
   - submit launch form
   - create invite link in `/ops/billing`
   - activate account
   - log in at `/login`
   - confirm `/dashboard` shows the workspace
5. Link at least one brand to the workspace from `/onboarding/brand`.
6. Decide whether invite/reset links stay manual or move to transactional email next.
7. Decide when to add Stripe-gated access in the next phase.

## Recommended next phase
Phase 2 should add:
- Stripe checkout tied to workspace access
- subscription-based gating
- richer customer dashboard actions
- multi-user team seats
