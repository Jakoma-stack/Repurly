import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { campaignPlaybooks, findStarterDraftBody, reviewedJakomaTriagePost } from '@/lib/marketing/campaign-playbooks';
import { getMarketingStage, getMarketingStageDetails } from '@/lib/marketing/portfolio';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { applyReviewedJakomaTriageCopy } from '@/server/actions/marketing-campaigns';
import { getWorkspaceBrands } from '@/server/queries/brands';
import { getPortfolioCampaignPosts } from '@/server/queries/marketing-campaigns';
import { getLinkedInTargets } from '@/server/queries/workflow';

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case 'draft': return 'Saved draft — not approved';
    case 'in_review': return 'In approval review';
    case 'scheduled': return 'Scheduled elsewhere';
    case 'published': return 'Published — read only';
    case 'failed': return 'Publishing failed — investigate';
    default: return 'No matching saved starter post';
  }
}

export default async function PortfolioCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const [params, brands, posts, destinations, canPilotReview] = await Promise.all([
    searchParams,
    getWorkspaceBrands(session.workspaceId),
    getPortfolioCampaignPosts(session.workspaceId),
    getLinkedInTargets(session.workspaceId),
    canImportPilotPortfolio(),
  ]);

  // These curated owner-project campaigns are private-pilot content, not SaaS defaults.
  if (!canPilotReview) redirect('/app/portfolio');

  const reviewNotice = typeof params.review === 'string' ? params.review : null;
  const notices: Record<string, string> = {
    applied: 'Reviewed Jakoma copy saved to the existing draft. The post is still a draft and has not been scheduled or published.',
    preserved: 'No changes made. The original post was edited, is no longer a draft, or does not match the approved starter. Your work was preserved.',
    unavailable: 'The automatic copy update is restricted to the authenticated staging pilot.',
    invalid: 'No valid draft was selected.',
  };
  const savedDraftCount = posts.filter(post => post.status === 'draft').length;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-teal-950 p-7 text-white">
        <div className="eyebrow !text-white/50">Portfolio campaign review</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Five focused campaigns, one review workflow</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
          Check actual saved posts against editorial priorities and launch-stage safeguards.
          The first three weeks use existing drafts; week four is an evidence-and-feedback review,
          not an automatically generated post or invented lead count. Choose three total portfolio review slots per week; the playbooks are a draft library, not a publication calendar.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a href="/app/portfolio" className="rounded-2xl bg-white px-4 py-2 font-semibold text-slate-950">Back to App Portfolio</a>
          <a href="/app/content" className="rounded-2xl border border-white/30 px-4 py-2 font-semibold text-white">Content studio</a>
        </div>
      </section>

      {reviewNotice && notices[reviewNotice] ? (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
          {notices[reviewNotice]}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><div className="text-sm text-muted-foreground">Campaign playbooks</div></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{campaignPlaybooks.length}</div><p className="mt-1 text-xs text-slate-500">Human-reviewed editorial plans</p></CardContent>
        </Card>
        <Card>
          <CardHeader><div className="text-sm text-muted-foreground">Saved starter drafts</div></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{savedDraftCount}</div><p className="mt-1 text-xs text-slate-500">Live database records, not a simulated total</p></CardContent>
        </Card>
        <Card>
          <CardHeader><div className="text-sm text-muted-foreground">LinkedIn destinations</div></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{destinations.length}</div><p className="mt-1 text-xs text-slate-500">Destination must still be verified per post</p></CardContent>
        </Card>
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <strong>Publishing remains manual.</strong> These plans do not create, schedule, approve or publish posts.
        Jakoma has a real triage enquiry route. Janeomi, JP Workbench, Lorri-Lou&apos;s Learning Hub and MarbriA are in private testing or development:
        do not suggest they are available for purchase, live monitoring, or public student access.
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        {campaignPlaybooks.map(plan => {
          const brand = brands.find(item => item.slug === plan.brandSlug);
          const stage = getMarketingStage(brand?.metadata);
          const draftCount = posts.filter(post => post.brandId === brand?.id && post.status === 'draft').length;
          return (
            <Card key={plan.brandSlug}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">{brand?.name ?? plan.brandSlug}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {brand ? getMarketingStageDetails(stage).label : 'Brand not yet set up'}
                      {' · '}{plan.holdProductLaunchClaims ? 'Audience discovery only' : 'Real enquiry offer, subject to review'}
                    </p>
                  </div>
                  <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {draftCount} saved draft{draftCount === 1 ? '' : 's'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm font-medium text-slate-900">{plan.focus}</p>
                <p className="text-sm text-slate-700">{plan.goal}</p>
                <div className="rounded-2xl bg-slate-50 p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audience</div>
                  <p className="mt-1 text-slate-700">{plan.primaryAudience}</p>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Success means</div>
                  <p className="mt-1 text-slate-700">{plan.conversion}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                  <strong>Claim and launch check:</strong> {plan.guardrail}
                </div>
                {plan.publicOfferUrl ? (
                  <a href={plan.publicOfferUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-medium text-teal-800 underline">
                    Check the actual Jakoma triage request page
                  </a>
                ) : null}
                <div className="space-y-3">
                  {plan.weeks.map(week => {
                    const saved = week.draftKey
                      ? posts.find(post => post.brandId === brand?.id && post.metadata?.starterKey === week.draftKey)
                      : null;
                    const isJakomaTriage = plan.brandSlug === 'jakoma' && week.draftKey === 'jakoma-triage-first';
                    const oldBody = isJakomaTriage ? findStarterDraftBody('jakoma', 'jakoma-triage-first') : null;
                    const canApply = isJakomaTriage && saved?.status === 'draft' && saved.body === oldBody && canPilotReview;
                    const reviewedCopyAlreadyApplied = isJakomaTriage && saved?.body === reviewedJakomaTriagePost;
                    return (
                      <div key={week.week} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-teal-800">Week {week.week}</div>
                          <span className="text-xs text-slate-500">{statusLabel(saved?.status)}</span>
                        </div>
                        <h3 className="mt-2 font-semibold text-slate-950">{week.theme}</h3>
                        <p className="mt-1 text-sm text-slate-600">{week.outcome}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-600"><strong>Review:</strong> {week.reviewNote}</p>
                        {saved ? (
                          <div className="mt-3 space-y-2">
                            <div className="text-sm font-medium text-slate-900">{saved.title}</div>
                            <details className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                              <summary className="cursor-pointer font-medium text-slate-700">Read actual saved copy</summary>
                              <p className="mt-3 whitespace-pre-wrap text-slate-700">{saved.body}</p>
                            </details>
                            <a href={'/app/content?postId=' + encodeURIComponent(saved.id) + '#composer'} className="inline-flex rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900">
                              Review in content studio
                            </a>
                          </div>
                        ) : week.draftKey ? (
                          <p className="mt-3 text-xs text-amber-800">This starter draft is not present in the returned saved records; no activity has been invented.</p>
                        ) : (
                          <p className="mt-3 text-xs text-slate-600">Manual task: review real responses and prepare the next cycle.</p>
                        )}
                        {reviewedCopyAlreadyApplied ? (
                          <p className="mt-3 text-xs font-medium text-emerald-800">Reviewed request-form link is already in the saved post. Final approval is still required.</p>
                        ) : null}
                        {canApply && saved ? (
                          <div className="mt-4 space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-3">
                            <p className="text-sm font-medium text-teal-950">Suggested improvement: add the live triage request link</p>
                            <p className="text-xs text-teal-900">This replaces only the unedited starter draft. No review status, schedule or publishing action is changed.</p>
                            <details className="rounded-xl bg-white p-3 text-sm">
                              <summary className="cursor-pointer font-medium text-slate-800">Preview reviewed replacement copy</summary>
                              <p className="mt-3 whitespace-pre-wrap text-slate-700">{reviewedJakomaTriagePost}</p>
                            </details>
                            <form action={applyReviewedJakomaTriageCopy}>
                              <input type="hidden" name="postId" value={saved.id} />
                              <button type="submit" className="rounded-xl bg-teal-900 px-4 py-2 text-xs font-semibold text-white">
                                Apply reviewed copy to this draft
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700">
        <strong>Before posting:</strong> Check live product availability, claim accuracy, personal-data implications,
        brand identity and the LinkedIn page/profile selected in the content studio. Educational posts can still
        be reviewed while a product is in development, but a draft is not approval to publish.
      </div>
    </div>
  );
}
