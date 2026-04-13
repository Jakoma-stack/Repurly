# Meta Setup Guide (Facebook Pages + Instagram Business)

## Required env vars

- `META_APP_ID`
- `META_APP_SECRET`
- `FACEBOOK_REDIRECT_URI`
- `FACEBOOK_SCOPE`
- `INSTAGRAM_REDIRECT_URI`
- `INSTAGRAM_SCOPE`
- `TOKEN_ENCRYPTION_SECRET`

## Facebook Pages

Current repo direction:

- OAuth connect path
- page discovery path
- text/link publishing path

Production tasks:

- verify app review for required page scopes
- test page discovery and page token retrieval
- test text and link publishing in live mode
- add image/video flows before claiming full parity

## Instagram Business

Current repo direction:

- OAuth connect path through Meta app credentials
- Instagram Business discovery from connected pages
- image, carousel, and video publish flows using media containers
- shared token lifecycle and encrypted workspace integration storage

Operational notes:

- Instagram Business publishing still depends on a connected Facebook Page and a linked Instagram Business account
- uploaded media must be available on a public URL reachable by Meta Graph APIs
- some publish operations are asynchronous in the real world, so final production rollout should add polling/webhook status checks and backoff handling

Production tasks:

- confirm app review covers required Instagram scopes
- validate page-to-Instagram mapping across real accounts
- add publish status polling and surfaced failure states in the UI
- extend analytics and insights fetches before claiming full parity
