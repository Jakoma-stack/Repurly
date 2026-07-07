Final QA fix note

Fixed a typecheck error in:
- src/app/app/billing/page.tsx

Issue:
- billingAccess can be null, so reading billingAccess.plan directly failed typecheck.

Fix:
- changed the render to use:
  billingAccess?.plan ?? 'core'

This keeps the page safe when billing access state is temporarily null.
