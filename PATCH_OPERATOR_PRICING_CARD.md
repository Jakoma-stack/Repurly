# Operator pricing card readability patch

This revision fixes the marketing pricing section where the Operator card could render pale/white text on a light card.

Updated file:

- `src/app/(marketing)/page.tsx`

Change made:

- The featured Operator card now uses a white card with dark readable text.
- Operator is still highlighted with a teal border/ring.
- Price, description and bullets use `text-slate-950` / `text-slate-700`.
- Only CTA buttons use white text on a dark button.

Commercial positioning and pricing remain:

- Starter — £79/mo
- Operator — £249/mo
- Studio — from £699/mo
- Founder Pilot — from £950 one-off
