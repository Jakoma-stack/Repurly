# Phase 1A: customer identity foundation

## What this build adds
- Invite-only customer auth
- Password-based login and logout
- Invite activation links
- Password reset links
- Protected customer dashboard
- Ops tools to generate invite and reset links

## Best-practice decisions already applied
- Start with **one user per company**
- Keep **ops admin** separate from customer login
- Use **manual invite/reset links first** before enabling transactional email
- Keep Stripe optional until auth and dashboard access are stable

## What you still need to do outside the code
1. Put real production values into Render for:
   - `OPS_USERNAME`
   - `OPS_PASSWORD`
   - `FLASK_SECRET_KEY`
2. Keep `INVITE_TOKEN_HOURS=72` and `RESET_TOKEN_HOURS=1` unless you have a strong reason to change them.
3. Decide when to move from manual invite/reset links to transactional email.
4. When ready for email, either:
   - configure SMTP for `support@repurly.org`, or
   - use a transactional provider like Postmark, Resend, SendGrid, or SES.
5. Keep Phase 1A scoped to one invited user per approved company.

## Recommended next product phases
- Phase 1B: account/workspace isolation and richer customer dashboard
- Phase 2: Stripe checkout tied to customer access
- Phase 3: team roles and multi-user agency workspaces
