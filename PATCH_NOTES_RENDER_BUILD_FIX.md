# Render build fix

This patch fixes the Render deployment failure where Next.js reached the TypeScript phase and failed with:

```
Cannot find type definition file for 'sinonjs__fake-timers'
```

## What changed

- constrains ambient TypeScript types in `tsconfig.json` to `node`, `react`, and `react-dom`
- excludes common E2E test paths and config files from the production app typecheck
- clears `tsconfig.tsbuildinfo` before `npm ci && npm run build` in `render.yaml`
- recommends removing any committed `tsconfig.tsbuildinfo` cache file from the repository

## Why this works

TypeScript can auto-load visible `@types/*` packages unless `compilerOptions.types` is set. In CI or cached build environments this can pull in unrelated ambient types and fail the app build.

## Apply

Use the included unified diff, or copy the files from the `files/` folder into the repo root. If `tsconfig.tsbuildinfo` is tracked in Git, delete it in a follow-up commit.
