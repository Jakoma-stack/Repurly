# QA review summary

## Deep-dive findings
- AI campaign fields existed in the generator engine but were not wired from the planner UI or workflow action. Result: generic drafts and weak campaign fidelity.
- Saved campaign cookie did not persist campaign-specific fields. Result: partial planner state and loss of campaign context.
- LinkedIn platform-account sync defaulted the first connected account, which is usually the personal member URN, not the company page. Result: posts often defaulted to personal profile instead of organization page.
- attachTarget required an explicit targetId and did not gracefully fall back to the workspace default target.

## Fixes applied
- Added campaign fields to the planner UI: campaignType, audienceFocus, messageAngle, proofPoints, avoidTopics.
- Persisted those fields in the saved campaign cookie.
- Passed those fields into AI draft generation.
- Improved planner defaults to use the selected brand and a less generic commercial goal.
- Added default-target fallback in workflow attachment logic.
- Updated LinkedIn sync so organization targets become the default when available.

## QA status
- Source-level QA completed on AI planner, workflow action, and LinkedIn target-sync path.
- Recommended staging retest:
  1. reconnect LinkedIn so target defaults refresh
  2. verify company page is the default target in Channels
  3. generate drafts for Jakoma and Repurly using the new planner fields
  4. confirm batch titles/angles are campaign-specific
  5. publish one post to confirm organization target is used
