# Repurly premium product pass

This pass is focused on the positioning standard:

**Repurly should be the platform with the best workflow control in the category, without being worse than anyone on creative, publishing, or content quality.**

External message:

**Premium content operations without feature sacrifice.**

## What changed

### 1. Premium visual system
- Upgraded global background and surface styling for a more premium product feel
- Introduced reusable premium surface utility classes
- Elevated cards and buttons with stronger depth, polish, and interaction states
- Refined shell presentation to better match enterprise-grade creative tooling

### 2. Product shell and positioning
- Reframed the app shell around premium content operations
- Improved left-nav naming so the product feels like a studio and operating system, not just an admin console
- Added a stronger positioning panel in the navigation shell

### 3. Overview page
- Rebuilt the overview into an executive-quality operating dashboard
- Added workflow metrics, queue snapshots, and moat/parity framing
- Turned the launch path into a more premium product narrative instead of a setup checklist alone

### 4. Studio / composer page
- Repositioned the composer as a premium studio surface
- Added clearer campaign planning, richer creative framing, and more explicit carousel support in the UI
- Surfaced premium creative guardrails and quality framing
- Upgraded the generated draft shortlist presentation
- Improved the editor layout so target, queue, and creative quality all stay visible together

### 5. Calendar & queue
- Reframed the queue as an operator-confidence surface
- Added queue summary metrics and improved item presentation

### 6. Reliability
- Elevated reliability as a premium trust feature, not a back-office afterthought
- Added health framing and better reliability storytelling in the UI

## Files changed
- `src/app/globals.css`
- `src/components/ui/card.tsx`
- `src/components/ui/button.tsx`
- `src/components/layout/app-shell.tsx`
- `src/app/app/page.tsx`
- `src/app/app/content/page.tsx`
- `src/app/app/calendar/page.tsx`
- `src/app/app/reliability/page.tsx`

## Important note
The uploaded repository does not currently include a working dependency installation / buildable Next.js environment in this container. Because of that, I could not complete a clean local build verification pass here.

The source changes are packaged and ready, but the app should be validated in a full project environment with dependencies restored.
