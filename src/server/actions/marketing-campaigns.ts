'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { requireWorkspaceRole, requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { db } from '@/lib/db/client';
import { findStarterDraftBody, reviewedJakomaTriagePost } from '@/lib/marketing/campaign-playbooks';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { brands, posts } from '../../../drizzle/schema';

/**
 * Apply reviewed Jakoma copy to the exact original, unmodified draft only.
 * Never changes published, scheduled, in-review or user-customised posts.
 */
export async function applyReviewedJakomaTriageCopy(formData: FormData) {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId, ['owner', 'admin', 'editor']);
  await requirePaidWorkspaceAccess(session.workspaceId);
  if (!(await canImportPilotPortfolio())) {
    redirect('/app/portfolio/campaigns?review=unavailable');
  }

  const postId = String(formData.get('postId') ?? '').trim();
  if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(postId)) {
    redirect('/app/portfolio/campaigns?review=invalid');
  }

  const oldBody = findStarterDraftBody('jakoma', 'jakoma-triage-first');
  if (!oldBody) throw new Error('Expected Jakoma campaign source draft missing');

  const [post] = await db
    .select({
      id: posts.id,
      status: posts.status,
      body: posts.body,
      metadata: posts.metadata,
      brandSlug: brands.slug,
    })
    .from(posts)
    .innerJoin(brands, and(eq(posts.brandId, brands.id), eq(brands.workspaceId, session.workspaceId)))
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, session.workspaceId)))
    .limit(1);

  if (!post ||
      post.brandSlug !== 'jakoma' ||
      post.metadata?.source !== 'portfolio_starter' ||
      post.metadata?.starterKey !== 'jakoma-triage-first' ||
      post.status !== 'draft' ||
      post.body !== oldBody) {
    redirect('/app/portfolio/campaigns?review=preserved');
  }

  const updated = await db
    .update(posts)
    .set({ body: reviewedJakomaTriagePost, updatedAt: new Date() })
    .where(and(
      eq(posts.id, postId),
      eq(posts.workspaceId, session.workspaceId),
      eq(posts.status, 'draft'),
      eq(posts.body, oldBody),
    ))
    .returning({ id: posts.id });

  if (!updated.length) {
    redirect('/app/portfolio/campaigns?review=preserved');
  }

  revalidatePath('/app/portfolio/campaigns');
  revalidatePath('/app/content');
  revalidatePath('/app/portfolio');
  redirect('/app/portfolio/campaigns?review=applied');
}
