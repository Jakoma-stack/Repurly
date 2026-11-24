'use server';

import { randomUUID } from 'node:crypto';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Route } from 'next';

import { requireWorkspaceRole, requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getPlanLimits } from '@/lib/billing/plans';
import { db } from '@/lib/db/client';
import { directorBrandEligibility, directorContextHash, directorPlanIsCurrent, savedDirectorPlan, type SavedDirectorPlan } from '@/lib/marketing/director';
import { generateMarketingDirectorPlan } from '@/lib/ai/marketing-director';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { auditEvents, brands, posts, workspaces } from '../../../drizzle/schema';

const ATTEMPT = 'marketing_director_attempt';
const SAVED = 'marketing_director_draft_saved';
const UUID = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
function brandIdFrom(form: FormData) {
  const id = String(form.get('brandId') ?? '');
  return UUID.test(id) ? id : '';
}
function resultUrl(brandId: string, result: string): Route {
  return ('/app/marketing-director?' + new URLSearchParams({ brandId, result }).toString()) as Route;
}
function utcDayStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function utcMonthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function generateDirectorPlan(formData: FormData) {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId, ['owner', 'admin', 'editor']);
  await requirePaidWorkspaceAccess(session.workspaceId);
  const brandId = brandIdFrom(formData);
  if (!brandId) redirect(resultUrl('', 'invalid'));
  if (!process.env.OPENAI_API_KEY?.trim()) redirect(resultUrl(brandId, 'not-configured'));
  if (process.env.MARKETING_DIRECTOR_DISABLED === 'true') redirect(resultUrl(brandId, 'disabled'));
  const ownerPilot = await canImportPilotPortfolio();
  // Reserve a costed attempt before contacting the model; serialise reservations
  // by workspace. Failures count too. No new database tables or migrations.
  const reservation = await db.transaction(async tx => {
    const [workspace] = await tx.select({ id: workspaces.id }).from(workspaces)
      .where(eq(workspaces.id, session.workspaceId)).for('update');
    if (!workspace) return { error: 'invalid' } as const;
    const [brand] = await tx.select().from(brands)
      .where(and(eq(brands.workspaceId, session.workspaceId), eq(brands.id, brandId))).limit(1);
    if (!brand || directorBrandEligibility(brand, ownerPilot)) return { error: 'not-ready' } as const;
    const now = new Date();
    const [daily] = await tx.select({ total: count() }).from(auditEvents).where(and(
      eq(auditEvents.workspaceId, session.workspaceId), eq(auditEvents.eventType, ATTEMPT),
      gte(auditEvents.createdAt, utcDayStart(now)),
    ));
    const [monthly] = await tx.select({ total: count() }).from(auditEvents).where(and(
      eq(auditEvents.workspaceId, session.workspaceId), eq(auditEvents.eventType, ATTEMPT),
      gte(auditEvents.createdAt, utcMonthStart(now)),
    ));
    const [perBrand] = await tx.select({ total: count() }).from(auditEvents).where(and(
      eq(auditEvents.workspaceId, session.workspaceId), eq(auditEvents.eventType, ATTEMPT),
      eq(auditEvents.entityId, brandId), gte(auditEvents.createdAt, utcDayStart(now)),
    ));
    if (Number(daily?.total ?? 0) >= 6 || Number(monthly?.total ?? 0) >= 40 ||
        Number(perBrand?.total ?? 0) >= 1) return { error: 'limit' } as const;
    await tx.insert(auditEvents).values({
      workspaceId: session.workspaceId, actorId: session.userId, eventType: ATTEMPT,
      entityType: 'brand', entityId: brandId, payload: { contextHash: directorContextHash(brand) },
    });
    return { brand } as const;
  });
  if ('error' in reservation) redirect(resultUrl(brandId, reservation.error ?? 'invalid'));
  const plan = await generateMarketingDirectorPlan(reservation.brand);
  if (!plan) redirect(resultUrl(brandId, 'failed'));
  const saved: SavedDirectorPlan = {
    id: randomUUID(), generatedAt: new Date().toISOString(),
    contextHash: directorContextHash(reservation.brand), plan,
  };
  const persisted = await db.transaction(async tx => {
    await tx.select({ id: workspaces.id }).from(workspaces)
      .where(eq(workspaces.id, session.workspaceId)).for('update');
    const [current] = await tx.select().from(brands)
      .where(and(eq(brands.workspaceId, session.workspaceId), eq(brands.id, brandId))).for('update');
    if (!current || directorBrandEligibility(current, ownerPilot) || !directorPlanIsCurrent(current, saved)) return false;
    await tx.update(brands).set({
      metadata: sql`coalesce(${brands.metadata}, '{}'::jsonb) || ${JSON.stringify({ marketingDirector: saved })}::jsonb`,
      updatedAt: new Date(),
    }).where(and(eq(brands.workspaceId, session.workspaceId), eq(brands.id, brandId)));
    return true;
  });
  revalidatePath('/app/marketing-director');
  redirect(resultUrl(brandId, persisted ? 'generated' : 'stale'));
}

