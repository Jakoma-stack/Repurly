import { cookies } from 'next/headers';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  savedAt: string;
};

const SAVED_CAMPAIGN_COOKIE = 'repurly_saved_campaign';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSavedCampaign(rawValue: string | undefined, workspaceId: string): SavedCampaign | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(Buffer.from(rawValue, 'base64url').toString('utf8')) as SavedCampaign;
    if (parsed.workspaceId !== workspaceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function Banner({ kind, children }: { kind: 'success' | 'error' | 'info'; children: React.ReactNode }) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : kind === 'info'
        ? 'border-sky-200 bg-sky-50 text-sky-900'
        : 'border-rose-200 bg-rose-50 text-rose-900';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
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

  return (
    <div className="space-y-6">
      {ok === 'draft' && <Banner kind="success">Draft saved. You are still anchored on target selection so you can keep moving through approval and scheduling.</Banner>}
      {ok === 'approval' && <Banner kind="success">Approval request created. Target selection stayed in view so you can confirm the LinkedIn destination.</Banner>}
      {ok === 'scheduled' && <Banner kind="success">Post scheduled into the publish queue. Review the selected target below before leaving the workflow.</Banner>}
      {ok === 'generated' && <Banner kind="success">AI draft batch created. Review the drafts below, then open the strongest one in the composer.</Banner>}
      {ok === 'campaign-saved' && <Banner kind="success">Campaign defaults saved for this workspace in this browser.</Banner>}
      {ok === 'campaign-cleared' && <Banner kind="success">Saved campaign defaults cleared.</Banner>}
      {ok === 'drafts-cleared' && <Banner kind="success">Recent draft backlog cleared for the selected brand.</Banner>}
      {ok === 'no-drafts' && <Banner kind="info">There were no other draft posts to clear for the selected brand.</Banner>}
      {error === 'missing-brand' && <Banner kind="error">No active brand was found for this workspace. Create a brand first.</Banner>}
      {error === 'missing-target' && <Banner kind="error">Connect LinkedIn and create a publish target before requesting approval or scheduling.</Banner>}
      {error === 'missing-schedule' && <Banner kind="error">Choose a scheduled publish time before scheduling a post.</Banner>}
      {error === 'generate-failed' && <Banner kind="error">Draft generation hit an application error before the batch could be saved. Your campaign brief is still saved locally, so you can retry immediately.</Banner>}
      {error === 'invalid' && <Banner kind="error">Required fields were missing. Check the form and try again.</Banner>}

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
                <p className="mt-2 text-xs text-muted-foreground">One workspace can hold multiple brands. Use a separate brand record for each client or business line, then run them through the same shared dashboard and work queue.</p>
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
              <div className="flex flex-wrap gap-3">
                <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Generate AI drafts</button>
                <button formAction={saveCampaign} className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">Save campaign for later</button>
                <button formAction={clearSavedCampaign} formNoValidate className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">Clear saved campaign</button>
              </div>
              <p className="text-xs text-muted-foreground">This creates drafts only. It does not auto-schedule or auto-publish.</p>
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
          <p className="text-sm text-muted-foreground">Finish the core workflow: choose a brand, draft the post, select the LinkedIn target, request approval, then schedule.</p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <input type="hidden" name="workspaceId" value={session.workspaceId} />
            <input type="hidden" name="authorId" value={session.userId} />
            <input type="hidden" name="postId" value={postId ?? ''} />
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
                <label className="text-sm font-medium text-slate-900">Brief or angle</label>
                <textarea name="brief" className="mt-2 min-h-[90px] w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={editingPost?.brief ?? ''} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Approval owner</label>
                  <input name="approvalOwner" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={editingPost?.approvalOwner ?? 'Client lead'} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Scheduled publish time</label>
                  <input name="scheduledFor" type="datetime-local" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={editingPost?.scheduledForInput ?? ''} />
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
                <h3 className="text-lg font-semibold">Target selection</h3>
                <p className="mt-1 text-sm text-muted-foreground">LinkedIn remains the primary workflow. Pick the profile or company page that should receive this post.</p>
                <div className="mt-4 space-y-3">
                  {targets.length ? targets.map((target) => (
                    <label key={target.id} className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3 text-sm">
                      <input type="radio" name="targetId" value={target.id} defaultChecked={editingPost?.targetId === target.id || (!editingPost?.targetId && target.isDefault)} className="mt-1" />
                      <div>
                        <div className="font-medium text-slate-900">{target.displayName}</div>
                        <div className="text-muted-foreground">{target.handle || 'LinkedIn target'} · {target.targetType}</div>
                      </div>
                    </label>
                  )) : <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">No LinkedIn targets connected yet. Go to Channel setup first.</div>}
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
