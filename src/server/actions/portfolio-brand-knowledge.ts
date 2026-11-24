'use server';
import { and, eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireWorkspaceSession, requireWorkspaceRole } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { db } from '@/lib/db/client';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { matchPortfolioBrand, portfolioMarketingFields } from '@/lib/marketing/portfolio-brand-knowledge';
import { brands, workspaces } from '../../../drizzle/schema';

export async function applyPortfolioBrandKnowledge() {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId, ['owner', 'admin']);
  await requirePaidWorkspaceAccess(session.workspaceId);
  if (!(await canImportPilotPortfolio())) redirect('/app/portfolio');
  const count = await db.transaction(async tx => {
    const [workspace] = await tx.select({ id: workspaces.id }).from(workspaces)
      .where(eq(workspaces.id, session.workspaceId)).for('update');
    if (!workspace) return 0;
    const rows = await tx.select().from(brands).where(eq(brands.workspaceId, session.workspaceId)).for('update');
    let changed = 0;
    for (const brand of rows) {
      const profile = matchPortfolioBrand(brand);
      if (!profile || brand.status !== 'active') continue;
      const marketingKnowledge = portfolioMarketingFields(profile);
      if (JSON.stringify(brand.metadata?.portfolioMarketingKnowledge) === JSON.stringify(marketingKnowledge)) continue;
      await tx.update(brands).set({
        metadata: sql`coalesce(${brands.metadata}, '{}'::jsonb) || ${JSON.stringify({ portfolioMarketingKnowledge: marketingKnowledge })}::jsonb`,
        updatedAt: new Date(),
      }).where(and(eq(brands.id, brand.id), eq(brands.workspaceId, session.workspaceId)));
      changed++;
    }
    return changed;
  });
  revalidatePath('/app/portfolio/brand-system');
  revalidatePath('/app/marketing-director');
  redirect('/app/portfolio/brand-system?updated=' + count);
}
