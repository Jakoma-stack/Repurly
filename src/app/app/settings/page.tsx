import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { createWorkspaceInvite, removeWorkspaceMember, revokeWorkspaceInvite, updateOperatorControl } from '@/server/actions/settings';
import { getSettingsSnapshot } from '@/server/queries/settings';

const controlLabels: Record<string, { title: string; description: string }> = {
  pause_publishing: { title: 'Pause publishing', description: 'Block new scheduling while operators work through a queue or provider issue.' },
  advanced_ai_planner: { title: 'Advanced AI planner', description: 'Expose the richer AI campaign planner workflow.' },
  social_listening_automation: { title: 'Social listening automation', description: 'Use AI-assisted comment triage and lead routing workflows.' },
  facebook_channel_visibility: { title: 'Facebook channel visibility', description: 'Surface Facebook as an available channel in setup and publishing surfaces.' },
  auto_calendar_placement: { title: 'Auto calendar placement', description: 'Allow AI-generated drafts to be auto-placed into the calendar queue.' },
};

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const workspaceSession = await requireWorkspaceSession();
  const canManageBilling = workspaceSession.role === 'owner' || workspaceSession.role === 'admin';
  const canManageWorkspace = workspaceSession.role === 'owner' || workspaceSession.role === 'admin';
  const snapshot = await getSettingsSnapshot(session.workspaceId);
  const params = (await searchParams) ?? {};
  const ok = Array.isArray(params.ok) ? params.ok[0] : params.ok;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <div className="space-y-6">
      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Settings updated.</div> : null}
      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error === 'invite-email-mismatch' ? 'Sign in with the invited email address before accepting this invite.' : 'That action could not be completed.'}</div> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Operator controls</h2>
            <p className="text-sm text-muted-foreground">Use feature flags to protect the workflow without ripping up the product.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(snapshot.flags).map(([key, enabled]) => (
              <form key={key} action={updateOperatorControl} className="rounded-2xl border border-border p-4">
                <input type="hidden" name="workspaceId" value={session.workspaceId} />
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="enabled" value={String(!enabled)} />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-slate-950">{controlLabels[key]?.title ?? key}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{controlLabels[key]?.description ?? 'Feature flag control'}</div>
                  </div>
                  <button className={`rounded-full px-3 py-1 text-sm font-medium ${enabled ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{enabled ? 'On' : 'Off'}</button>
                </div>
              </form>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Support snapshot</h2>
            <p className="text-sm text-muted-foreground">Quick operator metrics for the current workspace.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {Object.entries(snapshot.supportSnapshot).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-border bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-medium text-slate-950">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase())}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Team invites and roles</h2>
            <p className="text-sm text-muted-foreground">Reinstate the team workflow without changing the underlying membership model.</p>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            {canManageWorkspace ? (
              <form action={createWorkspaceInvite} className="space-y-3 rounded-2xl border border-border p-4">
                <input type="hidden" name="workspaceId" value={session.workspaceId} />
                <div>
                  <label className="text-sm font-medium text-slate-900">Invite email</label>
                  <input name="email" type="email" required className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Role</label>
                  <select name="role" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue="viewer">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="approver">Approver</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create invite</button>
              </form>
            ) : <div className="rounded-2xl border border-border p-4 text-muted-foreground">Ask an owner or admin to manage invites.</div>}

            <div className="space-y-3">
              <div className="font-medium text-slate-950">Workspace members</div>
              {snapshot.members.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
                  <div>
                    <div className="font-medium text-slate-950">{member.clerkUserId}</div>
                    <div className="text-muted-foreground">{member.role}</div>
                  </div>
                  {canManageWorkspace ? (
                    <form action={removeWorkspaceMember}>
                      <input type="hidden" name="workspaceId" value={session.workspaceId} />
                      <input type="hidden" name="membershipId" value={member.id} />
                      <button className="rounded-2xl border border-border px-3 py-2 text-sm">Remove</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="font-medium text-slate-950">Pending invites</div>
              {snapshot.invites.length ? snapshot.invites.map((invite) => (
                <div key={invite.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">{invite.email}</div>
                      <div className="text-muted-foreground">{invite.role} · {invite.status}</div>
                    </div>
                    {canManageWorkspace ? (
                      <form action={revokeWorkspaceInvite}>
                        <input type="hidden" name="workspaceId" value={session.workspaceId} />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button className="rounded-2xl border border-border px-3 py-2 text-sm">Revoke</button>
                      </form>
                    ) : null}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground break-all">Accept URL: /accept-invite?token={invite.token}</div>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-border p-4 text-muted-foreground">No invites yet.</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Billing and reliability</h2>
            <p className="text-sm text-muted-foreground">Keep billing and reliability easy to reach while the product is still in a premium pilot stage.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl border border-border p-4 text-muted-foreground">Your workspace role is <span className="font-medium text-slate-950">{workspaceSession.role}</span>.</div>
            {canManageBilling ? (
              <>
                <Link href="/api/billing/portal" className="block font-medium text-primary">Open billing portal</Link>
                <Link href="/app/billing" className="block font-medium text-primary">Review plan usage</Link>
              </>
            ) : <div className="rounded-2xl border border-border p-4 text-muted-foreground">Ask a workspace owner or admin to manage billing changes.</div>}
            <Link href="/app/reliability" className="block font-medium text-primary">Open reliability console</Link>
            <Link href="/app/reports" className="block font-medium text-primary">Open operational reporting</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
