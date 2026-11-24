import { requireWorkspaceSession, requireWorkspaceRole } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { redirect } from 'next/navigation';
import { fictionalCommunityMetrics, summariseCommunityMetrics, communityReviewSuggestions } from '@/lib/linkedin/community-demo';

export default async function CommunityPage() {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId, ['owner', 'admin']);
  await requirePaidWorkspaceAccess(session.workspaceId);
  if (!(await canImportPilotPortfolio())) redirect('/app/portfolio');
  const summary = summariseCommunityMetrics(fictionalCommunityMetrics);
  return <main className="space-y-6">
    <header className="rounded-3xl bg-[#102D32] p-6 text-white">
      <p className="text-sm text-[#A7E7CC]">Janeomi · LinkedIn integration rehearsal</p>
      <h1 className="mt-2 text-3xl font-semibold">Community intelligence</h1>
      <p className="mt-3 text-sm">Development access application submitted; approval not verified. Live retrieval is disabled. All figures below are fictional and do not describe Jakoma or any actual LinkedIn activity.</p>
    </header>
    <section className="grid gap-3 sm:grid-cols-3">
      {Object.entries({ Impressions: summary.impressions, Reactions: summary.reactions, Comments: summary.comments }).map(([label,value]) => <article key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm">{label} (fictional)</p><p className="text-3xl font-semibold">{value}</p></article>)}
    </section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Example topic performance</h2>
      <p className="mt-2 text-sm">Interaction rate = reactions plus comments divided by impressions. Not LinkedIn's official engagement metric; zero-impression posts are excluded from ranking.</p>
      <ul className="mt-4 space-y-3">{summary.ranked.map(row => <li key={row.id} className="rounded-xl bg-slate-50 p-3">{row.topic}: {row.interactionRate.toFixed(1)}%</li>)}</ul>
    </section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Example review queue</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{communityReviewSuggestions(fictionalCommunityMetrics).map(item => <li key={item}>{item}</li>)}</ul>
      <p className="mt-4 text-sm">These are deterministic rehearsal suggestions, not AI-generated or live recommendations. Nothing is sent, stored in the CRM or published.</p>
      <a className="mt-4 inline-block underline" href="/app/marketing-director">Open existing Marketing Director</a>
    </section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Live activation gates</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm"><li>Confirm developer approval and approved scopes.</li><li>Configure separate Janeomi OAuth credentials without replacing the existing publishing integration.</li><li>Verify organisation access and permitted API endpoints, retention, deletion and AI processing restrictions.</li><li>Test permission errors, rate limits, workspace isolation and explicit approval before enabling live sync.</li></ul>
    </section>
  </main>;
}
