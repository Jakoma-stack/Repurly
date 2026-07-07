import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { saveOpportunitySettings } from '@/server/actions/brands';
import { getOpportunitySettingsSnapshot } from '@/server/queries/opportunity';

type OpportunityDeskSettings = {
  offer?: string;
  idealCustomers?: string[];
  warmSignals?: string[];
  ignoreSignals?: string[];
  dmPolicy?: string;
  contentLanes?: string[];
  noGoTopics?: string[];
  relationshipRules?: string[];
};

function lines(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.map(String).join('\n');
  return fallback.join('\n');
}

function readSettings(metadata: Record<string, unknown>): OpportunityDeskSettings {
  const value = metadata.opportunityDesk;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as OpportunityDeskSettings;
  return {};
}

function readinessScore(settings: OpportunityDeskSettings) {
  const checks = [
    Boolean(settings.offer?.trim()),
    Boolean(settings.idealCustomers?.length),
    Boolean(settings.warmSignals?.length),
    Boolean(settings.ignoreSignals?.length),
    Boolean(settings.dmPolicy?.trim()),
    Boolean(settings.contentLanes?.length),
    Boolean(settings.noGoTopics?.length),
    Boolean(settings.relationshipRules?.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

const consultantTemplate = {
  offer: 'Define your primary paid offer, discovery call or pilot. Example: Fixed-fee diagnostic, readiness sprint, advisory retainer or implementation support.',
  idealCustomers: ['Senior decision-makers with budget or influence', 'Warm referral partners', 'People who repeatedly engage with your core topic', 'Prospects who describe a specific operational/commercial problem'],
  warmSignals: ['Specific comment or question', 'Repeated engagement over time', 'Relevant new follower with ICP fit', 'Partner/referral context', 'Clear pain point or need', 'Request for a framework, checklist or example'],
  ignoreSignals: ['Profile view only', 'Generic like or reaction', 'Great post with no context', 'Irrelevant audience', 'Connection request with no fit', 'People looking for automation shortcuts'],
  contentLanes: ['Repeat themes that create specific comments or senior attention', 'Turn real questions into practical posts', 'Stay close to the offer and buyer problem', 'Use proof, frameworks and operating examples'],
  dmPolicy: 'Do not suggest DMs from profile views, weak reactions or generic likes. Suggest DM only after repeated engagement, clear relevance, an existing relationship or a natural reason.',
  noGoTopics: ['Do not pitch from weak signals', 'Do not recommend risky LinkedIn automation', 'Do not drift into generic tips unrelated to the offer'],
  relationshipRules: ['Reply publicly to meaningful comments first', 'Review new relevant followers before outreach', 'Track partner/referral signals separately from sales leads', 'No DM yet is a valid recommendation', 'Log all warm signals before follow-up'],
};

export default async function OpportunitySettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const params = await searchParams;
  const ok = Array.isArray(params.ok) ? params.ok[0] : params.ok;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const brands = await getOpportunitySettingsSnapshot(session.workspaceId);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-indigo-950 p-6 text-white">
        <div className="eyebrow !text-white/50">Opportunity settings</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Teach Repurly who matters, when to reply and when not to DM</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">
          These settings are the self-serve quality layer. A 10/10 Daily Agent needs to know the offer, ICP, warm signals, ignore signals, content lanes and DM rules before users judge output quality.
        </p>
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/8 p-3">1. Define what you sell</div>
          <div className="rounded-2xl border border-white/10 bg-white/8 p-3">2. Define who matters</div>
          <div className="rounded-2xl border border-white/10 bg-white/8 p-3">3. Define when not to DM</div>
        </div>
      </section>

      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Opportunity settings saved.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">Something needs attention: {error}.</div> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="space-y-6">
          {brands.map((brand) => {
            const settings = readSettings(brand.metadata);
            const score = readinessScore(settings);
            return (
              <Card key={brand.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{brand.name}</h2>
                      <p className="text-sm text-muted-foreground">Configure offer, audience, warm signals, no-DM policy and content lanes for this brand.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Setup {score}%</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form action={saveOpportunitySettings} className="space-y-4">
                    <input type="hidden" name="workspaceId" value={session.workspaceId} />
                    <input type="hidden" name="brandId" value={brand.id} />
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      Main offer / commercial next step
                      <textarea name="offer" defaultValue={settings.offer ?? consultantTemplate.offer} className="min-h-[90px] rounded-2xl border border-border px-4 py-3 text-sm" />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Ideal customers / partners
                        <textarea name="idealCustomers" defaultValue={lines(settings.idealCustomers, consultantTemplate.idealCustomers)} className="min-h-[140px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Warm signals
                        <textarea name="warmSignals" defaultValue={lines(settings.warmSignals, consultantTemplate.warmSignals)} className="min-h-[140px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Ignore / monitor signals
                        <textarea name="ignoreSignals" defaultValue={lines(settings.ignoreSignals, consultantTemplate.ignoreSignals)} className="min-h-[140px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Content lanes
                        <textarea name="contentLanes" defaultValue={lines(settings.contentLanes, consultantTemplate.contentLanes)} className="min-h-[140px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      DM policy
                      <textarea name="dmPolicy" defaultValue={settings.dmPolicy ?? consultantTemplate.dmPolicy} className="min-h-[90px] rounded-2xl border border-border px-4 py-3 text-sm" />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        No-go topics
                        <textarea name="noGoTopics" defaultValue={lines(settings.noGoTopics, consultantTemplate.noGoTopics)} className="min-h-[120px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Relationship rules
                        <textarea name="relationshipRules" defaultValue={lines(settings.relationshipRules, consultantTemplate.relationshipRules)} className="min-h-[120px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                    </div>
                    <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Save opportunity settings</button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Sellable onboarding checklist</h2>
            <p className="text-sm text-muted-foreground">Use this before adding any beta customer.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            {[
              'Define what they sell and what a good commercial signal looks like.',
              'Define when Repurly should say no DM yet.',
              'Add their top 5 content lanes and no-go topics.',
              'Add known important relationships or partner conversations.',
              'Run one sample Daily Agent session before charging.',
              'Show the user the no-DM discipline section so expectations are clear.',
              'Review outputs after three real LinkedIn days.',
              'Check Proof Score before treating the workspace as beta-ready.',
            ].map((item) => <div key={item} className="rounded-2xl bg-slate-50 p-3">{item}</div>)}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
