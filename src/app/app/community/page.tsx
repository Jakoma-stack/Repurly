import { requireWorkspaceSession, requireWorkspaceRole } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { communityConfig } from '@/lib/linkedin/community-config';
import { communitySnapshot } from '@/lib/linkedin/community-connection';
import { connectCommunity, disconnectCommunity } from '@/server/actions/community';
import { redirect } from 'next/navigation';
import { fictionalCommunityMetrics, summariseCommunityMetrics, communityReviewSuggestions } from '@/lib/linkedin/community-demo';

export default async function CommunityPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId, ['owner', 'admin']);
  await requirePaidWorkspaceAccess(session.workspaceId);
  if (!(await canImportPilotPortfolio())) redirect('/app/portfolio');
  const params=await searchParams;
  const config=communityConfig();
  const live=config && params.refresh==='yes' ? await communitySnapshot(session.workspaceId) : null;
  const summary = summariseCommunityMetrics(fictionalCommunityMetrics);
  return <main className="space-y-6">
    <header className="rounded-3xl bg-[#102D32] p-6 text-white">
      <p className="text-sm text-[#A7E7CC]">Janeomi · LinkedIn integration rehearsal</p>
      <h1 className="mt-2 text-3xl font-semibold">Community intelligence</h1>
      <p className="mt-3 text-sm">The development integration is disabled until explicitly configured following approval. Example figures below are fictional and do not describe Jakoma.</p>
    </header>
    <section className="rounded-2xl border bg-white p-5 space-y-3">
      <h2 className="text-xl font-semibold">Separate LinkedIn connection</h2>
      <p className="text-sm">{config?'Development connection enabled by administrator.':'Awaiting approved access and configuration.'}</p>
      {typeof params.connection==='string' ? <p className="text-sm">Connection result: {params.connection}</p> : null}
      {config ? <><form action={connectCommunity}><button className="rounded-xl bg-teal-800 px-4 py-2 text-white">Authorise Community Management</button></form><a className="underline" href="/app/community?refresh=yes">Retrieve aggregate statistics</a></> : null}
      <form action={disconnectCommunity}><button className="underline">Disconnect and delete stored community token</button></form>
      {live ? <div><p>Live retrieval: {live.status}</p>{live.status==='ok' ? <dl>{Object.entries(live.metrics).map(([key,value])=><div key={key}>{key}: {value ?? 'Unavailable'}</div>)}</dl>:null}</div>:null}
    </section>
    <section className="grid gap-3 sm:grid-cols-3">
      {Object.entries({ Impressions: summary.impressions, Reactions: summary.reactions, Comments: summary.comments }).map(([label,value]) => <article key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm">{label} (fictional)</p><p className="text-3xl font-semibold">{value}</p></article>)}
    </section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Example topic performance</h2>
      <p className="mt-2 text-sm">Interaction rate = reactions plus comments divided by impressions. Not LinkedIn&apos;s official engagement metric; zero-impression posts are excluded from ranking.</p>
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
