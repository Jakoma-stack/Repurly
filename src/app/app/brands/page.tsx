import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { archiveBrand, restoreBrand, saveBrand } from '@/server/actions/brands';
import { getBrandForEditing, getWorkspaceBrands } from '@/server/queries/brands';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BrandsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const params = await searchParams;
  const brandId = firstParam(params.brandId);
  const ok = firstParam(params.ok);
  const error = firstParam(params.error);

  const [brands, editingBrand] = await Promise.all([
    getWorkspaceBrands(session.workspaceId),
    getBrandForEditing(session.workspaceId, brandId ?? null),
  ]);

  return (
    <div className="space-y-6">
      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Brand update saved.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">Please complete the required brand fields.</div> : null}

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Multi-brand workspace setup</h2>
          <p className="text-sm text-muted-foreground">
            One workspace can hold multiple brands or clients, each with its own tone, CTA, and LinkedIn context. The dashboard, queue, notifications, and reliability views stay shared at workspace level so operators can manage everything from one place. If a brand needs a completely separate LinkedIn login or permissions boundary, use a separate workspace instead of assuming brand records isolate channel access.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">{editingBrand ? 'Edit brand' : 'Add brand'}</h3>
          </CardHeader>
          <CardContent>
            <form action={saveBrand} className="space-y-4">
              <input type="hidden" name="workspaceId" value={session.workspaceId} />
              <input type="hidden" name="brandId" value={editingBrand?.id ?? ''} />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Brand name</label>
                  <input name="name" defaultValue={editingBrand?.name ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Slug</label>
                  <input name="slug" defaultValue={editingBrand?.slug ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Status</label>
                  <select name="status" defaultValue={editingBrand?.status ?? 'active'} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Website</label>
                  <input name="website" defaultValue={editingBrand?.website ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="https://example.com" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Contact email</label>
                  <input name="contactEmail" type="email" defaultValue={editingBrand?.contactEmail ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Tone</label>
                  <input name="defaultTone" defaultValue={editingBrand?.defaultTone ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Clear, sharp, commercially realistic" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Audience</label>
                <textarea name="audience" defaultValue={editingBrand?.audience ?? ''} className="mt-2 min-h-[90px] w-full rounded-2xl border border-border px-4 py-3 text-sm" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Primary CTA</label>
                  <input name="primaryCta" defaultValue={editingBrand?.primaryCta ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Secondary CTA</label>
                  <input name="secondaryCta" defaultValue={editingBrand?.secondaryCta ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Hashtags</label>
                <textarea name="hashtags" defaultValue={(editingBrand?.hashtags ?? []).join(', ')} className="mt-2 min-h-[80px] w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="linkedin, demandgen, contentops" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">LinkedIn profile URL</label>
                  <input name="linkedinProfileUrl" defaultValue={editingBrand?.linkedinProfileUrl ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">LinkedIn company URL</label>
                  <input name="linkedinCompanyUrl" defaultValue={editingBrand?.linkedinCompanyUrl ?? ''} className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Brand records shape planning, copy, and reporting. They do not create separate LinkedIn containers or isolated auth on their own.</p>
              <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save brand</button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Current brands</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {brands.map((brand) => (
              <div key={brand.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-slate-900">{brand.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{brand.status} · {brand.totalPosts} posts · {brand.scheduledPosts} scheduled</div>
                    <div className="mt-2 text-sm text-muted-foreground">{brand.defaultTone || 'No tone set yet'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/app/brands?brandId=${brand.id}`} className="rounded-2xl border border-border px-3 py-2 text-sm">Edit</a>
                    <a href={`/app/content`} className="rounded-2xl border border-border px-3 py-2 text-sm">Open composer</a>
                    {brand.status === 'archived' ? (
                      <form action={restoreBrand}>
                        <input type="hidden" name="workspaceId" value={session.workspaceId} />
                        <input type="hidden" name="brandId" value={brand.id} />
                        <button className="rounded-2xl border border-border px-3 py-2 text-sm">Restore</button>
                      </form>
                    ) : (
                      <form action={archiveBrand}>
                        <input type="hidden" name="workspaceId" value={session.workspaceId} />
                        <input type="hidden" name="brandId" value={brand.id} />
                        <button className="rounded-2xl border border-border px-3 py-2 text-sm">Archive</button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
