import { cookies } from 'next/headers';
import { ArrowRight, CheckCircle2, CircleAlert, ImageIcon, Layers3, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LocalDateTimeInput } from '@/components/workflow/local-datetime-input';
import { TimezoneOffsetField } from '@/components/workflow/timezone-offset-field';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import {
  clearRecentDrafts,
  clearSavedCampaign,
  generateAiCarouselAssets,
  generateAiDrafts,
  generateAiImageAssets,
  requestApproval,
  respondToApproval,
  saveCampaign,
  saveDraft,
  schedulePost,
} from '@/server/actions/workflow';
import { getLinkedInTargets, getPostForEditing, getPostsByIds, getRecentDrafts, getWorkspaceApproverOptions, getWorkspaceBrandOptions } from '@/server/queries/workflow';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type SavedCampaign = {
  workspaceId: string;
  brandId: string;
  brief: string;
  commercialGoal: string;
  postFormat: string;
  count: number;
  cadence: string;
  preferredTimeOfDay: string;
  campaignWindowDays: number;
  sourceMaterial: string;
  voiceNotes: string;
  blockedTerms: string;
  targetPlatforms: string;
  savedAt: string;
};

type NoticeKind = 'success' | 'error' | 'info';

type WorkflowNotice = {
  kind: NoticeKind;
  title: string;
  body: string;
};

