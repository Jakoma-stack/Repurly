import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { brands, posts } from '../../../drizzle/schema';

export async function getWorkspaceBrands(workspaceId: string) {
  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      status: brands.status,
      website: brands.website,
      contactEmail: brands.contactEmail,
      defaultTone: brands.defaultTone,
      audience: brands.audience,
      primaryCta: brands.primaryCta,
      secondaryCta: brands.secondaryCta,
      hashtags: brands.hashtags,
      linkedinProfileUrl: brands.linkedinProfileUrl,
      linkedinCompanyUrl: brands.linkedinCompanyUrl,
      createdAt: brands.createdAt,
      draftPosts: sql<number>`count(*) filter (where ${posts.status} = 'draft')`,
      scheduledPosts: sql<number>`count(*) filter (where ${posts.status} = 'scheduled')`,
      totalPosts: sql<number>`count(${posts.id})`,
    })
    .from(brands)
    .leftJoin(posts, eq(posts.brandId, brands.id))
    .where(eq(brands.workspaceId, workspaceId))
    .groupBy(brands.id)
    .orderBy(brands.name);

  return rows;
}

export async function getBrandForEditing(workspaceId: string, brandId?: string | null) {
  if (!brandId) return null;

  const rows = await db
    .select()
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);

  const brand = rows[0];
  if (!brand || brand.workspaceId !== workspaceId) return null;
  return brand;
}
