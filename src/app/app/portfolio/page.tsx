import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getMarketingStage, getMarketingStageDetails, missingMarketingBasics } from '@/lib/marketing/portfolio';
import { getWorkspaceBrands } from '@/server/queries/brands';
import { getLinkedInTargets } from '@/server/queries/workflow';
import { canImportPilotPortfolio, importPilotPortfolio } from '@/server/actions/portfolio';

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const [params, canImport] = await Promise.all([searchParams, canImportPilotPortfolio()]);
  const [brands, destinations] = await Promise.all([
    getWorkspaceBrands(session.workspaceId),
    getLinkedInTargets(session.workspaceId),
  ]);
  const activeBrands = brands.filter(brand => brand.status === 'active');
  const draftCount = brands.reduce((sum, brand) => sum + Number(brand.draftPosts || 0), 0);
  const scheduledCount = brands.reduce((sum, brand) => sum + Number(brand.scheduledPosts || 0), 0);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-teal-950 p-7 text-white">
        <div className="eyebrow !text-white/50">Portfolio marketing</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">One cockpit. Separate marketing plans for every app.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
          Keep each app&apos;s audience, voice, call to action, launch stage and drafts distinct.
          Plan here, create content in the studio, and review the destination before scheduling anything.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a className="rounded-2xl bg-white px-4 py-2 font-semibold text-slate-950" href="/app/brands">Add or edit an app</a>
          <a className="rounded-2xl border border-white/30 px-4 py-2 font-semibold text-white" href="/app/content">Open content studio</a>
          {canImport ? (
            <a className="rounded-2xl border border-white/30 px-4 py-2 font-semibold text-white" href="/app/portfolio/campaigns">Review the four-week campaigns</a>
          ) : null}
        </div>
      </section>

      {params.setup === 'imported' ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Portfolio checked: {params.renamed ?? '0'} agreed name(s) corrected, {params.refreshed ?? '0'} unedited starter draft(s) updated, {params.brands ?? '0'} new brand(s) and {params.drafts ?? '0'} new draft(s) created.
          Customised drafts and other saved data were preserved. Nothing was scheduled or published.
        </div>
      ) : null}

      {canImport ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-950">Apply the agreed app branding</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Apply Lorri-Lou&apos;s Learning Hub, MarbriA and Jakoma Ltd as the agreed display names.
                JP Bookkeeping is the provisional portfolio identity honouring John Potts. PCWB remains the internal software name; the final product brand is still being checked.
                This safely corrects the saved brand records and only refreshes unedited starter posts.
              </p>
              <p className="mt-2 text-xs text-indigo-900">
                Available to the approved private staging pilot only. No external publishing or messaging takes place.
              </p>
            </div>
            <form action={importPilotPortfolio}>
              <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                Correct names and refresh starter drafts
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><div className="text-sm text-muted-foreground">Active brands</div></CardHeader><CardContent><div className="text-3xl font-semibold">{activeBrands.length}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Draft posts</div></CardHeader><CardContent><div className="text-3xl font-semibold">{draftCount}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Scheduled posts</div></CardHeader><CardContent><div className="text-3xl font-semibold">{scheduledCount}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Connected LinkedIn destinations</div></CardHeader><CardContent><div className="text-3xl font-semibold">{destinations.length}</div></CardContent></Card>
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <strong>Publishing guardrail:</strong> A brand is not a separate LinkedIn login.
        All destinations currently belong to the workspace. Check the selected profile or page,
        review and approve the copy, and never present a private build as a launched product.
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        {brands.map(brand => {
          const stage = getMarketingStage(brand.metadata);
          const stageInfo = getMarketingStageDetails(stage);
          const missing = missingMarketingBasics(brand);
          const canPlan = brand.status === 'active';
          const tagline = typeof brand.metadata?.brandTagline === 'string' ? brand.metadata.brandTagline : null;
          return (
            <Card key={brand.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">{brand.name}</h2>
                    {tagline ? <p className="mt-1 text-sm font-medium text-slate-700">{tagline}</p> : null}
                    {brand.slug === 'family-support' ? <p className="mt-1 text-xs text-slate-500">Family Care &amp; Home Safety</p> : null}
                    {brand.slug === 'period-close-workbench' ? <p className="mt-1 text-xs text-amber-800">JP tribute identity · PCWB internal · final software name pending</p> : null}
                    <p className="mt-1 text-sm text-slate-500">{stageInfo.label} · {brand.status}</p>
                  </div>
                  <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {Number(brand.draftPosts || 0)} drafts · {Number(brand.scheduledPosts || 0)} scheduled
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audience</div>
                  <p className="mt-1 text-slate-700">{brand.audience || 'Audience not defined'}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Call to action</div>
                  <p className="mt-1 text-slate-700">{brand.primaryCta || 'Add a CTA before running a campaign'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-slate-700">{stageInfo.guidance}</div>
                {missing.length ? (
                  <p className="text-amber-800">Setup needed: {missing.join(', ')}.</p>
                ) : <p className="text-emerald-800">Audience, tone and CTA configured.</p>}
                <div className="flex flex-wrap gap-2">
                  {canPlan ? (
                    <a href={'/app/content?brandId=' + encodeURIComponent(brand.id)} className="rounded-xl bg-slate-900 px-4 py-2 font-medium text-white">Plan campaign</a>
                  ) : <span className="rounded-xl bg-slate-100 px-4 py-2 text-slate-500">Activate brand to plan</span>}
                  <a href={'/app/brands?brandId=' + encodeURIComponent(brand.id)} className="rounded-xl border border-slate-200 px-4 py-2 font-medium">Brand settings</a>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {!brands.length ? (
        <Card>
          <CardHeader><h2 className="text-xl font-semibold">Start with your first app</h2></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>Create one brand record per app. Choose Private build initially and add an audience, tone and CTA. Repurly will keep each brand&apos;s content plan separate.</p>
            <a href="/app/brands" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 font-medium text-white">Set up brands</a>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
