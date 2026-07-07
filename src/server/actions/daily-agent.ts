'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { and, count, eq, gte } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { requireWorkspaceRole } from '@/lib/auth/workspace';
import { generateDailyAgentBriefing, type DailyAgentAction, type DailyAgentBriefing } from '@/lib/ai/daily-agent';
import { parseLinkedInAnalyticsImport } from '@/lib/analytics/linkedin-import';
import { brands, dailyAgentActions, dailyAgentSessions, leadPipeline } from '../../../drizzle/schema';

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function nullableString(formData: FormData, key: string) {
  return requiredString(formData, key) || null;
}

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function normaliseStatus(value: string) {
  const allowed = new Set(['draft', 'approved', 'copied', 'sent_manually', 'logged', 'ignored', 'needs_edit']);
  return allowed.has(value) ? value : 'draft';
}

function betaMonthlyLimit() {
  return Number(process.env.DAILY_AGENT_BETA_MONTHLY_LIMIT || 40);
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function enforceDailyAgentUsageLimit(workspaceId: string) {
  if (process.env.ENABLE_INTERNAL_BETA_ACCESS === 'true') return;
  if (process.env.DAILY_AGENT_ENFORCE_LIMIT !== 'true') return;
  const limit = betaMonthlyLimit();
  const rows = await db
    .select({ value: count() })
    .from(dailyAgentSessions)
    .where(and(eq(dailyAgentSessions.workspaceId, workspaceId), gte(dailyAgentSessions.createdAt, monthStart())));
  const used = Number(rows[0]?.value ?? 0);
  if (used >= limit) redirect('/app/daily-agent?error=usage-limit' as Route);
}

function actionRowsFromBriefing(args: {
  briefing: DailyAgentBriefing;
  sessionId: string;
  workspaceId: string;
  brandId: string | null;
}) {
  return args.briefing.actions.slice(0, 40).map((action: DailyAgentAction) => ({
    sessionId: args.sessionId,
    workspaceId: args.workspaceId,
    brandId: args.brandId,
    actionType: action.actionType,
    personName: action.personName ?? null,
    personHandle: action.personHandle ?? null,
    source: action.source || 'daily_agent',
    recommendedChannel: action.recommendedChannel || 'tracker_update',
    priority: action.priority || 'medium',
    reason: action.reason,
    draftText: action.draftText ?? null,
    metadata: (action.metadata ?? {}) as Record<string, unknown>,
  }));
}

async function getBrandContext(workspaceId: string, brandId: string | null) {
  if (!brandId) return null;
  const rows = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

async function refreshDailyAgent(sessionId?: string) {
  revalidatePath('/app');
  revalidatePath('/app/daily-agent');
  revalidatePath('/app/relationships');
  revalidatePath('/app/weekly-plan');
  revalidatePath('/app/pilot-dashboard');
  revalidatePath('/app/leads');
  if (sessionId) revalidatePath(`/app/daily-agent?session=${sessionId}`);
}

export async function createDailyAgentSession(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const brandId = nullableString(formData, 'brandId');
  const sessionDate = requiredString(formData, 'sessionDate') || todayIsoDate();
  const rawNotifications = nullableString(formData, 'rawNotifications');
  const rawComments = nullableString(formData, 'rawComments');
  const manualRawAnalytics = nullableString(formData, 'rawAnalytics');
  const analyticsFile = formData.get('analyticsExport');
  const analyticsImport = analyticsFile instanceof File ? await parseLinkedInAnalyticsImport(analyticsFile) : null;
  const rawAnalytics = [manualRawAnalytics, analyticsImport?.textSummary].filter(Boolean).join('\n\n--- Imported LinkedIn analytics export ---\n\n') || null;
  const rawProfiles = nullableString(formData, 'rawProfiles');
  const rawNotes = nullableString(formData, 'rawNotes');

  if (!workspaceId) redirect('/app/daily-agent?error=invalid' as Route);
  const access = await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);
  await enforceDailyAgentUsageLimit(workspaceId);
  const brand = await getBrandContext(workspaceId, brandId);

  if (brandId && !brand) redirect('/app/daily-agent?error=brand' as Route);

  const briefing = await generateDailyAgentBriefing({
    brandName: brand?.name ?? 'Jakoma',
    brandTone: brand?.defaultTone ?? 'clear, useful, commercially focused, UK spelling',
    audience: brand?.audience ?? 'consultants, founders and expert-led businesses',
    primaryCta: brand?.primaryCta ?? 'reply if this would be useful to map out',
    secondaryCta: brand?.secondaryCta,
    brandMetadata: brand?.metadata ?? null,
    rawNotifications,
    rawComments,
    rawAnalytics,
    rawProfiles,
    rawNotes,
  });

  const [session] = await db
    .insert(dailyAgentSessions)
    .values({
      workspaceId,
      brandId,
      sessionDate,
      rawNotifications,
      rawComments,
      rawAnalytics,
      analyticsImportJson: analyticsImport as unknown as Record<string, unknown> | null,
      rawProfiles,
      rawNotes,
      summary: briefing.summary,
      briefingJson: briefing as unknown as Record<string, unknown>,
      generationMode: briefing.generationMode,
      createdById: access.userId,
    })
    .returning({ id: dailyAgentSessions.id });

  const rows = actionRowsFromBriefing({ briefing, sessionId: session.id, workspaceId, brandId });
  if (rows.length) await db.insert(dailyAgentActions).values(rows);

  await refreshDailyAgent(session.id);
  redirect(`/app/daily-agent?session=${session.id}&ok=generated` as Route);
}

export async function updateDailyAgentAction(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const actionId = requiredString(formData, 'actionId');
  const status = normaliseStatus(requiredString(formData, 'status'));
  const draftText = nullableString(formData, 'draftText');

  if (!workspaceId || !actionId) redirect('/app/daily-agent?error=invalid' as Route);
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);

  const rows = await db
    .select({ id: dailyAgentActions.id, sessionId: dailyAgentActions.sessionId })
    .from(dailyAgentActions)
    .where(and(eq(dailyAgentActions.id, actionId), eq(dailyAgentActions.workspaceId, workspaceId)))
    .limit(1);

  const action = rows[0];
  if (!action) redirect('/app/daily-agent?error=missing-action' as Route);

  await db
    .update(dailyAgentActions)
    .set({ status, draftText, updatedAt: new Date() })
    .where(eq(dailyAgentActions.id, action.id));

  await refreshDailyAgent(action.sessionId);
  redirect(`/app/daily-agent?session=${action.sessionId}&ok=action` as Route);
}

