import { cookies } from 'next/headers';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TimezoneOffsetField } from '@/components/workflow/timezone-offset-field';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import {
  clearRecentDrafts,
  clearSavedCampaign,
  generateAiDrafts,
  requestApproval,
  saveCampaign,
  saveDraft,
  schedulePost,
} from '@/server/actions/workflow';
import { getLinkedInTargets, getPostForEditing, getPostsByIds, getRecentDrafts, getWorkspaceBrandOptions } from '@/server/queries/workflow';

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
      postFormat: parsed.postFormat ?? 'text',
      count: Number(parsed.count ?? 3),
      cadence: parsed.cadence ?? 'weekly',
      preferredTimeOfDay: parsed.preferredTimeOfDay ?? 'morning',
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
      body: 'You are still anchored on publish destination so you can keep moving into approval or scheduling.',
    };
  }

  if (ok === 'approval') {
    return {
      kind: 'success',
      title: 'Approval request created',
      body: 'Destination selection stayed in view so you can confirm the right LinkedIn profile or company page.',
    };
  }

  if (ok === 'scheduled') {
    return {
      kind: 'success',
      title: 'Post added to the queue',
      body: 'Repurly saved the schedule and target selection. If it stays queued, check that your background publish worker is hitting /api/inngest on schedule.',
    };
  }

  if (ok === 'generated') {
    return {
      kind: 'success',
      title: 'Draft batch created',
      body: 'Review the generated ideas below, then open the strongest one in the composer.',
    };
  }

  if (ok === 'campaign-saved') {
    return {
      kind: 'success',
      title: 'Campaign saved',
      body: 'These planner defaults are now stored for this workspace in this browser.',
    };
  }

  if (ok === 'campaign-cleared') {
    return {
      kind: 'success',
      title: 'Saved campaign cleared',
      body: 'Your planner defaults were removed for this workspace in this browser.',
    };
  }

  if (ok === 'drafts-cleared') {
    return {
      kind: 'success',
      title: 'Recent drafts cleared',
      body: 'Only draft posts for the selected brand were removed. Scheduled and in-review items were left alone.',
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
      title: 'Choose a LinkedIn destination first',
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

  if (error === 'generate-failed-save') {
    return {
      kind: 'error',
      title: 'Draft generation could not be saved',
      body: 'Repurly kept your campaign brief locally, but the generated drafts could not be written to the database. Retry now, or check your database connection and brand setup.',
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

  const [targets, brandOptions, editingPost] = await Promise.all([
    getLinkedInTargets(session.workspaceId),
    getWorkspaceBrandOptions(session.workspaceId),
    getPostForEditing(session.workspaceId, postId ?? null),
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

  const plannerBrief = savedCampaign?.brief ?? 'Write three LinkedIn posts for Repurly about why premium B2B teams need tighter approval, scheduling, and recovery workflows on LinkedIn.';
  const plannerGoal = savedCampaign?.commercialGoal ?? 'Drive qualified demo requests';
  const plannerCount = savedCampaign?.count ?? 3;
  const plannerFormat = savedCampaign?.postFormat ?? 'text';
  const plannerCadence = savedCampaign?.cadence ?? 'weekly';
  const plannerPreferredTime = savedCampaign?.preferredTimeOfDay ?? 'morning';
  const notice = getWorkflowNotice(ok, error);
  const defaultTarget = targets.find((target) => target.isDefault) ?? targets[0] ?? null;

  return (
    <div className="space-y-6">
      {notice ? <FloatingNotice {...notice} /> : null}

      <Card id="campaign-planner" className="scroll-mt-24">
        <CardHeader>
          <h2 className="text-xl font-semibold">AI campaign planner</h2>
          <p className="text-sm text-muted-foreground">
            Save a reusable campaign brief, generate LinkedIn-first drafts, and keep the workflow grounded in real approval and scheduling control.
          </p>
        </CardHeader>
        <CardContent>
          <form action={generateAiDrafts} className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <input type="hidden" name="workspaceId" value={session.workspaceId} />
            <input type="hidden" name="authorId" value={session.userId} />
            <div className="space-y-4 rounded-3xl border border-border p-5">
              <div>
                <label className="text-sm font-medium text-slate-900">Brand</label>
                <select name="brandId" defaultValue={selectedBrandId} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                  {brandOptions.map((brand) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">One workspace can hold multiple brands. Audience context is inherited from the selected brand, so you do not need a separate target-audience field for every post.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Campaign brief</label>
                <textarea name="brief" className="mt-2 min-h-[140px] w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={plannerBrief} required />
              </div>
            </div>
            <div className="space-y-4 rounded-3xl border border-border p-5">
              <div>
                <label className="text-sm font-medium text-slate-900">Commercial goal</label>
                <input name="commercialGoal" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={plannerGoal} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label className="text-sm font-medium text-slate-900">Draft count</label>
                  <input name="count" type="number" min={1} max={6} defaultValue={plannerCount} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Format</label>
                  <select name="postFormat" defaultValue={plannerFormat} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    <option value="text">Text post</option>
                    <option value="link">Link-led post</option>
                    <option value="image">Single image</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label className="text-sm font-medium text-slate-900">Posting frequency</label>
                  <select name="cadence" defaultValue={plannerCadence} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="twice-weekly">Twice weekly</option>
                    <option value="weekly">Weekly</option>
                    <option value="ad-hoc">Ad hoc</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Preferred time of day</label>
                  <select name="preferredTimeOfDay" defaultValue={plannerPreferredTime} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    <option value="early-morning">Early morning</option>
                    <option value="morning">Morning</option>
                    <option value="midday">Midday</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="varied">Varied</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Generate AI drafts</button>
                <button formAction={saveCampaign} className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">Save campaign for later</button>
                <button formAction={clearSavedCampaign} formNoValidate className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">Clear saved campaign</button>
              </div>
              <p className="text-xs text-muted-foreground">Cadence and time-of-day shape the draft planning only. Repurly still requires you to confirm each final schedule manually.</p>
            </div>
          </form>
        </CardContent>
      </Card>

      {generatedBatch.length ? (
        <Card id="generated-drafts" className="scroll-mt-24">
          <CardHeader>
            <h2 className="text-xl font-semibold">Generated draft batch</h2>
            <p className="text-sm text-muted-foreground">Review each draft before opening it in the composer. This keeps the AI planner useful without hiding the batch behind a single editor view.</p>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {generatedBatch.map((draft) => (
              <div key={draft.id} className="rounded-3xl border border-border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Draft {draft.draftNumber || '?'}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{draft.title}</div>
                  </div>
                  <a href={`/app/content?postId=${draft.id}#composer`} className="rounded-2xl border border-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Open in composer
                  </a>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">{draft.brandName} · {draft.status}{draft.titleHint ? ` · ${draft.titleHint}` : ''}</div>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{draft.excerpt}</p>
                {draft.callToAction ? <div className="mt-4 text-sm font-medium text-primary">CTA: {draft.callToAction}</div> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card id="composer" className="scroll-mt-24">
        <CardHeader>
          <h2 className="text-xl font-semibold">LinkedIn composer</h2>
          <p className="text-sm text-muted-foreground">Finish the core workflow: choose a brand, draft the post, pick the LinkedIn destination, request approval if needed, then schedule.</p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <input type="hidden" name="workspaceId" value={session.workspaceId} />
            <input type="hidden" name="authorId" value={session.userId} />
            <input type="hidden" name="postId" value={postId ?? ''} />
            <TimezoneOffsetField />
            <div className="space-y-4 rounded-3xl border border-border p-5">
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
                  className="mt-2 min-h-[220px] w-full rounded-2xl border border-border px-4 py-3 text-sm"
                  defaultValue={editingPost?.body ?? 'A strong LinkedIn workflow is less about posting everywhere and more about getting the right post approved, scheduled, and recovered when something breaks.'}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-900">Brief or angle (optional)</label>
                <textarea name="brief" className="mt-2 min-h-[90px] w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={editingPost?.brief ?? ''} />
                <p className="mt-2 text-xs text-muted-foreground">This is internal working context for the drafter or approver. It is not published as part of the final post.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Approval owner (optional)</label>
                  <input name="approvalOwner" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={editingPost?.approvalOwner ?? 'Client lead'} />
                  <p className="mt-2 text-xs text-muted-foreground">Skip this if you are posting directly and do not need an approval step.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Scheduled publish time</label>
                  <input name="scheduledFor" type="datetime-local" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={editingPost?.scheduledForInput ?? ''} />
                  <p className="mt-2 text-xs text-muted-foreground">Queued posts only publish automatically when the background worker is live and reaching /api/inngest on schedule.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button formAction={saveDraft} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save draft</button>
                <button formAction={requestApproval} className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">Request approval</button>
                <button formAction={schedulePost} className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">Schedule post</button>
              </div>
            </div>

            <div className="space-y-4">
              <div id="target-selection" className="scroll-mt-24 rounded-3xl border border-border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Publish destination</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Repurly defaults to the workspace default target. Switch between your personal profile and company page here before saving, approving, or scheduling.</p>
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
                      <label key={target.id} className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3 text-sm">
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

              <div id="recent-drafts" className="scroll-mt-24 rounded-3xl border border-border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Recent drafts</h3>
                    <p className="mt-1 text-sm text-muted-foreground">This list only shows draft posts for the selected brand. Clearing it will not touch scheduled or in-review posts.</p>
                  </div>
                  <button formAction={clearRecentDrafts} formNoValidate disabled={!recentDrafts.length} className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Clear recent drafts</button>
                </div>
                <div className="mt-4 space-y-3">
                  {recentDrafts.length ? recentDrafts.map((item) => (
                    <a key={item.id} href={`/app/content?postId=${item.id}#composer`} className="block rounded-2xl border border-border px-4 py-3 text-sm hover:bg-slate-50">
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
