'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { requireWorkspaceRole, requireWorkspaceSession } from '@/lib/auth/workspace';
import { isPrivatePilotEmailAllowed, isPrivatePilotMode, isPrivatePilotUserIdAllowed } from '@/lib/billing/private-pilot';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { db } from '@/lib/db/client';
import { starterPortfolio } from '@/lib/marketing/portfolio-starters';
import { brands, posts, workspaces } from '../../../drizzle/schema';

/** Special starter setup is restricted to the explicitly approved, signed-in staging pilot. */
export async function canImportPilotPortfolio(): Promise<boolean> {
  if (!isPrivatePilotMode()) return false;
  const { userId } = await auth();
  if (!userId) return false;
  if (process.env.REPURLY_PILOT_CLERK_USER_ID?.trim()) {
    return isPrivatePilotUserIdAllowed(userId);
  }
  const user = await currentUser();
  return isPrivatePilotEmailAllowed(user?.primaryEmailAddress?.emailAddress);
}

function sameBrand(a: { name: string; slug: string | null }, b: { name: string; slug: string }) {
  return a.slug?.trim().toLowerCase() === b.slug || a.name.trim().toLowerCase() === b.name.toLowerCase();
}

export async function importPilotPortfolio() {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId, ['owner', 'admin', 'editor']);
  await requirePaidWorkspaceAccess(session.workspaceId);
  if (!(await canImportPilotPortfolio())) {
    redirect('/app/portfolio?setup=unavailable');
  }

  const result = await db.transaction(async tx => {
    // Serialise repeated clicks for this workspace. Existing records are never reset.
    const workspace = await tx.select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId))
      .for('update');
    if (!workspace.length) throw new Error('Workspace no longer exists');

    const existingBrands = await tx.select().from(brands)
      .where(eq(brands.workspaceId, session.workspaceId));
    const existingPosts = await tx.select({
      brandId: posts.brandId,
      metadata: posts.metadata,
    }).from(posts).where(eq(posts.workspaceId, session.workspaceId));

    let addedBrands = 0;
    let addedDrafts = 0;

    for (const starter of starterPortfolio) {
      const old = existingBrands.find(item => sameBrand(item, starter));
      let brandId: string;
      let brandStatus: string;

      if (old) {
        brandId = old.id;
        brandStatus = old.status;
        const updates: Partial<typeof brands.$inferInsert> = {};
        if (!old.audience?.trim()) updates.audience = starter.audience;
        if (!old.defaultTone?.trim()) updates.defaultTone = starter.defaultTone;
        if (!old.primaryCta?.trim()) updates.primaryCta = starter.primaryCta;
        if (!old.secondaryCta?.trim()) updates.secondaryCta = starter.secondaryCta;
        if (!old.website && starter.website) updates.website = starter.website;
        if (!old.slug) updates.slug = starter.slug;
        if (!old.hashtags?.length) updates.hashtags = starter.hashtags;
        if (!old.metadata?.marketingStage) {
          updates.metadata = {
            ...(old.metadata ?? {}),
            marketingStage: starter.marketingStage,
            starterCampaignGoal: starter.campaignGoal,
            starterPositioning: starter.positioning,
          };
        }
        if (Object.keys(updates).length) {
          await tx.update(brands).set({ ...updates, updatedAt: new Date() })
            .where(eq(brands.id, old.id));
        }
      } else {
        const inserted = await tx.insert(brands).values({
          workspaceId: session.workspaceId,
          name: starter.name,
          slug: starter.slug,
          status: 'active',
          website: starter.website,
          defaultTone: starter.defaultTone,
          audience: starter.audience,
          primaryCta: starter.primaryCta,
          secondaryCta: starter.secondaryCta,
          hashtags: starter.hashtags,
          metadata: {
            marketingStage: starter.marketingStage,
            starterCampaignGoal: starter.campaignGoal,
            starterPositioning: starter.positioning,
          },
        }).returning({ id: brands.id });
        brandId = inserted[0].id;
        brandStatus = 'active';
        addedBrands++;
      }

      // Respect an existing decision to pause or archive a brand.
      if (brandStatus !== 'active') continue;

      for (const draft of starter.posts) {
        const exists = existingPosts.some(post => post.brandId === brandId &&
          post.metadata?.source === 'portfolio_starter' &&
          post.metadata?.starterKey === draft.key);
        if (exists) continue;

        const metadata: Record<string, unknown> = {
          source: 'portfolio_starter',
          starterKey: draft.key,
          brief: draft.brief,
          reviewRequired: true,
          marketingStageAtDraft: starter.marketingStage,
        };

        await tx.insert(posts).values({
          workspaceId: session.workspaceId,
          brandId,
          authorId: session.userId,
          title: draft.title,
          body: draft.body,
          status: 'draft',
          postType: 'text',
          metadata,
        });
        existingPosts.push({ brandId, metadata });
        addedDrafts++;
      }
    }
    return { addedBrands, addedDrafts };
  });

  revalidatePath('/app/portfolio');
  revalidatePath('/app/brands');
  revalidatePath('/app/content');
  revalidatePath('/app/weekly-plan');
  const params = new URLSearchParams({
    setup: 'imported',
    brands: String(result.addedBrands),
    drafts: String(result.addedDrafts),
  });
  redirect('/app/portfolio?' + params.toString());
}
