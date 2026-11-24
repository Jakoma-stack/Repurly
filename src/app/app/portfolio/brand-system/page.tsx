import { redirect } from 'next/navigation';
import Image from 'next/image';
import { requireWorkspaceRole, requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { getWorkspaceBrands } from '@/server/queries/brands';
import { portfolioBrandKnowledge, matchPortfolioBrand, PORTFOLIO_BRAND_VERSION } from '@/lib/marketing/portfolio-brand-knowledge';
import { applyPortfolioBrandKnowledge } from '@/server/actions/portfolio-brand-knowledge';

export default async function BrandSystem({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId);
  await requirePaidWorkspaceAccess(session.workspaceId);
  if (!(await canImportPilotPortfolio())) redirect('/app/portfolio');
  const [brands, params] = await Promise.all([getWorkspaceBrands(session.workspaceId), searchParams]);
  const canApply = ['owner', 'admin'].includes(session.role);
  return <main className="space-y-6">
    <header className="rounded-2xl bg-slate-950 p-6 text-white">
      <p className="text-sm text-white/80">Private portfolio brand review · {PORTFOLIO_BRAND_VERSION}</p>
      <h1 className="mt-2 text-3xl font-semibold">Jakoma brand system</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6">These are proposed commercial identities and visual assets. Trademark, domain and handle clearance is outstanding. Public names, domains, drafts, publishing destinations and subscriptions remain unchanged.</p>
      <a href="/app/portfolio" className="mt-4 inline-block underline">Back to portfolio</a>
    </header>
    {typeof params.updated === 'string' && /^\d+$/.test(params.updated) ? <p role="status" className="rounded-xl border border-slate-200 p-4">{params.updated} existing active brand knowledge records updated. Names and posts were not changed.</p> : null}
    {canApply ? <form action={applyPortfolioBrandKnowledge} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Apply marketing knowledge only</h2>
      <p className="text-sm leading-6">Update positioning, voice, campaign objectives and safe-claim boundaries for matching existing brands. This does not rename anything, create new brands, modify drafts or permit research projects to be promoted.</p>
      <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Apply to matching active brands</button>
    </form> : null}
    <section aria-label="Brand identities" className="grid gap-4 xl:grid-cols-2">
      {portfolioBrandKnowledge.map(profile => {
        const matches = brands.filter(brand => matchPortfolioBrand(brand)?.slug === profile.slug);
        const saved = matches.some(brand => brand.metadata?.portfolioMarketingKnowledge && typeof brand.metadata.portfolioMarketingKnowledge === 'object' && (brand.metadata.portfolioMarketingKnowledge as Record<string, unknown>).version === PORTFOLIO_BRAND_VERSION);
        return <article key={profile.slug} className="rounded-2xl border border-slate-200 p-5" style={{backgroundColor:profile.surface,color:profile.ink}}>
          <div className="flex items-center gap-3"><Image src={'/brand/'+profile.slug+'/mark.svg'} width={48} height={48} alt="" unoptimized/><div><h2 className="text-xl font-semibold">{profile.name}</h2><p className="text-sm">{profile.tag}</p></div></div>
          <p className="mt-4 font-semibold">{profile.desc}</p>
          <dl className="mt-3 space-y-2 text-sm leading-6">
            <div><dt className="font-semibold">Audience</dt><dd>{profile.audience}</dd></div>
            <div><dt className="font-semibold">Voice</dt><dd>{profile.voice}</dd></div>
            <div><dt className="font-semibold">Next objective</dt><dd>{profile.objective}</dd></div>
            <div><dt className="font-semibold">Claims and safety</dt><dd>{profile.guardrails}</dd></div>
            <div><dt className="font-semibold">Candidate domain and handle</dt><dd>{profile.domain} · @{profile.handle} ({profile.domainStatus}; {profile.handleStatus})</dd></div>
            <div><dt className="font-semibold">Saved marketing knowledge</dt><dd>{saved ? 'Version applied to a matching record' : matches.length ? 'Matching record found; not yet applied' : 'No matching saved record; registry only'}</dd></div>
            <div><dt className="font-semibold">Publication status</dt><dd>{profile.stage === 'research_only' ? 'Research only — no active campaigns' : 'Review only — existing approved public identity remains in use'}</dd></div>
          </dl>
        </article>;
      })}
    </section>
  </main>;
}
