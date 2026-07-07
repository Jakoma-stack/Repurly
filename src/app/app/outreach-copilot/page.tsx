import { CalendarClock, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import {
  createOutreachProspect,
  regenerateOutreachDrafts,
  updateOutreachProspect,
} from '@/server/actions/outreach-copilot';
import { getOutreachCopilotSnapshot } from '@/server/queries/outreach-copilot';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Snapshot = Awaited<ReturnType<typeof getOutreachCopilotSnapshot>>;
type Prospect = Snapshot['prospects'][number];
type DraftKey = 'connectionNote' | 'firstMessage' | 'publicComment' | 'followUp' | 'referralAsk';

const stages = ['new', 'contacted', 'qualified', 'nurture', 'closed'] as const;
const channels = ['linkedin', 'facebook', 'email', 'website', 'phone', 'manual'] as const;
const offers = [
  'AI/Data Governance Triage',
  'AI Governance & Readiness Sprint',
  'Repurly LinkedIn Ops Pilot',
  'Home / Property Technology Review',
  'Referral Partner',
  'General',
] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function decisionClasses(decision?: string) {
  if (decision === 'send_now') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (decision === 'warm_up_first') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (decision === 'save_for_later') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-rose-200 bg-rose-50 text-rose-900';
}

function decisionLabel(decision?: string) {
  if (decision === 'send_now') return 'Send now';
  if (decision === 'warm_up_first') return 'Warm up first';
  if (decision === 'save_for_later') return 'Save for later';
  return 'Skip';
}

function MetricCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
        <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function DraftBox({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-900">{label}</label>
      <textarea
        readOnly
        value={value ?? ''}
        className="mt-2 min-h-[110px] w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700"
      />
      <div className="mt-1 text-xs text-muted-foreground">Copy manually. Repurly does not auto-send or scrape.</div>
    </div>
  );
}

function ProspectCard({ lead, workspaceId }: { lead: Prospect; workspaceId: string }) {
  const metadata = lead.outreach;
  const drafts = metadata.messageDrafts;
  const draftEntries: Array<[DraftKey, string]> = [
    ['connectionNote', 'Connection note'],
    ['firstMessage', 'First message'],
    ['publicComment', 'Public comment'],
    ['followUp', 'Follow-up'],
    ['referralAsk', 'Referral ask'],
  ];

  return (
    <div className="rounded-[1.5rem] border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-950">{lead.leadName}</h3>
            {lead.leadHandle ? <span className="text-sm text-muted-foreground">{lead.leadHandle}</span> : null}
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${decisionClasses(metadata.decision)}`}>
              {decisionLabel(metadata.decision)}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {metadata.channel ?? 'manual'} - {metadata.offerFit ?? 'General'} - {lead.intentScore}/100
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">{metadata.whyRelevant || lead.notes || 'No relevance note stored yet.'}</p>
          {metadata.sourceUrl ? (
            <a className="mt-2 inline-flex text-sm font-medium text-primary" href={metadata.sourceUrl} target="_blank" rel="noreferrer">
              Open source
            </a>
          ) : null}
        </div>
        <form action={regenerateOutreachDrafts}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="leadId" value={lead.id} />
          <button className="rounded-2xl border border-border px-3 py-2 text-sm font-medium">Regenerate drafts</button>
        </form>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-slate-50 p-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Why Repurly scored it this way</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {(metadata.scoreBreakdown ?? []).map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
            {metadata.guardrailNote ?? 'Human-approved only: no scraping, no auto-DMs, no fake engagement.'}
          </div>
          <form action={updateOutreachProspect} className="space-y-3">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="leadId" value={lead.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-900">Stage</label>
                <select name="stage" defaultValue={lead.stage} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                  {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Next action date</label>
                <input name="nextActionDate" type="date" defaultValue={metadata.nextActionDate ?? todayIsoDate()} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900">Next action</label>
              <textarea name="nextAction" defaultValue={lead.nextAction ?? ''} className="mt-2 min-h-[84px] w-full rounded-2xl border border-border px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900">Last outcome</label>
              <input name="lastOutcome" defaultValue={metadata.lastOutcome ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Comment left, contact form sent, reply received..." />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900">Notes</label>
              <textarea name="notes" defaultValue={lead.notes ?? ''} className="mt-2 min-h-[84px] w-full rounded-2xl border border-border px-4 py-3 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="markContacted" value="yes" /> Mark this human-approved action as done
            </label>
            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Update queue item</button>
          </form>
        </div>

        <div className="space-y-4">
          {drafts ? draftEntries.map(([key, label]) => <DraftBox key={key} label={label} value={drafts[key]} />) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No drafts yet. Use regenerate drafts.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function OutreachCopilotPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const params = await searchParams;
  const ok = firstParam(params.ok);
  const error = firstParam(params.error);
  const data = await getOutreachCopilotSnapshot(session.workspaceId);
  const queue = data.queue.slice(0, 8);

  return (
    <div className="space-y-6">
      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Outreach Copilot updated.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">Something was missing or invalid. Check the form and try again.</div> : null}

      <section className="premium-dark overflow-hidden p-7">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <div className="eyebrow !text-white/50">Repurly Outreach Copilot</div>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Human-approved outreach without scraping, auto-DMs, or staring at a blank message box.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 md:text-base">
              Add prospects or pages manually, score the fit, generate channel-safe drafts, and work a daily queue with next action dates.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/68">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Manual inputs only</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Human-approved send</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Daily queue</div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <UserPlus className="size-5 text-cyan-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{data.metrics.prospectsTotal}</div>
              <div className="mt-1 text-sm text-white/72">Manual prospects captured</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <CalendarClock className="size-5 text-indigo-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{data.metrics.queueToday}</div>
              <div className="mt-1 text-sm text-white/72">Actions due today</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <Sparkles className="size-5 text-violet-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{data.metrics.draftsReady}</div>
              <div className="mt-1 text-sm text-white/72">Leads with drafts ready</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <ShieldCheck className="size-5 text-emerald-300" />
              <div className="mt-4 text-2xl font-semibold text-white">0</div>
              <div className="mt-1 text-sm text-white/72">Automated sends allowed</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Send now" value={data.metrics.sendNow} hint="Strongest manual actions" />
        <MetricCard label="Warm up first" value={data.metrics.warmUp} hint="Comment or follow before a message" />
        <MetricCard label="Overdue" value={data.metrics.overdue} hint="Needs a next action update" />
        <MetricCard label="Queue today" value={data.metrics.queueToday} hint="Work these before searching more" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Add a prospect or page</h2>
            <p className="text-sm text-muted-foreground">Manual capture only. Paste a URL, explain why they fit, and Repurly creates the safe action and drafts.</p>
          </CardHeader>
          <CardContent>
            <form action={createOutreachProspect} className="space-y-4">
              <input type="hidden" name="workspaceId" value={session.workspaceId} />
              <div>
                <label className="text-sm font-medium text-slate-900">Brand</label>
                <select name="brandId" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                  <option value="">No brand</option>
                  {data.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Name or page</label>
                  <input name="leadName" required className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="P&S Property Services" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Handle or URL label</label>
                  <input name="leadHandle" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="@handle or page" />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Channel</label>
                  <select name="channel" defaultValue="linkedin" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    {channels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Offer fit</label>
                  <select name="offerFit" defaultValue="AI/Data Governance Triage" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    {offers.map((offer) => <option key={offer} value={offer}>{offer}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Source</label>
                  <input name="source" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="LinkedIn search, Facebook page, referral..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Source URL</label>
                  <input name="sourceUrl" type="url" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="https://..." />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Relationship signal</label>
                  <input name="relationship" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="warm, mutual, cold, commented, asked..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Role or business type</label>
                  <input name="roleOrBusinessType" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Director, agency owner, property services..." />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Sector</label>
                <input name="sector" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="SME, charity, care, housing, property, agency..." />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Why relevant</label>
                <textarea name="whyRelevant" className="mt-2 min-h-[100px] w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="They mention outdoor sockets and lighting; possible referrals for cameras, Wi-Fi and smart lighting." />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Next action date</label>
                <input name="nextActionDate" type="date" defaultValue={todayIsoDate()} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Notes</label>
                <textarea name="notes" className="mt-2 min-h-[84px] w-full rounded-2xl border border-border px-4 py-3 text-sm" />
              </div>
              <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Score and draft</button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Today&apos;s outreach queue</h2>
            <p className="text-sm text-muted-foreground">Work these before adding more contacts. Actions are reminders and drafts, not automated sending.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {queue.length ? queue.map((lead) => <ProspectCard key={lead.id} lead={lead} workspaceId={session.workspaceId} />) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No queue items due today. Add five prospects or move a saved lead to today.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">All Outreach Copilot prospects</h2>
          <p className="text-sm text-muted-foreground">A lightweight manual pipeline using the existing Repurly lead table plus Outreach Copilot metadata.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.prospects.length ? data.prospects.map((lead) => {
            const metadata = lead.outreach;
            return (
              <div key={lead.id} className="rounded-2xl border border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{lead.leadName}</div>
                    <div className="text-sm text-muted-foreground">{metadata.channel} - {metadata.offerFit} - next: {metadata.nextActionDate ?? 'not set'}</div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${decisionClasses(metadata.decision)}`}>{decisionLabel(metadata.decision)}</span>
                </div>
              </div>
            );
          }) : <div className="text-sm text-muted-foreground">No Outreach Copilot prospects yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
