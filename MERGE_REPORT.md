# Merge report

Base:
- `Repurly_final_aligned_qad_fixed.zip`

Merged in from older backup:
- branding assets and deploy notes
- reports page/query
- team invite ops migration
- handoff and verification docs

Cleanup applied:
- removed `.env.local`
- removed duplicate/junk root artifacts (`11.12.1`, `cd`, `npm`, `rg`, `winget`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`)
- removed `src.zip` export artifact
- replaced stale `.env.example` with a code-aligned version
- added `render.yaml`
- pinned Node via `package.json` engines

Validation notes:
- this is a best-effort recovery merge, not a fully production-certified release
- the project is structurally deployable again (root `package.json`, app source, docs, render config)
- I did not fully verify a clean production build in this sandbox
- treat this as the strongest recovery base for GitHub + staging, then do one careful deploy pass from it