const SAVED_CAMPAIGN_COOKIE = 'repurly_saved_campaign';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSavedCampaign(rawValue: string | undefined, workspaceId: string): SavedCampaign | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(Buffer.from(rawValue, 'base64url').toString('utf8')) as Partial<SavedCampaign>;
    if (parsed.workspaceId !== workspaceId) return null;

    return {
      workspaceId: parsed.workspaceId ?? workspaceId,
      brandId: parsed.brandId ?? '',
      brief: parsed.brief ?? '',
      commercialGoal: parsed.commercialGoal ?? '',
      postFormat: parsed.postFormat ?? 'auto',
      count: Number(parsed.count ?? 3),
      cadence: parsed.cadence ?? 'weekly',
      preferredTimeOfDay: parsed.preferredTimeOfDay ?? 'morning',
      campaignWindowDays: Number(parsed.campaignWindowDays ?? 30),
      sourceMaterial: parsed.sourceMaterial ?? '',
      voiceNotes: parsed.voiceNotes ?? '',
      blockedTerms: parsed.blockedTerms ?? '',
      targetPlatforms: parsed.targetPlatforms ?? 'linkedin',
      savedAt: parsed.savedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function getWorkflowNotice(ok?: string, error?: string): WorkflowNotice | null {
  if (ok === 'draft') {
    return {
      kind: 'success',
      title: 'Draft saved',
      body: 'The creative is still grounded in a real destination, so the next action can be approval or scheduling instead of rework.',
    };
  }

  if (ok === 'approval') {
    return {
      kind: 'success',
      title: 'Approval request created',
      body: 'Repurly kept the target in view so the reviewer can validate the exact destination, not just the copy.',
    };
  }

  if (ok === 'scheduled') {
    return {
      kind: 'success',
      title: 'Post added to the queue',
      body: 'The item is now scheduled against the selected target. Queue and reliability views will keep operators ahead of exceptions.',
    };
  }

  if (ok === 'generated') {
    return {
      kind: 'success',
      title: 'Draft batch created',
      body: 'Use the draft shortlist below to pick the strongest angle, then refine it in the studio.',
    };
  }

  if (ok === 'image-assets') {
    return {
      kind: 'success',
      title: 'AI image generated',
      body: 'Repurly saved a publishable image preview to the draft so you can test an image-first workflow before approval or scheduling.',
    };
  }

  if (ok === 'carousel-assets') {
    return {
      kind: 'success',
      title: 'AI carousel generated',
      body: 'Repurly saved a full carousel preview to the draft so the selected format is visible, testable, and ready for LinkedIn upload.',
    };
  }

  if (ok === 'campaign-saved') {
    return {
      kind: 'success',
      title: 'Campaign saved',
      body: 'Planner defaults are now saved for this workspace in this browser.',
    };
  }

  if (ok === 'campaign-cleared') {
    return {
      kind: 'success',
      title: 'Saved campaign cleared',
      body: 'Your planner defaults were removed for this workspace in this browser.',
    };
  }

  if (ok === 'approved') {
    return {
      kind: 'success',
      title: 'Approval recorded',
      body: 'The draft is now clearly approved and ready for scheduling.',
    };
  }

  if (ok === 'changes-requested') {
    return {
      kind: 'info',
      title: 'Changes requested',
      body: 'The draft moved back to draft so the next edit cycle is explicit.',
    };
  }

  if (ok === 'rejected') {
    return {
      kind: 'error',
      title: 'Approval rejected',
      body: 'The draft is no longer in review. Update it and request approval again when ready.',
    };
  }

  if (ok === 'drafts-cleared') {
    return {
      kind: 'success',
      title: 'Recent drafts cleared',
      body: 'Only draft posts for the selected brand were removed. In-review and scheduled items stayed intact.',
    };
  }

  if (ok === 'no-drafts') {
    return {
      kind: 'info',
      title: 'No draft backlog to clear',
      body: 'There were no other draft posts for the selected brand.',
    };
  }

  if (error === 'missing-brand') {
    return {
      kind: 'error',
      title: 'No active brand found',
      body: 'Create or reactivate a brand before drafting or generating content.',
    };
  }

  if (error === 'missing-target') {
    return {
      kind: 'error',
      title: 'Choose a publish destination first',
      body: 'Connect LinkedIn and pick a personal profile or company page before requesting approval or scheduling.',
    };
  }

  if (error === 'missing-schedule') {
    return {
      kind: 'error',
      title: 'Choose a publish time',
      body: 'Pick a scheduled publish time before sending the post into the queue.',
    };
  }

  if (error === 'media-brief-required') {
    return {
      kind: 'error',
      title: 'Media posts need visual direction',
      body: 'Add creative direction before requesting approval or scheduling image, carousel, or video posts.',
    };
  }

  if (error === 'generate-failed-save') {
    return {
      kind: 'error',
      title: 'Draft generation could not be saved',
      body: 'Repurly kept your campaign brief locally, but the generated drafts could not be written to the database. Retry now, or check the database connection and brand setup.',
    };
  }

  if (error === 'missing-assets') {
    return {
      kind: 'error',
      title: 'Generate the assets first',
      body: 'Image and carousel posts now require visible AI-generated or uploaded assets before approval or scheduling. No silent text fallback.',
    };
  }

  if (error === 'generate-failed') {
    return {
      kind: 'error',
      title: 'Draft generation failed',
      body: 'Repurly kept your campaign brief locally so you can retry immediately.',
    };
  }

  if (error === 'invalid') {
    return {
      kind: 'error',
      title: 'Something is missing',
      body: 'Check the required fields and try again.',
    };
  }

  return null;
}

function FloatingNotice({ kind, title, body }: WorkflowNotice) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : kind === 'info'
        ? 'border-sky-200 bg-sky-50 text-sky-950'
        : 'border-rose-200 bg-rose-50 text-rose-950';

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 w-full max-w-md">
      <div className={`pointer-events-auto rounded-3xl border px-5 py-4 shadow-lg shadow-slate-900/10 ${styles}`}>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-sm leading-6">{body}</p>
      </div>
    </div>
  );
}

function describeTargetType(targetType: string) {
  if (targetType === 'member' || targetType === 'profile') return 'Personal profile';
  if (targetType === 'organization' || targetType === 'page') return 'Company page';
  return targetType;
}

function readAiAssets(editingPost: Awaited<ReturnType<typeof getPostForEditing>>) {
  const raw = editingPost?.aiAssets;
  if (!raw || typeof raw !== 'object') return null;
  return raw as {
    generatedAt?: string;
    image?: { title?: string; caption?: string; prompt?: string; dataUri?: string };
    carousel?: { title?: string; prompt?: string; slides?: Array<{ index?: number; heading?: string; body?: string; dataUri?: string }> };
  };
}

