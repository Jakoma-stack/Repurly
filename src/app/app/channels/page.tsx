import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleAlert, ShieldCheck, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PlatformGrid } from '@/components/channels/platform-grid';
import { ReconnectNudges } from '@/components/channels/reconnect-nudges';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getWorkspaceSetupState } from '@/lib/onboarding/setup';
import { disconnectLinkedInWorkspace, setDefaultLinkedInTarget } from '@/server/actions/channels';
import { getLinkedInTargets } from '@/server/queries/workflow';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Banner({ kind, children }: { kind: 'success' | 'error'; children: React.ReactNode }) {
  const styles = kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900';
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function targetTone(isDefault: boolean) {
  return isDefault
    ? 'border-emerald-200 bg-emerald-50 shadow-sm'
    : 'border-border bg-white';
}

function friendlyTargetType(targetType: string) {
  if (targetType === 'member' || targetType === 'profile') return 'Personal profile';
  if (targetType === 'organization' || targetType === 'page') return 'Company page';
  return targetType;
}

export default async function ChannelsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const setup = await getWorkspaceSetupState(session.workspaceId);
  const targets = await getLinkedInTargets(session.workspaceId);
  const params = (await searchParams) ?? {};
  const linkedInState = firstParam(params.linkedin);
  const setupState = firstParam(params.setup);
  const error = firstParam(params.error);
  const warning = firstParam(params.warning);
  const currentDefaultTarget = targets.find((target) => target.isDefault) ?? targets[0] ?? null;
  const companyPageTargets = targets.filter((target) => target.targetType === 'organization' || target.targetType === 'page');
  const personalTargets = targets.filter((target) => target.targetType === 'member' || target.targetType === 'profile');
  const showLinkedInOnboarding = linkedInState === 'connected' || setupState === 'review-target' || setupState === 'target-confirmed';

  return (
    <div className="space-y-6">
      {setupState === 'target-confirmed' ? (
        <Banner kind="success">Default LinkedIn target confirmed. The workspace can now move into drafting, approval, and scheduling with the right destination selected.</Banner>
      ) : null}
      {error === 'missing-workspace' ? <Banner kind="error">Repurly could not tell which workspace should reconnect LinkedIn. Reopen the connection from this screen so the active workspace is passed through correctly.</Banner> : null}
      {error === 'linkedin-missing-oauth' ? <Banner kind="error">LinkedIn returned without the expected OAuth details. Start the connection again from this workspace so Repurly can finish setup safely.</Banner> : null}
      {error === 'linkedin-connect-failed' ? <Banner kind="error">LinkedIn authentication completed, but Repurly could not finish syncing the workspace targets. Retry the connection from this screen.</Banner> : null}
      {linkedInState === 'disconnected' ? <Banner kind="success">LinkedIn was disconnected for this workspace. Reconnect when you are ready to re-test recovery and target sync.</Banner> : null}
      {error === 'invalid-target' ? <Banner kind="error">Repurly could not confirm that LinkedIn target for this workspace. Pick a visible target below and try again.</Banner> : null}
      {warning === 'linkedin-company-pages-missing-scopes' ? <Banner kind="error">LinkedIn connected the member profile, but company pages could not be synced because the granted scopes do not include organization access. Update the app scopes to include company-page permissions, then reconnect.</Banner> : null}
      {warning === 'linkedin-company-pages-forbidden' ? <Banner kind="error">LinkedIn connected the member profile, but company pages were denied during organization lookup. Confirm this LinkedIn app has approved organization permissions and that the signed-in member is an admin of the company page.</Banner> : null}
      {warning === 'linkedin-company-pages-unauthorized' ? <Banner kind="error">LinkedIn connected the member profile, but organization lookup was not authorised. Reconnect LinkedIn and accept the full company-page permission set for the correct workspace.</Banner> : null}
      {warning === 'linkedin-company-pages-unavailable' || warning === 'linkedin-company-pages-sync-failed' ? <Banner kind="error">LinkedIn connected the member profile, but Repurly could not sync company pages for this workspace. Reconnect after confirming the LinkedIn app has company-page access and the signed-in account administers the page.</Banner> : null}

      {showLinkedInOnboarding ? (
        <Card id="linkedin-onboarding" className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-800">
                  <CheckCircle2 className="size-4" />
                  LinkedIn connected
                </div>
                <h2 className="text-2xl font-semibold">Finish the post-connect setup in Channels</h2>
                <p className="text-sm text-slate-600">
                  Keep the flow workspace-aware: LinkedIn will not show a company-page picker during sign-in, so Repurly discovers any admin-managed company pages after connect and lets you set the default target here.
                </p>
              </div>
              <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm">
                  <div className="font-medium text-slate-950">Targets synced</div>
                  <div className="mt-1 text-slate-600">{targets.length}</div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm">
                  <div className="font-medium text-slate-950">Current default</div>
                  <div className="mt-1 text-slate-600">{currentDefaultTarget?.displayName ?? 'Needs confirmation'}</div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm">
                <div className="font-medium text-slate-950">1. Review discovered destinations</div>
                <div className="mt-1 text-slate-600">LinkedIn sign-in only handles consent. Check that Repurly discovered the correct personal profile and any company pages you administer.</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm">
                <div className="font-medium text-slate-950">2. Confirm the default target</div>
                <div className="mt-1 text-slate-600">Pick the destination that should receive drafts by default so the composer does not quietly post to the wrong place.</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm">
                <div className="font-medium text-slate-950">3. Continue into composer</div>
                <div className="mt-1 text-slate-600">Once the target is right, move into drafting, approvals, scheduling, and queue review without leaving the LinkedIn-first path.</div>
              </div>
            </div>

            {targets.length ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <CircleAlert className="size-4 text-amber-600" />
                  Confirm the LinkedIn destination that should be the workspace default.
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {targets.map((target) => (
                    <div key={target.id} className={`rounded-3xl border p-4 ${targetTone(target.isDefault)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-950">{target.displayName}</div>
                          <div className="mt-1 text-sm text-slate-600">{target.handle || 'LinkedIn target'} · {friendlyTargetType(target.targetType)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-border bg-white px-2.5 py-1 uppercase tracking-wide text-slate-500">{friendlyTargetType(target.targetType)}</span>
                          {target.isDefault ? <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 font-medium uppercase tracking-wide text-emerald-800">Default</span> : null}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <form action={setDefaultLinkedInTarget}>
                          <input type="hidden" name="workspaceId" value={session.workspaceId} />
                          <input type="hidden" name="platformAccountId" value={target.id} />
                          <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                            {target.isDefault ? 'Keep as default' : 'Make default target'}
                          </button>
                        </form>
                        {!target.isDefault ? (
                          <form action={setDefaultLinkedInTarget}>
                            <input type="hidden" name="workspaceId" value={session.workspaceId} />
                            <input type="hidden" name="platformAccountId" value={target.id} />
                            <input type="hidden" name="continueTo" value="composer" />
                            <button className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                              Make default and continue
                            </button>
                          </form>
                        ) : (
                          <Link href="/app/content#target-selection"><Button variant="outline">Continue to composer</Button></Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-sm text-slate-600">
                LinkedIn connected, but no publishable destinations were synced yet. LinkedIn does not offer a company-page picker during OAuth, so Repurly has to discover company pages after connect. Reconnect after confirming the app has approved company-page permissions and the signed-in member administers the page.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">LinkedIn-first setup</h2>
          <p className="text-sm text-muted-foreground">
            Finish the live LinkedIn path before opening composer. This keeps the first workflow grounded in a real target, approval path, and queue.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="font-medium text-slate-950">LinkedIn connection</div>
              <div className="mt-1 text-muted-foreground">{setup.linkedInConnected ? 'Connected' : 'Not connected yet'}</div>
            </div>
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="font-medium text-slate-950">Available targets</div>
              <div className="mt-1 text-muted-foreground">{setup.linkedInTargetCount}</div>
            </div>
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="font-medium text-slate-950">Default target</div>
              <div className="mt-1 text-muted-foreground">{currentDefaultTarget?.displayName ?? 'Needs confirmation'}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {!setup.linkedInConnected ? (
              <Link href={`/api/linkedin/connect?workspaceId=${session.workspaceId}`}><Button>Connect LinkedIn</Button></Link>
            ) : (
              <Link href={showLinkedInOnboarding ? '/app/channels#linkedin-onboarding' : '/app/content#target-selection'}><Button>{showLinkedInOnboarding ? 'Review post-connect setup' : 'Continue to composer'}</Button></Link>
            )}
            <Link href="/app/reliability"><Button variant="outline">Open reliability</Button></Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">LinkedIn diagnostics</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Personal profiles</div>
              <div className="mt-1 font-medium text-slate-950">{personalTargets.length}</div>
            </div>
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Company pages</div>
              <div className="mt-1 font-medium text-slate-950">{companyPageTargets.length}</div>
            </div>
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Default target type</div>
              <div className="mt-1 font-medium text-slate-950">{currentDefaultTarget ? friendlyTargetType(currentDefaultTarget.targetType) : 'Needs confirmation'}</div>
            </div>
            <div className="rounded-2xl border border-border p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Recovery test</div>
              <div className="mt-1 font-medium text-slate-950">Visible from this screen</div>
            </div>
          </div>
          {companyPageTargets.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <div className="flex items-center gap-2 font-medium"><CircleAlert className="size-4" /> Company pages are not visible yet</div>
              <div className="mt-1 text-amber-900/80">That usually means either the signed-in member is not a page admin or the LinkedIn app scopes were too narrow during connect.</div>
            </div>
          ) : null}
          {setup.linkedInConnected ? (
            <form action={disconnectLinkedInWorkspace} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input type="hidden" name="workspaceId" value={session.workspaceId} />
              <div className="flex-1 text-sm text-slate-700">
                <div className="font-medium text-slate-950">Disconnect LinkedIn to test recovery</div>
                <div className="mt-1 text-xs text-muted-foreground">This clears the workspace LinkedIn integration and makes reconnect guidance visible for the next test pass.</div>
              </div>
              <Button variant="outline"><Unplug className="mr-2 size-4" />Disconnect LinkedIn</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Setup checklist</h3>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div className="rounded-2xl border border-border p-4">1. Connect LinkedIn first and make that the live launch channel for this workspace.</div>
          <div className="rounded-2xl border border-border p-4">2. Confirm the correct profile or company page is present as the workspace default target.</div>
          <div className="rounded-2xl border border-border p-4">3. If a second brand needs a completely different LinkedIn login or permissions boundary, create a separate workspace instead of overloading one shared container.</div>
          <div className="rounded-2xl border border-border p-4">4. Only after LinkedIn is clean end to end should the workflow move into drafting, approval, and scheduling.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">How multi-brand setup works</h3>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-2xl border border-border p-4">Brands live inside the same workspace, so drafting and reporting can stay in one shared operating view.</div>
          <div className="rounded-2xl border border-border p-4">Connected channels are workspace-level today. Pick the correct LinkedIn destination per post, and confirm the workspace default carefully before switching brands.</div>
          <div className="rounded-2xl border border-border p-4">Repurly is safest when one workspace maps to one LinkedIn permission boundary. If brand two needs a different LinkedIn login, create a separate workspace rather than reconnecting over the top of brand one.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Primary channel</h3>
        </CardHeader>
        <CardContent>
          <PlatformGrid workspaceId={session.workspaceId} linkedInConnected={setup.linkedInConnected} />
        </CardContent>
      </Card>

      <ReconnectNudges workspaceId={session.workspaceId} />

      <div className="rounded-3xl border border-dashed border-border bg-slate-50 p-5 text-sm text-slate-600">
        Need to add more channels later? Keep them behind the LinkedIn wedge for now. The next best move is cleaner workflow completion, not broader channel count.
        <Link href="/app/content" className="ml-2 inline-flex items-center gap-1 font-medium text-primary">
          Open composer <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
