import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { brands, posts } from '../../../drizzle/schema';

/** Read actual saved campaign records, scoped to the authenticated workspace. */
export async function getPortfolioCampaignPosts(workspaceId: string) {
  const rows = await db
    .select({
      id: posts.id,
      brandId: posts.brandId,
      brandSlug: brands.slug,
      title: posts.title,
      body: posts.body,
      status: posts.status,
      metadata: posts.metadata,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .innerJoin(brands, and(eq(brands.id, posts.brandId), eq(brands.workspaceId, workspaceId)))
    .where(and(eq(posts.workspaceId, workspaceId), sql`${posts.metadata}->>'source' = 'portfolio_starter'`))
    .orderBy(desc(posts.updatedAt))
    .limit(200);

  return rows.filter(row =>
    row.metadata?.source === 'portfolio_starter' &&
    typeof row.metadata?.starterKey === 'string',
  );
}
