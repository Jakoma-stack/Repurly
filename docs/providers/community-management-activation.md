# Activation checklist (not yet enabled)

- Confirm Microsoft vetting and LinkedIn Development Tier approval, actual scopes and supported API version.
- Keep the existing LinkedIn publishing app and token untouched. Use dedicated Community Management OAuth credentials and a separately encrypted workspace-bound token store. Do not reuse the generic integration upsert, which keys on workspace and provider and would overwrite the existing LinkedIn connection.
- Confirm exact authorized organization and administrator role. The read-only adapter in src/lib/linkedin/community-read.ts implements the documented aggregate organic share statistics endpoint. It is intentionally not wired to a route or live credentials. No background job or live API traffic is enabled.
- Documentation: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-09 ; https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases?view=li-lms-2026-09 .
- Before live activation implement and review dedicated OAuth state, callback, encrypted credential store, disconnect, workspace isolation, quota enforcement and approved retention. Test using authorized development data only. Standard Tier is a separate production gate.
- Do not pass member content into existing lead scoring, CRM or AI pipelines. Review permitted AI uses separately. No automatic posting or messaging.
