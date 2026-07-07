import { and, count, desc, eq, gte } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { brands, dailyAgentActions, dailyAgentSessions, leadPipeline } from '../../../drizzle/schema';
import type { DailyAgentBriefing } from '@/lib/ai/daily-agent';

export const DAILY_AGENT_BETA_MONTHLY_LIMIT = Number(process.env.DAILY_AGENT_BETA_MONTHLY_LIMIT || 40);

function periodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getDailyAgentSnapshot(workspaceId: string, sessionId?: string | null) {
  const brandOptions = await db
    .select({
      id: brands.id,
      name: brands.name,
      defaultTone: brands.defaultTone,
      audience: brands.audience,
      primaryCta: brands.primaryCta,
      secondaryCta: brands.secondaryCta,
      linkedinProfileUrl: brands.linkedinProfileUrl,
      linkedinCompanyUrl: brands.linkedinCompanyUrl,
    })
    .from(brands)
    .where(eq(brands.workspaceId, workspaceId))
    .orderBy(brands.name);

  const sessions = await db
    .select({
      id: dailyAgentSessions.id,
      brandId: dailyAgentSessions.brandId,
      brandName: brands.name,
      sessionDate: dailyAgentSessions.sessionDate,
      summary: dailyAgentSessions.summary,
      status: dailyAgentSessions.status,
      usefulnessRating: dailyAgentSessions.usefulnessRating,
      createdAt: dailyAgentSessions.createdAt,
      updatedAt: dailyAgentSessions.updatedAt,
    })
    .from(dailyAgentSessions)
    .leftJoin(brands, eq(brands.id, dailyAgentSessions.brandId))
    .where(eq(dailyAgentSessions.workspaceId, workspaceId))
    .orderBy(desc(dailyAgentSessions.createdAt))
    .limit(12);

  const activeId = sessionId ?? sessions[0]?.id ?? null;
  const activeRows = activeId
    ? await db
        .select({
          id: dailyAgentSessions.id,
          brandId: dailyAgentSessions.brandId,
          brandName: brands.name,
          sessionDate: dailyAgentSessions.sessionDate,
          rawNotifications: dailyAgentSessions.rawNotifications,
          rawComments: dailyAgentSessions.rawComments,
          rawAnalytics: dailyAgentSessions.rawAnalytics,
          analyticsImportJson: dailyAgentSessions.analyticsImportJson,
          rawProfiles: dailyAgentSessions.rawProfiles,
          rawNotes: dailyAgentSessions.rawNotes,
          summary: dailyAgentSessions.summary,
          briefingJson: dailyAgentSessions.briefingJson,
          generationMode: dailyAgentSessions.generationMode,
          status: dailyAgentSessions.status,
          usefulnessRating: dailyAgentSessions.usefulnessRating,
          feedbackNotes: dailyAgentSessions.feedbackNotes,
          createdAt: dailyAgentSessions.createdAt,
          updatedAt: dailyAgentSessions.updatedAt,
        })
        .from(dailyAgentSessions)
        .leftJoin(brands, eq(brands.id, dailyAgentSessions.brandId))
        .where(and(eq(dailyAgentSessions.id, activeId), eq(dailyAgentSessions.workspaceId, workspaceId)))
        .limit(1)
    : [];

  const activeSession = activeRows[0]
    ? { ...activeRows[0], briefing: activeRows[0].briefingJson as DailyAgentBriefing | null, analyticsImport: activeRows[0].analyticsImportJson as Record<string, unknown> | null }
    : null;

  const actions = activeSession
    ? await db
        .select()
        .from(dailyAgentActions)
        .where(and(eq(dailyAgentActions.sessionId, activeSession.id), eq(dailyAgentActions.workspaceId, workspaceId)))
        .orderBy(desc(dailyAgentActions.priority), desc(dailyAgentActions.createdAt))
    : [];

  const relationshipRows = await db
    .select({
      id: leadPipeline.id,
      leadName: leadPipeline.leadName,
      leadHandle: leadPipeline.leadHandle,
      stage: leadPipeline.stage,
      intentScore: leadPipeline.intentScore,
      nextAction: leadPipeline.nextAction,
      notes: leadPipeline.notes,
      lastContactAt: leadPipeline.lastContactAt,
      updatedAt: leadPipeline.updatedAt,
    })
    .from(leadPipeline)
    .where(eq(leadPipeline.workspaceId, workspaceId))
    .orderBy(desc(leadPipeline.updatedAt))
    .limit(20);

  const monthPrefix = `${periodKey()}%`;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const usageRows = await db
    .select({ value: count() })
    .from(dailyAgentSessions)
    .where(and(eq(dailyAgentSessions.workspaceId, workspaceId), gte(dailyAgentSessions.createdAt, monthStart)));
  const monthCount = Number(usageRows[0]?.value ?? 0);

  return {
    brandOptions,
    sessions,
    activeSession,
    actions,
    relationships: relationshipRows,
    usage: {
      period: monthPrefix.replace('%', ''),
      used: monthCount,
      limit: DAILY_AGENT_BETA_MONTHLY_LIMIT,
      remaining: Math.max(0, DAILY_AGENT_BETA_MONTHLY_LIMIT - monthCount),
    },
  };
}
