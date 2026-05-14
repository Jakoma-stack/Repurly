# Subscription Feature Mapping

Repurly uses internal plan keys for backwards compatibility:

| Internal key | Public plan | Price | Intended customer |
|---|---|---:|---|
| `core` | Starter | £79/mo | Solo consultant/founder, one brand or offer |
| `growth` | Operator | £249/mo | Multi-offer consultant, fractional marketer, small B2B team |
| `scale` | Studio | From £699/mo | Agency or assisted growth team |

## Enforced limits

| Capability | Starter / `core` | Operator / `growth` | Studio / `scale` | Enforcement point |
|---|---:|---:|---:|---|
| Workspace members | 1 | 3 | 15 | Invite creation and invite acceptance |
| Brands/offers | 1 | 4 | 10 | Brand creation |
| Planned posts per month | 60 | 300 | 10,000 | Manual post creation and AI draft generation |
| Campaign/output channels | 2 | 6 | 30 | Connected publishing where enabled, plus export/output destinations |
| Approval workflows | No | Yes | Yes | Approval request creation |
| Priority support | No | No | Yes | Commercial/service handling |
| Storage display allowance | 10 GB | 100 GB | 500 GB | Displayed in billing usage; hard storage enforcement should be added before heavy file uploads |

## Stripe mapping

Stripe checkout uses the same internal keys:

- `STRIPE_PRICE_CORE` => Starter / £79/mo
- `STRIPE_PRICE_GROWTH` => Operator / £249/mo
- `STRIPE_PRICE_SCALE` => Studio / from £699/mo, normally not self-serve unless you deliberately configure it

The Stripe webhook resolves the paid price ID back to `core`, `growth`, or `scale` and updates `workspaces.plan`. Product UI then displays the public label using `formatPlanLabel`.

## Commercial rule

Repurly should automate workflow, not LinkedIn behaviour. It must not promise scraping, automated DMs, fake engagement, or account-risk automation.


## Channel wording rule

Public copy should use **campaign/output channels** rather than **connected channels** unless the UI is specifically referring to a verified API account connection.

A campaign/output channel can be a destination Repurly helps plan, adapt, approve, export, or publish to where an integration is enabled. This keeps the product commercially accurate while direct platform integrations are being tested.

Launch-safe output examples:

- LinkedIn post
- LinkedIn carousel outline
- Facebook Page post
- Instagram caption
- Google Business Profile update
- Email/newsletter
- Blog post
- YouTube title, description, chapters, and script
- TikTok/Reels hook, caption, and shot list
- Threads post
- X post/thread export
- WhatsApp/referral message

Do not market unfinished channels as automatic direct-publishing integrations. LinkedIn remains the primary launch workflow.
