# Meta + Instagram Live Integration Notes

This build upgrades Meta coverage beyond Facebook Pages text/link posting:

- Facebook Pages: OAuth, page discovery, text and link posting are wired
- Instagram Business: OAuth, account discovery, image publish, carousel publish, and video publish scaffolds are wired through Meta Graph endpoints

## What still requires live verification

- Meta app review and approved scopes
- working redirect URIs in both local and production environments
- live Instagram Business accounts linked to Facebook Pages
- public object storage URLs for media assets
- publish status polling for long-running video processing and intermittent Graph delays

## Suggested rollout

1. Validate Facebook Pages text and link posts in staging
2. Validate one Instagram Business single-image publish
3. Validate Instagram carousel publish with 2-3 public images
4. Validate Instagram video publish with a short MP4 and processing lag handling
5. Add UI status updates for container creation, publish queued, and publish confirmed
