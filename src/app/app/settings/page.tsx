import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { OPERATOR_FLAG_KEYS } from '@/lib/ops/feature-flags';
import { createWorkspaceInvite, removeWorkspaceMember, revokeWorkspaceInvite, updateOperatorControl } from '@/server/actions/settings';
import { getSettingsSnapshot } from '@/server/queries/settings';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const FLAG_LABELS: Record<(typeof OPERATOR_FLAG_KEYS)[number], string> = {
  pause_publishing: 'Pause publishing',
  advanced_ai_planner: 'Advanced AI planner',
  social_listening_automation: 'Social listening automation',
  facebook_channel_visibility: 'Facebook channel visibility',
  auto_calendar_placement: 'Auto calendar placement',
};

function Banner({ kind, children }: { kind: 'success' | 'error'; children: React.ReactNode }) {
  const styles = kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900';
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export default async function SettingsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const snapshot = await getSettingsSnapshot(session.workspaceId);
  const supportSnapshot = snapshot?.supportSnapshot ?? {
    drafts: 0,
    pendingApprovals: 0,
    queuedJobs: 0,
    retryingJobs: 0,
    connectedIntegrations: 0,
    livePublishTargets: 0,
    workspaceMembers: 0,
  };
  const members = snapshot?.members ?? [];
  const invites = snapshot?.invites ?? [];
  const flags = snapshot?.flags ?? {
    pause_publishing: false,
    advanced_ai_planner: false,
    social_listening_automation: false,
    facebook_channel_visibility: false,
    auto_calendar_placement: false,
  };
  const params = (await searchParams) ?? {};
  const ok = firstParam(params.ok);
  const error = firstParam(params.error);
  const canManageBilling = session.role === 'owner' || session.role === 'admin';
  const canManageWorkspace = session.role === 'owner' || session.role === 'admin';

  return (
    <div className="space-y-6">
      {ok ? <Banner kind="success">{ok.replaceAll('-', ' ')}</Banner> : null}
      {error ? <Banner kind="error">{error.replaceAll('-', ' ')}</Banner> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Operator controls</h2>
            <p className="text-sm text-muted-foreground">
              Use feature flags to slow, pause, or widen the live workflow without changing code.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {OPERATOR_FLAG_KEYS.map((key) => {
              const enabled = flags[key] ?? false;
              return (
                <form key={key} action={updateOperatorControl} className="rounded-2xl border border-border p-4">
                  <input type="hidden" name="workspaceId" value={session.workspaceId} />
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="enabled" value={String(!enabled)} />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-950">{FLAG_LABELS[key]}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    <button className={`rounded-2xl px-3 py-2 text-sm font-medium ${enabled ? 'bg-slate-900 text-white' : 'border border-border bg-white text-slate-700'}`}>
                      {enabled ? 'Turn off' : 'Turn on'}
                    </button>
                  </div>
                </form>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Support snapshot</h2>
            <p className="text-sm text-muted-foreground">A quick operator view of what needs attention inside the workspace.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Drafts', supportSnapshot.drafts],
              ['Pending approvals', supportSnapshot.pendingApprovals],
              ['Queued jobs', supportSnapshot.queuedJobs],
              ['Retrying jobs', supportSnapshot.retryingJobs],
              ['Connected integrations', supportSnapshot.connectedIntegrations],
              ['Live publish targets', supportSnapshot.livePublishTargets],
              ['Workspace members', supportSnapshot.workspaceMembers],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-border bg-slate-50 p-4">
                <div className="text-muted-foreground">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Invite team members</h2>
            <p className="text-sm text-muted-foreground">
              Invite teammates into the workspace and keep workflow ownership visible.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManageWorkspace ? (
              <form action={createWorkspaceInvite} className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
                <input type="hidden" name="workspaceId" value={session.workspaceId} />
                <input name="email" type="email" placeholder="name@company.com" className="rounded-2xl border border-border px-4 py-2 text-sm" required />
                <select name="role" className="rounded-2xl border border-border px-4 py-2 text-sm">
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="approver">Approver</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Send invite</button>
              </form>
            ) : (
              <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
                Only owners and admins can invite team members.
              </div>
            )}

            <div className="space-y-3">
              <h3 className="font-medium text-slate-950">Pending invites</h3>
              {invites.length ? invites.map((invite) => (
                <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 text-sm">
                  <div>
                    <div className="font-medium text-slate-950">{invite.email}</div>
                    <div className="text-muted-foreground">{invite.role} · {invite.status}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/accept-invite?token=${invite.token}`} className="rounded-2xl border border-border px-3 py-2 text-slate-700">Open invite</Link>
                    {canManageWorkspace ? (
                      <form action={revokeWorkspaceInvite}>
                        <input type="hidden" name="workspaceId" value={session.workspaceId} />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button className="rounded-2xl bg-rose-600 px-3 py-2 text-white">Revoke</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No invites yet.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Workspace members</h2>
            <p className="text-sm text-muted-foreground">Roles currently active in this workspace.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.length ? members.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 text-sm">
                <div>
                  <div className="font-medium text-slate-950">{member.clerkUserId}</div>
                  <div className="text-muted-foreground">{member.role}</div>
                </div>
                {canManageWorkspace ? (
                  <form action={removeWorkspaceMember}>
                    <input type="hidden" name="workspaceId" value={session.workspaceId} />
                    <input type="hidden" name="membershipId" value={member.id} />
                    <button className="rounded-2xl border border-border px-3 py-2 text-slate-700">Remove</button>
                  </form>
                ) : null}
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No members found.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Channels and defaults</h2>
            <p className="text-sm text-muted-foreground">
              Use Channels to confirm whether the default destination is a personal profile or company page before publishing.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link href="/app/channels" className="block font-medium text-primary">Open channels</Link>
            <div className="rounded-2xl border border-border p-4 text-muted-foreground">
              Repurly can sync LinkedIn member and organization targets. Confirm the default target in Channels before sending a live post.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Billing, reliability, notifications</h2>
            <p className="text-sm text-muted-foreground">
              Keep the commercial and operational controls one click away.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/app/billing" className="block font-medium text-primary">Open in-app billing</Link>
            {canManageBilling ? <Link href="/api/billing/portal" className="block font-medium text-primary">Open billing portal</Link> : null}
            <Link href="/app/billing" className="block font-medium text-primary">Review plan usage</Link>
            <Link href="/app/reliability" className="block font-medium text-primary">Open reliability console</Link>
            <Link href="/app/notifications" className="block font-medium text-primary">Open notifications center</Link>
            <Link href="/app/settings/notifications" className="block font-medium text-primary">Edit notification preferences</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
