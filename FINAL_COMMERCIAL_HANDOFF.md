Final commercial hardening patch

Included in this package:
- Working Settings admin surface with operator controls, support snapshot, invites, members, and direct navigation
- Added workspaceInvites schema export and matching settings query/actions
- Invite acceptance page
- Better LinkedIn channels guidance for personal profile vs company page
- Default-target fallback during scheduling so publishing uses the chosen default target when no explicit target is passed
- LinkedIn connection now prefers a company page as the default target when an organization target is available
- Reports nav shortcut in the app shell
- Dashboard shortcut to Reports

Important staging checks:
1. /app/settings loads
2. create invite works
3. pending invites appear
4. /app/channels clearly shows company page targets
5. company page can be set as default
6. schedule/publish without manually choosing target uses the default target
