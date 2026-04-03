import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getLinkedInTargets, getPostForEditing } from '@/server/queries/workflow';
import { requestApproval, saveDraft, schedulePost } from '@/server/actions/workflow';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Banner({ kind, children }: { kind: 'success' | 'error'; children: React.ReactNode }) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-rose-200 bg-rose-50 text-rose-900';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export default async function ContentPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireWorkspaceSession();
  const targets = await getLinkedInTargets(session.workspaceId);
  const params = await searchParams;

  const ok = firstParam(params.ok);
  const error = firstParam(params.error);
  const postId = firstParam(params.postId);

  const editingPost = await getPostForEditing(session.workspaceId, postId ?? null);

  return (
    <div className="space-y-6">
      {ok === 'draft' && <Banner kind="success">Draft saved.</Banner>}
      {ok === 'approval' && <Banner kind="success">Approval request created.</Banner>}
      {ok === 'scheduled' && <Banner kind="success">Post scheduled into the publish queue.</Banner>}
      {error === 'missing-brand' && <Banner kind="error">No brand was found for this workspace. Seed or create a brand first.</Banner>}
      {error === 'missing-target' && <Banner kind="error">Connect LinkedIn and create a publish target before requesting approval or scheduling.</Banner>}
      {error === 'missing-schedule' && <Banner kind="error">Choose a scheduled publish time before scheduling a post.</Banner>}
      {error === 'invalid' && <Banner kind="error">Required fields were missing. Check title, body, and workspace session.</Banner>}

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">LinkedIn composer</h2>
          <p className="text-sm text-muted-foreground">
            Launch workflow: create one post, choose one LinkedIn target, route it for approval, then schedule it into
            the publish queue.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <input type="hidden" name="workspaceId" value={session.workspaceId} />
            <input type="hidden" name="authorId" value={session.userId} />
            <input type="hidden" name="postId" value={postId ?? ''} />

            {editingPost ? (
              <input type="hidden" name="editingStatus" value={editingPost.status ?? ''} />
            ) : null}

            <div className="space-y-4 rounded-3xl border border-border p-5">
              <div>
                <label className="text-sm font-medium text-slate-900">Post title</label>
                <input
                  name="title"
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm"
                  defaultValue={editingPost?.title ?? 'Q2 pipeline insight'}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-900">LinkedIn post copy</label>
                <textarea
                  name="body"
                  className="mt-2 min-h-[220px] w-full rounded-2xl border border-border px-4 py-3 text-sm"
                  defaultValue={
                    editingPost?.body ??
                    `A strong LinkedIn workflow is less about posting everywhere and more about getting the right post approved, scheduled, and recovered when something breaks.\n\nThat is the workflow Repurly is built to support first.`
                  }
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Approval owner</label>
                  <input
                    name="approvalOwner"
                    className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm"
                    defaultValue={editingPost?.approvalOwner ?? 'Client lead'}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-900">Scheduled publish time</label>
                  <input
                    name="scheduledFor"
                    type="datetime-local"
                    className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm"
                    defaultValue={editingPost?.scheduledForInput ?? ''}
                  />
                </div>
              </div>

              {postId ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Editing existing workflow item. Save, request approval, and schedule will update the same post instead of creating a duplicate queued item.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  formAction={saveDraft}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Save draft
                </button>
                <button
                  formAction={requestApproval}
                  className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Request approval
                </button>
                <button
                  formAction={schedulePost}
                  className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Schedule post
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-border p-5">
                <h3 className="text-lg font-semibold">Target selection</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  LinkedIn is the default launch path. Pick the profile or company page that should receive this post.
                </p>

                <div className="mt-4 space-y-3">
                  {targets.length ? (
                    targets.map((target) => (
                      <label
                        key={target.id}
                        className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
                      >
                        <input
                          type="radio"
                          name="targetId"
                          value={target.id}
                          defaultChecked={
                            editingPost?.targetId
                              ? target.id === editingPost.targetId
                              : target.isDefault
                          }
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-slate-900">{target.displayName}</div>
                          <div className="text-muted-foreground">
                            {target.handle} · {target.targetType}
                            {target.isDefault ? ' · default' : ''}
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                      No LinkedIn publish target is connected yet. Connect LinkedIn in Settings before scheduling a post.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border p-5">
                <h3 className="text-lg font-semibold">Approval states</h3>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-2xl border border-border px-4 py-3">
                    <span className="font-medium text-slate-900">Draft</span> — internal editing only
                  </div>
                  <div className="rounded-2xl border border-border px-4 py-3">
                    <span className="font-medium text-slate-900">In review</span> — waiting on approver response
                  </div>
                  <div className="rounded-2xl border border-border px-4 py-3">
                    <span className="font-medium text-slate-900">Approved</span> — safe to schedule into the queue
                  </div>
                  <div className="rounded-2xl border border-border px-4 py-3">
                    <span className="font-medium text-slate-900">Rejected</span> — return to editor with notes
                  </div>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