export async function saveDirectorDraft(formData: FormData) {
  const session = await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId, ['owner', 'admin', 'editor']);
  await requirePaidWorkspaceAccess(session.workspaceId);
  const ownerPilot = await canImportPilotPortfolio();
  const brandId = brandIdFrom(formData);
  const planId = String(formData.get('planId') ?? '');
  if (!brandId || !UUID.test(planId)) redirect(resultUrl(brandId, 'invalid'));
  const result = await db.transaction(async tx => {
    const [workspace] = await tx.select({ id: workspaces.id, plan: workspaces.plan }).from(workspaces)
      .where(eq(workspaces.id, session.workspaceId)).for('update');
    if (!workspace) return { error: 'invalid' } as const;
    const [brand] = await tx.select().from(brands)
      .where(and(eq(brands.workspaceId, session.workspaceId), eq(brands.id, brandId))).for('update');
    if (!brand || directorBrandEligibility(brand, ownerPilot)) return { error: 'not-ready' } as const;
    const saved = savedDirectorPlan(brand);
    if (!saved || saved.id !== planId || !directorPlanIsCurrent(brand, saved)) return { error: 'stale' } as const;
    const [existing] = await tx.select({ payload: auditEvents.payload }).from(auditEvents).where(and(
      eq(auditEvents.workspaceId, session.workspaceId), eq(auditEvents.eventType, SAVED),
      eq(auditEvents.entityId, planId),
    )).limit(1);
    if (existing) {
      const postId = typeof existing.payload?.postId === 'string' ? existing.payload.postId : '';
      if (!UUID.test(postId)) return { error: 'already-saved' } as const;
      const [post] = await tx.select({ id: posts.id }).from(posts).where(and(
        eq(posts.workspaceId, session.workspaceId), eq(posts.brandId, brandId), eq(posts.id, postId),
      )).limit(1);
      return post ? { postId: post.id } as const : { error: 'already-saved' } as const;
    }
    const [usage] = await tx.select({ total: count() }).from(posts).where(and(
      eq(posts.workspaceId, session.workspaceId), gte(posts.createdAt, utcMonthStart(new Date())),
    ));
    if (Number(usage?.total ?? 0) >= getPlanLimits(workspace.plan).monthlyPosts) return { error: 'post-limit' } as const;
    const [post] = await tx.insert(posts).values({
      workspaceId: session.workspaceId, brandId, authorId: session.userId,
      title: saved.plan.firstDraft.title, body: saved.plan.firstDraft.body,
      status: 'draft', postType: 'text',
      metadata: { source: 'marketing_director', directorPlanId: planId, reviewRequired: true,
        brief: saved.plan.objective },
    }).returning({ id: posts.id });
    await tx.insert(auditEvents).values({
      workspaceId: session.workspaceId, actorId: session.userId, eventType: SAVED,
      entityType: 'marketing_plan', entityId: planId, payload: { postId: post.id, brandId },
    });
    return { postId: post.id } as const;
  });
  if ('error' in result) redirect(resultUrl(brandId, result.error ?? 'invalid'));
  revalidatePath('/app/content');
  revalidatePath('/app/portfolio');
  revalidatePath('/app/marketing-director');
  redirect(('/app/content?postId=' + encodeURIComponent(result.postId) + '#composer') as Route);
}
