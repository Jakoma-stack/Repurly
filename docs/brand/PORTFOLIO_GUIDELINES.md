# Jakoma portfolio brand system — v1.0 review

Design direction: distinct products, common standards. All new names and marks are pending clearance. Do not use the ™ or ® symbols as evidence of registration. No public launch, legal entity change, private family story, or commercial claim is authorised by this document.

## Identities

| Brand | Tagline | Ink | Primary | Accent | Surface | Contrast ink/surface; white/primary |
|---|---|---|---|---|---|---|
| Jakoma | Intelligence. Integrity. Impact. | #142C37 | #1E666C | #C6DCD8 | #F4F1EA | 12.88:1; 6.62:1 |
| Janeomi | Intelligence with ambition. | #102D32 | #186B65 | #A7E7CC | #F4F1EA | 12.90:1; 6.31:1 |
| JP Workbench | Every figure. Every detail. | #172B43 | #233D59 | #C3A677 | #F6F3ED | 12.96:1; 11.15:1 |
| Lorri-Lou’s Learning Hub | Little Steps, Big Lightbulbs. | #3E2D58 | #72558F | #E6B750 | #FAF8F4 | 11.50:1; 6.16:1 |
| MarbriA | Family & Home, Connected. | #355E49 | #355E49 | #D7B88E | #FAF8F2 | 6.94:1; 7.37:1 |
| AveryQuant One | Evidence before execution. | #101824 | #244A68 | #57C5E8 | #E8F1F7 | 15.58:1; 9.32:1 |
| Jakoma Risk Intelligence | From reactive oversight to proactive assurance. | #203347 | #294C65 | #B6CEDF | #E9EEF2 | 11.06:1; 9.07:1 |

## Typography and logo system
- Shared typography: system-ui, Segoe UI, Arial; existing Geist allowed in repositories already bundling it. 400 body, 600 labels, 700 headings; 16px normal body, 18px family-facing body, line height 1.5. Use tabular figures for financial and analytical interfaces. No new font dependency or font licence assumption.
- Use each product's square SVG mark with its live-text name, or horizontal lockup where supplied; title and punctuation in the registry are canonical. Janeomi's visual wordmark is lowercase janeomi. with terminal dot; plain text name Janeomi. Lorri-Lou’s Learning Hub may wrap, not truncate. Keep MarbriA capitalisation. Do not distort, recolour arbitrarily, use shadows or busy backgrounds. Clear space: at least 16% of icon width. Minimum icon 24px, lockup 160px or 240px for long labels. Wordmark text in SVG uses fallback fonts, so outline after typography QA for final print.
- The corporate endorsement is “By Jakoma”, subject to confirmed legal identity. Do not imply other group companies exist; Advisory/Technologies/Labs are proposed operating categories, not new registered entities.
- Accent is decorative. Use ink on light surface and white on approved dark primary. Other pairings must be checked. Logo exemptions do not remove contrast duties for adjacent text and controls.

## Accessibility acceptance criteria
Target WCAG 2.2 AA (https://www.w3.org/WAI/WCAG22/quickref/). Contrast tests above cover only named colours. Keyboard-only paths, focus visible and not obscured, no keyboard traps, semantic headings, labelled controls and errors in text, meaningful alt text, 200% zoom, 320px reflow, reduced motion, no colour-only meaning, captions where appropriate. Target 44x44px controls, 48px for family-facing tasks, never less than WCAG 2.2 AA requirements unless documented exception. Before release run automated axe, manual keyboard, screen-reader, zoom, mobile and contrast checks on each critical journey. No full accessibility compliance claim before testing.

## Editorial and commercial knowledge
The machine-readable registry is portfolio.json. Each profile defines audience, voice, proposition, objective, claim restrictions, stage and candidate domains. Keep private health, financial and student data out of AI marketing inputs. No claims of performance, availability, clinical monitoring, official education affiliation or investment returns without verification. Janeomi can support internal and independent commercial customers using the same architecture. Research-only profiles never participate in active sales campaigns. No restricted platform data for lead enrichment; authorised integrations and human review remain required.

## Implementation and release gates
Review branches only. Preserve stable identifiers, routing, existing OAuth callbacks, Stripe customer/subscription IDs, database records and hosting. Do not rename repository or cloud services. Janeomi's header/title preview is opt-in via JANEOMI_BRAND_PREVIEW=true, which must not be enabled in public production until clearance. The private brand-system page allows an authorised owner/admin to apply conservative marketing knowledge to exact matching active brands; it does not rename them or alter content. Current public names remain until legal clearance and cutover. Verify every app build, authenticated flow, accessibility and branding before staging promotion; separately approve DNS and OAuth changes, logo similarity checks, legal/privacy review, domains, handles and commercial launch.
