# Phase 3 workplan

## What this build adds
- customer billing portal launch from the protected billing page
- subscription management polish for checkout, portal return and Stripe sync states
- workspace team management page
- manual teammate invite links for owners/admins
- workspace role model: owner, admin, member
- seat-aware team management based on plan tier

## What it is designed for
- one workspace per customer company
- one owner account first
- optional admins and members added after onboarding
- owner/admin-led customer management while transactional team emails remain manual

## What you still need to do outside the code
1. Keep live Stripe and portal configuration stable in Render.
2. Decide whether admins should keep billing control or whether billing should be owner-only.
3. Decide the final seat limits per plan for public pricing.
4. Decide when to add automated team invitation emails.
5. Decide whether existing users should be able to join additional workspaces without manual ops help.
6. Add billing failure comms and support playbooks for real customers.

## Recommended next phase
Phase 4 should add:
- automated invite and billing emails
- richer customer onboarding tasks and progress states
- analytics/reporting inside the workspace
- stronger permission granularity by feature
- self-serve workspace settings and brand management