export async function logDailyAgentActionToRelationship(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const actionId = requiredString(formData, 'actionId');

  if (!workspaceId || !actionId) redirect('/app/daily-agent?error=invalid' as Route);
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);

  const rows = await db
    .select()
    .from(dailyAgentActions)
    .where(and(eq(dailyAgentActions.id, actionId), eq(dailyAgentActions.workspaceId, workspaceId)))
    .limit(1);

  const action = rows[0];
  if (!action) redirect('/app/daily-agent?error=missing-action' as Route);

  const leadName = action.personName || 'LinkedIn contact';
  const existing = await db
    .select({ id: leadPipeline.id, notes: leadPipeline.notes, intentScore: leadPipeline.intentScore })
    .from(leadPipeline)
    .where(and(eq(leadPipeline.workspaceId, workspaceId), eq(leadPipeline.leadName, leadName)))
    .limit(1);

  const score = action.priority === 'high' ? 85 : action.priority === 'medium' ? 55 : 25;
  const relationshipStage = action.recommendedChannel === 'meeting_prep' ? 'partner_referral' : action.recommendedChannel === 'review_profile' ? 'review_only' : action.recommendedChannel === 'monitor' || action.recommendedChannel === 'no_dm_yet' ? 'monitor' : action.priority === 'high' ? 'potential_opportunity' : 'warm_relationship';
  const note = [
    `Daily Agent ${action.actionType}: ${action.reason ?? 'Recommended action'}`,
    action.draftText ? `Draft/action: ${action.draftText}` : null,
  ].filter(Boolean).join('\n');

  let leadId = existing[0]?.id;
  if (leadId) {
    await db
      .update(leadPipeline)
      .set({
        intentScore: Math.max(existing[0].intentScore ?? 0, score),
        nextAction: action.draftText ?? action.reason ?? 'Review LinkedIn follow-up.',
        notes: [existing[0].notes, note].filter(Boolean).join('\n\n'),
        updatedAt: new Date(),
      })
      .where(eq(leadPipeline.id, leadId));
  } else {
    const [lead] = await db
      .insert(leadPipeline)
      .values({
        workspaceId,
        brandId: action.brandId,
        leadName,
        leadHandle: action.personHandle,
        stage: relationshipStage,
        intentScore: score,
        nextAction: action.draftText ?? action.reason ?? 'Review LinkedIn follow-up.',
        notes: note,
        metadata: {
          source: 'daily_agent',
          actionId: action.id,
          sessionId: action.sessionId,
          actionType: action.actionType,
          recommendedChannel: action.recommendedChannel,
          relationshipStatus: relationshipStage,
        },
      })
      .returning({ id: leadPipeline.id });
    leadId = lead.id;
  }

  await db
    .update(dailyAgentActions)
    .set({ status: 'logged', linkedLeadId: leadId, updatedAt: new Date() })
    .where(eq(dailyAgentActions.id, action.id));

  await refreshDailyAgent(action.sessionId);
  redirect(`/app/daily-agent?session=${action.sessionId}&ok=logged` as Route);
}

export async function updateDailyAgentFeedback(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const sessionId = requiredString(formData, 'sessionId');
  const usefulnessRating = requiredString(formData, 'usefulnessRating');
  const feedbackNotes = nullableString(formData, 'feedbackNotes');

  if (!workspaceId || !sessionId) redirect('/app/daily-agent?error=invalid' as Route);
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);

  await db
    .update(dailyAgentSessions)
    .set({ usefulnessRating, feedbackNotes, updatedAt: new Date() })
    .where(and(eq(dailyAgentSessions.id, sessionId), eq(dailyAgentSessions.workspaceId, workspaceId)));

  await refreshDailyAgent(sessionId);
  redirect(`/app/daily-agent?session=${sessionId}&ok=feedback` as Route);
}
