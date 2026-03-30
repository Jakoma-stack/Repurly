# Repurly Readiness Fixes Before Heavy Selling

These are the improvements to make before pushing hard on sales.

## Critical
### 1. Posting reliability
- Confirm brand-level credential handling is stable
- Add clear retry logic
- Prevent duplicate posting
- Make failed post recovery obvious

### 2. Billing sanity
- Test real Stripe checkout end to end
- Test webhook handling and edge cases
- Test failed payment states
- Confirm plan enforcement is correct

### 3. Customer onboarding
- Make first login very obvious
- Reduce confusion in the first-run flow
- Ensure users can connect brand, create draft, review, and schedule without hand-holding

### 4. Email and invite flow
- Confirm invite emails are sent correctly
- Confirm acceptance flow works cleanly
- Confirm onboarding and support emails work in production

### 5. Legal and support basics
- Finalise privacy policy and terms
- Add support contact and response process
- Add refund/cancellation wording where needed

## Strongly recommended
### 6. Reporting and visibility
- Show scheduled, approved, published, failed, and retried states clearly
- Make customer-facing visibility clean and simple

### 7. Demo polish
- Keep one excellent demo workspace ready at all times
- Use realistic content and statuses

### 8. Admin support shortcuts
- Easy retry button
- Fast issue review
- Simple audit and event history for support

## Positioning rule
The product should clearly feel like: approve and publish content for multiple brands safely.
Not: vague all-purpose AI platform.
