Render build fix for LinkedIn config typing

Issue
- Next.js build passed compile, then failed in TypeScript in src/lib/linkedin/config.ts
- The filter type predicate claimed LinkedInConfig, but the mapped array item type was narrower: an object literal with source fixed to 'legacy-suffixed' or null.

Fix
- Explicitly type the map callback as LinkedInConfig | null.
- Change the filter guard to config !== null.

Apply
- Replace src/lib/linkedin/config.ts with the patched file in this bundle.