function AssetPreview({ editingPost }: { editingPost: Awaited<ReturnType<typeof getPostForEditing>> }) {
  const assets = readAiAssets(editingPost);
  if (!assets?.image && !assets?.carousel) {
    return (
      <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-muted-foreground">
        No AI visuals yet. Use the buttons below to generate a branded image or a full carousel preview from this draft.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {assets.image ? (
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">AI image preview</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{assets.image.title || 'Generated image'}</div>
          {assets.image.caption ? <div className="mt-1 text-sm text-muted-foreground">{assets.image.caption}</div> : null}
          {assets.image.dataUri ? <img src={assets.image.dataUri} alt={assets.image.title || 'AI image preview'} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-100" /> : null}
        </div>
      ) : null}
      {assets.carousel ? (
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">AI carousel preview</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{assets.carousel.title || 'Generated carousel'}</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(assets.carousel.slides || []).map((slide, index) => (
              <div key={`${slide.index || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {slide.dataUri ? <img src={slide.dataUri} alt={slide.heading || `Slide ${index + 1}`} className="w-full rounded-xl border border-slate-200 bg-white" /> : null}
                <div className="mt-3 text-sm font-semibold text-slate-900">{slide.heading || `Slide ${index + 1}`}</div>
                {slide.body ? <div className="mt-1 text-xs leading-6 text-muted-foreground">{slide.body}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default async function ContentPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireWorkspaceSession();
  const params = await searchParams;
  const cookieStore = await cookies();
  const savedCampaign = parseSavedCampaign(cookieStore.get(SAVED_CAMPAIGN_COOKIE)?.value, session.workspaceId);

  const ok = firstParam(params.ok);
  const error = firstParam(params.error);
  const postId = firstParam(params.postId);
  const generatedIds = (firstParam(params.generatedIds) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const [targets, brandOptions, editingPost, approverOptions] = await Promise.all([
    getLinkedInTargets(session.workspaceId),
    getWorkspaceBrandOptions(session.workspaceId),
    getPostForEditing(session.workspaceId, postId ?? null),
    getWorkspaceApproverOptions(session.workspaceId),
  ]);

  const selectedBrandId =
    editingPost?.brandId ??
    savedCampaign?.brandId ??
    brandOptions.find((brand) => brand.status !== 'archived')?.id ??
    brandOptions[0]?.id ??
    '';

  const [recentDrafts, generatedBatch] = await Promise.all([
    getRecentDrafts(session.workspaceId, selectedBrandId || null),
    generatedIds.length ? getPostsByIds(session.workspaceId, generatedIds) : Promise.resolve([]),
  ]);

  const plannerBrief = savedCampaign?.brief ?? 'Write three LinkedIn posts for Repurly about why premium B2B teams need tighter approval, scheduling, and recovery workflows.';
  const plannerGoal = savedCampaign?.commercialGoal ?? 'Drive qualified demo requests';
  const plannerCount = savedCampaign?.count ?? 3;
  const plannerFormat = savedCampaign?.postFormat ?? 'auto';
  const plannerCadence = savedCampaign?.cadence ?? 'weekly';
  const plannerPreferredTime = savedCampaign?.preferredTimeOfDay ?? 'morning';
  const plannerWindowDays = savedCampaign?.campaignWindowDays ?? 30;
  const plannerSourceMaterial = savedCampaign?.sourceMaterial ?? '';
  const canRespondToApproval = ['owner', 'admin', 'approver'].includes(session.role);
  const companyPageTargets = targets.filter((target) => target.targetType === 'organization' || target.targetType === 'page');
  const personalTargets = targets.filter((target) => target.targetType === 'member' || target.targetType === 'profile');
  const selectedApproverValue = editingPost?.approvalOwner ?? approverOptions[0]?.value ?? 'Client lead';
  const plannerVoiceNotes = savedCampaign?.voiceNotes ?? '';
  const plannerBlockedTerms = savedCampaign?.blockedTerms ?? '';
  const plannerTargetPlatforms = savedCampaign?.targetPlatforms ?? 'linkedin';
  const notice = getWorkflowNotice(ok, error);
  const defaultTarget = targets.find((target) => target.isDefault) ?? targets[0] ?? null;
  const activeBrand = brandOptions.find((brand) => brand.id === selectedBrandId) ?? brandOptions[0] ?? null;

  return (
    <div className="space-y-6">
      {notice ? <FloatingNotice {...notice} /> : null}

      <section className="premium-dark overflow-hidden p-7">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <div className="eyebrow !text-white/50">Studio</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Premium creative workflow, built for approval control and publish confidence.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 md:text-base">
              Plan campaigns, generate strong starting points, shape the final post, and move it into approval or queue without leaving the same workflow surface.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/68">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">AI drafting</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Carousel-ready planning</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Approval and queue handoff</div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <Sparkles className="size-5 text-violet-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{recentDrafts.length}</div>
              <div className="mt-1 text-sm text-white/70">Recent draft items for the active brand</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <CheckCircle2 className="size-5 text-emerald-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{targets.length}</div>
              <div className="mt-1 text-sm text-white/70">Connected publish destinations currently available</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <Layers3 className="size-5 text-cyan-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{generatedBatch.length}</div>
              <div className="mt-1 text-sm text-white/70">AI-generated options in the current review pass</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <ShieldCheck className="size-5 text-indigo-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{activeBrand ? 'Ready' : 'Setup'}</div>
              <div className="mt-1 text-sm text-white/70">Brand context applied to planning, tone, and CTA</div>
            </div>
          </div>
        </div>
      </section>

      <Card id="campaign-planner" className="scroll-mt-24">
        <CardHeader>
          <div className="eyebrow">Campaign planner</div>
          <h2 className="mt-2 text-2xl font-semibold">Generate premium starting points, not generic filler</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The planner now uses brand memory, website grounding, source material, compliance constraints, and format selection to build a better campaign batch before you refine the final post.
          </p>
        </CardHeader>
        <CardContent>
          <form action={generateAiDrafts} className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <input type="hidden" name="workspaceId" value={session.workspaceId} />
            <input type="hidden" name="authorId" value={session.userId} />

            <div className="space-y-4 rounded-[1.75rem] border border-slate-200/80 p-5">
              <div>
                <label className="text-sm font-medium text-slate-900">Brand</label>
                <select name="brandId" defaultValue={selectedBrandId} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                  {brandOptions.map((brand) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tone, audience, CTA direction, hashtags, and brand website context are inherited from the selected brand.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-900">Campaign brief</label>
                <textarea name="brief" className="mt-2 min-h-[180px] w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={plannerBrief} required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Commercial goal</label>
                  <input name="commercialGoal" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={plannerGoal} required />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Cadence</label>
                  <select name="cadence" defaultValue={plannerCadence} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="twice-weekly">Twice weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Campaign window (days)</label>
                  <input name="campaignWindowDays" type="number" min={7} max={180} defaultValue={plannerWindowDays} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Target platforms</label>
                  <input name="targetPlatforms" defaultValue={plannerTargetPlatforms} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="linkedin" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-900">Source material to repurpose</label>
                <textarea name="sourceMaterial" className="mt-2 min-h-[120px] w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={plannerSourceMaterial} placeholder="Paste notes, transcript sections, newsletter copy, case study details, or a webinar summary" />
              </div>
            </div>

            <div className="space-y-4 rounded-[1.75rem] border border-slate-200/80 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Format</label>
                  <select name="postFormat" defaultValue={plannerFormat} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    <option value="auto">Auto-select best format</option>
                    <option value="text">Text post</option>
                    <option value="link">Link post</option>
                    <option value="image">Single image</option>
                    <option value="multi_image">Carousel / multi-image</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Draft count</label>
                  <input name="count" type="number" min={1} max={12} defaultValue={plannerCount} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-900">Preferred publishing window</label>
                <select name="preferredTimeOfDay" defaultValue={plannerPreferredTime} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                  <option value="early-morning">Early morning</option>
                  <option value="morning">Morning</option>
                  <option value="midday">Midday</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Voice notes</label>
                  <textarea name="voiceNotes" className="mt-2 min-h-[110px] w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={plannerVoiceNotes} placeholder="Senior, practical, premium, no hype, clear point of view" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Blocked terms</label>
                  <textarea name="blockedTerms" className="mt-2 min-h-[110px] w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={plannerBlockedTerms} placeholder="revolutionary, guaranteed, market-leading" />
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-violet-100 bg-violet-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-violet-950"><Wand2 className="size-4" /> Top-tier campaign guardrails</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-violet-900/80">
                  <li>• Use the selected brand, website, and source material to ground the draft.</li>
                  <li>• Plan the batch across different angles, funnel stages, and formats.</li>
                  <li>• Generate asset direction for carousel, image, and video ideas instead of text alone.</li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button formAction={generateAiDrafts}><Sparkles className="mr-2 size-4" />Generate drafts</Button>
                <Button formAction={saveCampaign} variant="outline">Save campaign defaults</Button>
                <Button formAction={clearSavedCampaign} variant="ghost" formNoValidate>Clear saved defaults</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {generatedBatch.length ? (
        <Card id="generated-drafts" className="scroll-mt-24">
          <CardHeader>
            <div className="eyebrow">Generated shortlist</div>
            <h2 className="mt-2 text-2xl font-semibold">Pick the strongest angle, then bring it into the studio</h2>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {generatedBatch.map((item) => {
              const metadata = (item.metadata as Record<string, unknown> | null) ?? null;
              const assetPlan = metadata?.assetPlan as Record<string, unknown> | undefined;
              const aiReview = metadata?.aiReview as Record<string, unknown> | undefined;
              return (
                <a key={item.id} href={`/app/content?postId=${item.id}#composer`} className="block rounded-[1.5rem] border border-slate-200/80 p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Draft {item.draftNumber || '—'}</div>
                    <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{item.postType.replace('_', ' ')}</div>
                  </div>
                  <div className="mt-3 text-lg font-semibold text-slate-950">{item.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                    {metadata?.angle ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{String(metadata.angle)}</span> : null}
                    {metadata?.funnelStage ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{String(metadata.funnelStage)}</span> : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.excerpt}</p>
                  {assetPlan ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                      <div className="font-semibold text-slate-900">Asset direction</div>
                      <div>Format: {String(assetPlan.format ?? item.postType).replace('_', ' ')}</div>
                      {assetPlan.carouselTitle ? <div>Carousel: {String(assetPlan.carouselTitle)}</div> : null}
                      {Array.isArray(assetPlan.carouselSlides) ? <div>Slides: {assetPlan.carouselSlides.length}</div> : null}
                      {assetPlan.videoHook ? <div>Video hook: {String(assetPlan.videoHook)}</div> : null}
                    </div>
                  ) : null}
                  {aiReview ? (
                    <div className="mt-4 text-xs leading-6 text-slate-500">
                      Fit: {String(aiReview.performanceFitScore ?? 'n/a')}/100 · Compliance: {String(aiReview.complianceRisk ?? 'none')}
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{item.brandName}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-primary">Open draft <ArrowRight className="size-4" /></span>
                  </div>
                </a>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card id="composer" className="scroll-mt-24">
        <CardHeader>
          <div className="eyebrow">Studio editor</div>
          <h2 className="mt-2 text-2xl font-semibold">Shape the final post for approval, scheduling, and reliable delivery</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This surface should feel premium to the creator while still keeping workflow, destination, and publish risk visible.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <input type="hidden" name="workspaceId" value={session.workspaceId} />
            <input type="hidden" name="authorId" value={session.userId} />
            <input type="hidden" name="postId" value={editingPost?.id ?? ''} />
            <TimezoneOffsetField />

            <div className="space-y-5 rounded-[1.75rem] border border-slate-200/80 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Brand</label>
                  <select name="brandId" defaultValue={selectedBrandId} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    {brandOptions.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Post type</label>
                  <select name="postType" defaultValue={editingPost?.postType ?? 'text'} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    <option value="text">Text</option>
                    <option value="link">Link</option>
                    <option value="image">Image</option>
                    <option value="multi_image">Carousel / multi-image</option>
                    <option value="video">Video</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-900">Post title</label>
                <input name="title" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={editingPost?.title ?? 'Q2 pipeline insight'} required />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-900">LinkedIn post copy</label>
                <textarea
                  name="body"
                  className="mt-2 min-h-[260px] w-full rounded-2xl border border-border px-4 py-3 text-sm leading-7"
                  defaultValue={editingPost?.body ?? 'A strong LinkedIn workflow is less about posting everywhere and more about getting the right post approved, scheduled, and recovered when something breaks.'}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Creative direction</label>
                  <textarea name="brief" className="mt-2 min-h-[120px] w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={editingPost?.brief ?? ''} placeholder="Hook, proof point, CTA, visual direction, or client notes" />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-900">Approval owner (optional)</label>
                    <select name="approvalOwner" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={selectedApproverValue}>
                      {approverOptions.map((option) => (
                        <option key={`${option.source}-${option.value}`} value={option.value}>{option.label} · {option.role}</option>
                      ))}
                      <option value="Client lead">Client lead</option>
                    </select>
                    <div className="mt-2 text-xs text-muted-foreground">{approverOptions.length ? `Approval can be tested with ${approverOptions.length} visible approver-capable member(s) or invite(s).` : 'No approver-capable members found yet. Add an owner, admin, or approver in Settings to test this flow.'}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-900">Scheduled publish time</label>
                    <LocalDateTimeInput
                      name="scheduledFor"
                      isoValue={editingPost?.scheduledForIso ?? ''}
                      className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-900">Hook quality</div>
                  <div className="mt-2 text-xs leading-6 text-muted-foreground">Lead with tension, surprise, or a commercially useful insight.</div>
                </div>
                <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-900">Carousel readiness</div>
                  <div className="mt-2 text-xs leading-6 text-muted-foreground">Use multi-image when the idea works better as a stepwise narrative.</div>
                </div>
                <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-900">Operator handoff</div>
                  <div className="mt-2 text-xs leading-6 text-muted-foreground">Keep the target, schedule, and approval owner obvious before queueing.</div>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Approval visibility</div>
                    <div className="mt-1 text-xs leading-6 text-muted-foreground">Make the reviewer and current approval state obvious before queueing the post.</div>
                  </div>
                  {editingPost?.approvalStatus ? <span className="rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">{editingPost.approvalStatus.replace('_', ' ')}</span> : null}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Approver</div>
                    <div className="mt-1 font-medium text-slate-900">{editingPost?.approvalOwner || selectedApproverValue || 'Needs owner'}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Latest response</div>
                    <div className="mt-1 font-medium text-slate-900">{editingPost?.latestResponseStatus ? editingPost.latestResponseStatus.replace('_', ' ') : 'No reviewer action yet'}</div>
                    {editingPost?.latestResponderId ? <div className="mt-1 text-xs text-muted-foreground">by {editingPost.latestResponderId}</div> : null}
                  </div>
                </div>
                {editingPost?.approvalRequestId && canRespondToApproval ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-950"><CheckCircle2 className="size-4" /> Approver test controls</div>
                    <div className="mt-1 text-xs leading-6 text-emerald-900/80">Use these to test the approver perspective without leaving the composer.</div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <input type="hidden" name="approvalRequestId" value={editingPost.approvalRequestId ?? ''} />
                      <input type="hidden" name="responderId" value={session.userId} />
                      <input name="approvalResponseNote" className="min-w-[260px] flex-1 rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm" placeholder="Optional reviewer note" defaultValue={editingPost?.latestResponseNote ?? ''} />
                      <Button formAction={respondToApproval} name="response" value="approve">Approve</Button>
                      <Button formAction={respondToApproval} name="response" value="changes_requested" variant="outline">Request changes</Button>
                      <Button formAction={respondToApproval} name="response" value="reject" variant="ghost">Reject</Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button formAction={saveDraft}>Save draft</Button>
                <Button formAction={generateAiImageAssets} variant="outline"><ImageIcon className="mr-2 size-4" />Generate AI image</Button>
                <Button formAction={generateAiCarouselAssets} variant="outline"><Layers3 className="mr-2 size-4" />Generate AI carousel</Button>
                <Button formAction={requestApproval} variant="outline">Request approval</Button>
                <Button formAction={schedulePost} variant="outline">Schedule post</Button>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[1.75rem] border border-slate-200/80 p-5">
                <div className="eyebrow">AI asset studio</div>
                <h3 className="mt-2 text-xl font-semibold">Generate visible image and carousel assets before queueing</h3>
                <p className="mt-2 text-sm text-muted-foreground">These previews are saved to the draft so you can test the format directly in the composer. Image and carousel posts now require visible assets before approval or scheduling.</p>
                <div className="mt-4">
                  <AssetPreview editingPost={editingPost} />
                </div>
              </div>
              <div id="target-selection" className="rounded-[1.75rem] border border-slate-200/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="eyebrow">Publish destination</div>
                    <h3 className="mt-2 text-xl font-semibold">Make the target explicit before approval or queueing</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Switch between your personal profile and company page here. The workspace default is preselected.</p>
                  </div>
                  {defaultTarget ? (
                    <div className="rounded-2xl border border-border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Default: <span className="font-medium text-slate-900">{defaultTarget.displayName}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3">
                  {targets.length ? targets.map((target) => {
                    const typeLabel = describeTargetType(target.targetType);
                    const isDefault = target.isDefault;
                    return (
                      <label key={target.id} className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3 text-sm transition hover:border-primary/30 hover:bg-slate-50">
                        <input type="radio" name="targetId" value={target.id} defaultChecked={editingPost?.targetId === target.id || (!editingPost?.targetId && target.isDefault)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-slate-900">{target.displayName}</div>
                            <span className="rounded-full border border-border bg-slate-50 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-500">{typeLabel}</span>
                            {isDefault ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700">Workspace default</span> : null}
                          </div>
                          <div className="text-muted-foreground">{target.handle || 'LinkedIn target'}</div>
                        </div>
                      </label>
                    );
                  }) : <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">No LinkedIn targets connected yet. Go to Channels setup first.</div>}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200/80 p-5">
                <div className="eyebrow">Publishing diagnostics</div>
                <h3 className="mt-2 text-xl font-semibold">Make hidden workflow state visible</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Personal targets</div>
                    <div className="mt-1 font-medium text-slate-900">{personalTargets.length}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Company page targets</div>
                    <div className="mt-1 font-medium text-slate-900">{companyPageTargets.length}</div>
                  </div>
                </div>
                {companyPageTargets.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <div className="flex items-center gap-2 font-medium"><CircleAlert className="size-4" /> No company pages are visible to this workspace yet</div>
                    <div className="mt-1 text-amber-900/80">Reconnect LinkedIn from Channels and confirm the signed-in member is an admin of the intended page.</div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.75rem] border border-slate-200/80 p-5">
                <div className="eyebrow">Creative parity roadmap inside the product</div>
                <h3 className="mt-2 text-xl font-semibold">What a premium post workflow should support</h3>
                <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 font-medium text-slate-900"><ImageIcon className="size-4" /> Visual system</div>
                    <div className="mt-1">Single image, carousel, and brand-consistent asset workflows should feel native, not bolted on.</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 font-medium text-slate-900"><Layers3 className="size-4" /> Workflow system</div>
                    <div className="mt-1">Approval, destination, queue state, and reliability should remain visible while the creator works.</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 font-medium text-slate-900"><Sparkles className="size-4" /> Quality system</div>
                    <div className="mt-1">Hooks, CTA strength, clarity, and platform fit need to be reviewed before publishing, not after underperformance.</div>
                  </div>
                </div>
              </div>

              <div id="recent-drafts" className="rounded-[1.75rem] border border-slate-200/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="eyebrow">Recent drafts</div>
                    <h3 className="mt-2 text-xl font-semibold">Fast access to in-flight work</h3>
                    <p className="mt-2 text-sm text-muted-foreground">This list only shows draft posts for the selected brand.</p>
                  </div>
                  <Button formAction={clearRecentDrafts} formNoValidate disabled={!recentDrafts.length} variant="outline">Clear recent drafts</Button>
                </div>
                <div className="mt-4 space-y-3">
                  {recentDrafts.length ? recentDrafts.map((item) => (
                    <a key={item.id} href={`/app/content?postId=${item.id}#composer`} className="block rounded-2xl border border-border px-4 py-3 text-sm transition hover:border-primary/30 hover:bg-slate-50">
                      <div className="font-medium text-slate-900">{item.title}</div>
                      <div className="mt-1 text-muted-foreground">{item.brandName} · {item.status}</div>
                    </a>
                  )) : <div className="text-sm text-muted-foreground">No draft backlog for this brand right now.</div>}
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
