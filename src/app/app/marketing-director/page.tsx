import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession, requireWorkspaceRole } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { directorBrandEligibility, directorContext, directorPlanIsCurrent, rankDirectorBrands, savedDirectorPlan } from '@/lib/marketing/director';
import { getMarketingStageDetails } from '@/lib/marketing/portfolio';
import { generateDirectorPlan, saveDirectorDraft } from '@/server/actions/marketing-director';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { getWorkspaceBrands } from '@/server/queries/brands';

const messages: Record<string, string> = {
  generated: 'Your AI-generated 30-day plan is ready for review. No content was published.',
  failed: 'The AI request failed or returned an invalid plan. Any previous plan remains saved. Failed attempts count towards the limit.',
  'not-configured': 'AI generation is not configured. Ask the administrator to check the AI connection.',
  disabled: 'AI marketing generation is temporarily paused.',
  'not-ready': 'This brand is inactive, restricted or missing key details. Review brand settings.',
  invalid: 'That brand or plan is unavailable in this workspace.',
  stale: 'The brand or plan changed. The previous suggestion cannot be saved until refreshed.',
  limit: 'AI generation limit reached: one attempt per brand per UTC day, six per workspace per day and 40 per month.',
  'post-limit': 'Your workspace has reached its monthly post limit.',
  'already-saved': 'This draft was already saved; it will not be recreated if removed.',
};

