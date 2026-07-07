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
          These settings are the product packaging layer that makes Repurly sellable for different consultants and expert-led businesses. They keep the Daily Agent practical, brand-safe and relationship-led.
        </p>
      </section>

      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Opportunity settings saved.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">Something needs attention: {error}.</div> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="space-y-6">
          {brands.map((brand) => {
            const settings = readSettings(brand.metadata);
            return (
              <Card key={brand.id}>
                <CardHeader>
                  <h2 className="text-xl font-semibold">{brand.name}</h2>
                  <p className="text-sm text-muted-foreground">Configure offer, audience, warm signals, no-DM policy and content lanes for this brand.</p>
                </CardHeader>
                <CardContent>
                  <form action={saveOpportunitySettings} className="space-y-4">
                    <input type="hidden" name="workspaceId" value={session.workspaceId} />
                    <input type="hidden" name="brandId" value={brand.id} />
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      Main offer / commercial next step
                      <textarea name="offer" defaultValue={settings.offer ?? 'Describe the primary offer, entry product, discovery route or pilot you want LinkedIn to support.'} className="min-h-[90px] rounded-2xl border border-border px-4 py-3 text-sm" />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Ideal customers / partners
                        <textarea name="idealCustomers" defaultValue={lines(settings.idealCustomers, ['Senior leaders or founders with a clear business problem', 'Relevant partner/referral relationships', 'People who show repeated, specific engagement'])} className="min-h-[140px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Warm signals
                        <textarea name="warmSignals" defaultValue={lines(settings.warmSignals, ['Specific comment or question', 'Repeated engagement over time', 'Relevant new follower with ICP fit', 'Partner/referral context', 'Clear pain point or need'])} className="min-h-[140px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Ignore / monitor signals
                        <textarea name="ignoreSignals" defaultValue={lines(settings.ignoreSignals, ['Profile view only', 'Generic like or reaction', 'Great post with no context', 'Irrelevant audience', 'Connection request with no fit'])} className="min-h-[140px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Content lanes
                        <textarea name="contentLanes" defaultValue={lines(settings.contentLanes, ['Repeat themes that create specific comments or senior attention', 'Turn real questions into practical posts', 'Stay close to the offer and buyer problem'])} className="min-h-[140px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      DM policy
                      <textarea name="dmPolicy" defaultValue={settings.dmPolicy ?? 'Do not suggest DMs from profile views, weak reactions or generic likes. Suggest DM only after repeated engagement, clear relevance, an existing relationship or a natural reason.'} className="min-h-[90px] rounded-2xl border border-border px-4 py-3 text-sm" />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        No-go topics
                        <textarea name="noGoTopics" defaultValue={lines(settings.noGoTopics, ['Do not drift into generic AI tips', 'Do not pitch from weak signals', 'Do not use risky LinkedIn automation language'])} className="min-h-[120px] rounded-2xl border border-border px-4 py-3 text-sm" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Relationship rules
                        <textarea name="relationshipRules" defaultValue={lines(settings.relationshipRules, ['Reply publicly to meaningful comments first', 'Review new relevant followers before outreach', 'Track partner/referral signals separately from sales leads', 'No DM yet is a valid recommendation'])} className="min-h-[120px] rounded-2xl border border-border px-4 py-3 text-sm" />
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
              'Review outputs after three real LinkedIn days.',
            ].map((item) => <div key={item} className="rounded-2xl bg-slate-50 p-3">{item}</div>)}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
