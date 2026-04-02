# Refund, cancellation and support rules

## Recommended live policy

### Refunds
- Duplicate or accidental charges: refund in full.
- Failed onboarding caused by Repurly platform issues: refund in full.
- Mid-cycle dissatisfaction: handle case by case during launch and document the outcome.

### Cancellations
- Customers manage cancellation in the Stripe customer portal.
- Cancellation should default to end-of-period rather than immediate cutoff, unless there is a fraud or abuse issue.
- If a cancellation is requested directly by email, confirm it has been actioned and note the date.

### Support expectations
- Primary support channel: `support@repurly.org`
- Response target during launch: within 1 business day
- Billing problems take priority over product polish issues

### Internal playbook
1. Confirm workspace, plan and subscription status in `/ops/billing`.
2. If billing is wrong, use Stripe as the source of truth, then sync Repurly.
3. If access is blocked incorrectly, temporarily keep billing enforcement relaxed while the billing record is corrected.
4. Log material customer-impacting issues in the audit trail or internal notes.