export default async function MarketingDirectorPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId);
  await requirePaidWorkspaceAccess(session.workspaceId);
  const [params, allBrands, ownerPilot] = await Promise.all([
    searchParams, getWorkspaceBrands(session.workspaceId), canImportPilotPortfolio(),
  ]);
  const brands = rankDirectorBrands(allBrands, ownerPilot);
  const selected = brands.find(brand => brand.id === params.brandId) ?? brands.find(brand => !directorBrandEligibility(brand, ownerPilot)) ?? brands[0];
  const editable = ['owner', 'admin', 'editor'].includes(session.role);
  const saved = selected ? savedDirectorPlan(selected) : null;
  const current = Boolean(selected && saved && directorPlanIsCurrent(selected, saved));
  const eligibility = selected ? directorBrandEligibility(selected, ownerPilot) : null;
  const context = selected ? directorContext(selected) : null;
  const notice = typeof params.result === 'string' && Object.hasOwn(messages, params.result) ? messages[params.result] : null;
  const button = 'rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800';
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-teal-950 p-7 text-white">
        <div className="eyebrow !text-white/60">AI Marketing Director · first version</div>
        <h1 className="mt-3 text-3xl font-semibold">Know what to market next, without being a marketing expert.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">Choose a brand. Janeomi recommends a 30-day strategy, four practical weekly actions and a first LinkedIn draft based on your saved brand information. You approve every external action.</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
          <a href="/app/portfolio" className="underline">Portfolio</a>
          <a href="/app/weekly-plan" className="underline">Outstanding relationship actions</a>
          <a href="/app/leads" className="underline">Lead pipeline</a>
          <a href="/app/content" className="underline">Content studio</a>
        </div>
      </section>
      {notice ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">{notice}</div> : null}
      <section className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader><h2 className="font-semibold">Choose a brand</h2><p className="text-xs text-slate-500">Suggested order from launch stage {ownerPilot ? 'and your pilot priorities' : ''}; not a prediction of sales.</p></CardHeader>
          <CardContent className="space-y-2">
            {brands.map(brand => {
              const blocked = directorBrandEligibility(brand, ownerPilot);
              const existing = savedDirectorPlan(brand);
              return <a key={brand.id} href={'/app/marketing-director?brandId=' + encodeURIComponent(brand.id)} aria-current={selected?.id === brand.id ? 'page' : undefined} className={'block rounded-xl border p-3 text-sm ' + (selected?.id === brand.id ? 'border-teal-600 bg-teal-50' : 'border-slate-200')}>
                <div className="font-semibold">{brand.name}</div>
                <div className="mt-1 text-xs text-slate-600">{getMarketingStageDetails(directorContext(brand).stage).label} · {Number(brand.draftPosts)} drafts</div>
                <div className="mt-1 text-xs text-slate-600">{blocked ?? (existing && directorPlanIsCurrent(brand, existing) ? 'Plan ready' : 'Needs a strategy')}</div>
              </a>;
            })}
            {!brands.length ? <a className="text-sm underline" href="/app/brands">Create your first brand</a> : null}
          </CardContent>
        </Card>
        {selected && context ? <div className="space-y-5">
          <Card>
            <CardHeader><h2 className="text-xl font-semibold">{selected.name} · brand knowledge</h2><p className="text-sm text-slate-600">{getMarketingStageDetails(context.stage).guidance}</p></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><strong>Audience:</strong> {context.audience || 'Not yet set'}</p>
              <p><strong>Offer / CTA:</strong> {context.offer || context.primaryCta || 'Not yet set'}</p>
              <p><strong>Tone:</strong> {context.tone || 'Not yet set'}</p>
              {context.positioning ? <p><strong>Product context:</strong> {context.positioning}</p> : null}
              {context.website ? <p><strong>Website (not verified by AI):</strong> {context.website}</p> : null}
              <a className="inline-block underline" href={'/app/brands?brandId=' + encodeURIComponent(selected.id)}>Edit brand knowledge</a>
              {eligibility ? <p className="text-amber-800">{eligibility}</p> : editable ? <form action={generateDirectorPlan} className="space-y-2 rounded-xl bg-slate-50 p-3">
                <input type="hidden" name="brandId" value={selected.id}/>
                <p className="text-xs text-slate-600">Generate using saved brand marketing fields only, sent to the AI provider. Do not put personal, client, financial, health or pupil data in those fields. One attempt per brand per UTC day; six per workspace per day; 40 per month. No automatic external activity.</p>
                <button className={button} type="submit">{saved ? 'Refresh 30-day strategy' : 'Generate 30-day strategy'}</button>
              </form> : <p className="text-xs text-slate-500">An owner, administrator or editor can generate plans.</p>}
            </CardContent>
          </Card>
          {saved ? <Card>
            <CardHeader><h2 className="text-xl font-semibold">30-day recommended strategy</h2><p className="text-xs text-slate-500">AI proposal generated {new Date(saved.generatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}. Not live market research or recorded performance.</p></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {!current ? <p className="rounded-xl bg-amber-50 p-3 text-amber-900">This plan is older than 30 days or the brand details changed. Refresh before creating a draft.</p> : null}
              <p><strong>Objective:</strong> {saved.plan.objective}</p>
              <p><strong>Positioning:</strong> {saved.plan.positioning}</p>
              <p><strong>Recommended channel:</strong> {saved.plan.channel} — {saved.plan.rationale}</p>
              <div className="grid gap-3 sm:grid-cols-2">{saved.plan.weeks.map((week, index) => <div key={index} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold text-teal-800">Week {index + 1}</p><h3 className="font-semibold">{week.theme}</h3>
                <p className="mt-2">{week.action}</p><p className="mt-2 text-xs text-slate-600"><strong>Measure:</strong> {week.measure}</p>
              </div>)}</div>
              <div className="rounded-xl bg-amber-50 p-3 text-amber-950"><strong>Verify before acting</strong><ul className="mt-2 list-disc space-y-1 pl-5">{saved.plan.evidenceToVerify.map((check, index) => <li key={index}>{check}</li>)}</ul></div>
              <div className="rounded-xl bg-teal-50 p-3"><strong>Your next decision:</strong> {saved.plan.ownerAction}</div>
              <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">First LinkedIn draft · not approved</h3>
                <p className="mt-2 font-medium">{saved.plan.firstDraft.title}</p><p className="mt-2 whitespace-pre-wrap">{saved.plan.firstDraft.body}</p>
                {current && !eligibility && editable ? <form className="mt-4" action={saveDirectorDraft}>
                  <input type="hidden" name="brandId" value={selected.id}/><input type="hidden" name="planId" value={saved.id}/>
                  <button type="submit" className={button}>Save draft and open Content Studio</button>
                  <p className="mt-2 text-xs text-slate-500">Saving does not approve, schedule, publish or send anything. Repeated clicks open the same saved post.</p>
                </form> : null}
              </div>
            </CardContent>
          </Card> : <Card><CardContent><p className="py-4 text-sm text-slate-600">Generate a strategy to see your recommended priorities, weekly actions and first review-ready draft.</p></CardContent></Card>}
        </div> : null}
      </section>
    </div>
  );
}
