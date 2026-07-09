import { and, count, desc, eq, gte, inArray } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { brands, dailyAgentActions, dailyAgentSessions, leadPipeline } from '../../../drizzle/schema';
import type { DailyAgentBriefing } from '@/lib/ai/daily-agent';

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function normaliseMetadata(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
}

export async function getOpportunitySettingsSnapshot(workspaceId: string) {
  const brandRows = await db
    .select({
      id: brands.id,
      name: brands.name,
      defaultTone: brands.defaultTone,
      audience: brands.audience,
      primaryCta: brands.primaryCta,
      secondaryCta: brands.secondaryCta,
      metadata: brands.metadata,
    })
    .from(brands)
    .where(eq(brands.workspaceId, workspaceId))
    .orderBy(brands.name);

  return brandRows.map((brand) => ({ ...brand, metadata: normaliseMetadata(brand.metadata) }));
}

export async function getWeeklyOpportunityPlan(workspaceId: string) {
  const since = daysAgo(7);

  const sessions = await db
    .select({
      id: dailyAgentSessions.id,
      brandId: dailyAgentSessions.brandId,
      sessionDate: dailyAgentSessions.sessionDate,
      summary: dailyAgentSessions.summary,
      briefingJson: dailyAgentSessions.briefingJson,
      generationMode: dailyAgentSessions.generationMode,
      usefulnessRating: dailyAgentSessions.usefulnessRating,
      createdAt: dailyAgentSessions.createdAt,
    })
    .from(dailyAgentSessions)
    .where(and(eq(dailyAgentSessions.workspaceId, workspaceId), gte(dailyAgentSessions.createdAt, since)))
    .orderBy(desc(dailyAgentSessions.createdAt))
    .limit(10);

  const actions = await db
    .select()
    .from(dailyAgentActions)
    .where(and(eq(dailyAgentActions.workspaceId, workspaceId), gte(dailyAgentActions.createdAt, since)))
    .orderBy(desc(dailyAgentActions.createdAt))
    .limit(80);

  const relationships = await db
    .select()
    .from(leadPipeline)
    .where(eq(leadPipeline.workspaceId, workspaceId))
    .orderBy(desc(leadPipeline.intentScore), desc(leadPipeline.updatedAt))
    .limit(30);

  const highPriority = actions.filter((action) => action.priority === 'high');
  const publicReplies = actions.filter((action) => action.recommendedChannel === 'public_reply');
  const noDm = actions.filter((action) => action.recommendedChannel === 'no_dm_yet' || action.recommendedChannel === 'monitor' || action.recommendedChannel === 'review_profile');
  const followUps = actions.filter((action) => ['follow_up', 'tracker_update', 'meeting_prep'].includes(action.actionType) || ['dm', 'meeting_prep', 'tracker_update'].includes(action.recommendedChannel));
  const logged = actions.filter((action) => action.status === 'logged');
  const copiedOrSent = actions.filter((action) => ['copied', 'sent_manually', 'approved'].includes(action.status));

  const briefings = sessions
    .map((session) => session.briefingJson as DailyAgentBriefing | null)
    .filter(Boolean) as DailyAgentBriefing[];

  const contentIdeas = briefings
    .map((briefing) => briefing.tomorrowContentIdea)
    .filter(Boolean)
    .slice(0, 5);

  const analyticsSignals = briefings.flatMap((briefing) => briefing.analyticsReview?.signals ?? []).slice(0, 10);
  const topPeople = relationships.slice(0, 8);

  const nextFive = [
    ...highPriority,
    ...followUps.filter((action) => !highPriority.some((item) => item.id === action.id)),
    ...publicReplies.filter((action) => !highPriority.some((item) => item.id === action.id)),
  ]
    .filter((action, index, array) => array.findIndex((item) => item.id === action.id) === index)
    .slice(0, 5);

  return {
    sessions,
    actions,
    relationships,
    metrics: {
      sessions: sessions.length,
      actions: actions.length,
      highPriority: highPriority.length,
      publicReplies: publicReplies.length,
      noDm: noDm.length,
      logged: logged.length,
      copiedOrSent: copiedOrSent.length,
      trackedRelationships: relationships.length,
    },
    topPeople,
    nextFive,
    followUps: followUps.slice(0, 10),
    noDm,
    contentIdeas,
    analyticsSignals,
  };
}

export async function getPilotDashboardSnapshot(workspaceId: string) {
  const since = daysAgo(30);
  const [sessionCount] = await db
    .select({ value: count() })
    .from(dailyAgentSessions)
    .where(and(eq(dailyAgentSessions.workspaceId, workspaceId), gte(dailyAgentSessions.createdAt, since)));

  const [actionCount] = await db
    .select({ value: count() })
    .from(dailyAgentActions)
    .where(and(eq(dailyAgentActions.workspaceId, workspaceId), gte(dailyAgentActions.createdAt, since)));

  const [loggedCount] = await db
    .select({ value: count() })
    .from(dailyAgentActions)
    .where(and(eq(dailyAgentActions.workspaceId, workspaceId), gte(dailyAgentActions.createdAt, since), eq(dailyAgentActions.status, 'logged')));

  const [usefulCount] = await db
    .select({ value: count() })
    .from(dailyAgentSessions)
    .where(and(eq(dailyAgentSessions.workspaceId, workspaceId), gte(dailyAgentSessions.createdAt, since), eq(dailyAgentSessions.usefulnessRating, 'useful')));

  const recentSessions = await db
    .select({
      id: dailyAgentSessions.id,
      sessionDate: dailyAgentSessions.sessionDate,
      summary: dailyAgentSessions.summary,
      generationMode: dailyAgentSessions.generationMode,
      usefulnessRating: dailyAgentSessions.usefulnessRating,
      createdAt: dailyAgentSessions.createdAt,
    })
    .from(dailyAgentSessions)
    .where(and(eq(dailyAgentSessions.workspaceId, workspaceId), gte(dailyAgentSessions.createdAt, since)))
    .orderBy(desc(dailyAgentSessions.createdAt))
    .limit(12);

  const stuckActions = await db
    .select()
    .from(dailyAgentActions)
    .where(and(eq(dailyAgentActions.workspaceId, workspaceId), gte(dailyAgentActions.createdAt, since), inArray(dailyAgentActions.status, ['draft', 'needs_edit'])))
    .orderBy(desc(dailyAgentActions.createdAt))
    .limit(12);

  return {
    metrics: {
      sessions: Number(sessionCount?.value ?? 0),
      actions: Number(actionCount?.value ?? 0),
      logged: Number(loggedCount?.value ?? 0),
      useful: Number(usefulCount?.value ?? 0),
    },
    recentSessions,
    stuckActions,
  };
}

export async function getProofScoreSnapshot(workspaceId: string) {
  const weekly = await getWeeklyOpportunityPlan(workspaceId);
  const pilot = await getPilotDashboardSnapshot(workspaceId);
  const settings = await getOpportunitySettingsSnapshot(workspaceId);

  const configuredBrands = settings.filter((brand) => {
    const metadata = normaliseMetadata(brand.metadata);
    const desk = metadata.opportunityDesk as Record<string, unknown> | undefined;
    return Boolean(
      desk &&
      String(desk.offer ?? '').trim() &&
      Array.isArray(desk.idealCustomers) && desk.idealCustomers.length &&
      Array.isArray(desk.warmSignals) && desk.warmSignals.length &&
      String(desk.dmPolicy ?? '').trim() &&
      Array.isArray(desk.contentLanes) && desk.contentLanes.length,
    );
  });

  const sessionsScore = Math.min(20, weekly.metrics.sessions * 5);
  const actionScore = Math.min(20, weekly.metrics.copiedOrSent * 4 + weekly.metrics.logged * 4);
  const memoryScore = Math.min(20, weekly.metrics.trackedRelationships * 4);
  const settingsScore = settings.length ? Math.round((configuredBrands.length / settings.length) * 20) : 0;
  const disciplineScore = Math.min(20, weekly.metrics.noDm * 3 + weekly.metrics.publicReplies * 2);
  const score = Math.min(100, sessionsScore + actionScore + memoryScore + settingsScore + disciplineScore);

  const blockers = [
    weekly.metrics.sessions < 3 ? 'Run at least 3 Daily Agent sessions in a week to prove habit formation.' : null,
    weekly.metrics.copiedOrSent < 3 ? 'Copy, approve or mark at least 3 actions so the product proves it changes behaviour.' : null,
    weekly.metrics.logged < 3 ? 'Log at least 3 relationship updates so Repurly has visible memory.' : null,
    configuredBrands.length < settings.length ? 'Complete Opportunity Settings for every active beta brand.' : null,
    weekly.metrics.noDm < 2 ? 'Capture no-DM / monitor decisions so Repurly proves safe relationship discipline.' : null,
  ].filter(Boolean) as string[];

  const strengths = [
    weekly.metrics.sessions >= 3 ? 'Weekly habit signal is forming.' : null,
    weekly.metrics.copiedOrSent >= 3 ? 'Users are acting on the recommendations.' : null,
    weekly.metrics.logged >= 3 ? 'Relationship memory is being created.' : null,
    configuredBrands.length === settings.length && settings.length > 0 ? 'Opportunity settings are configured for the active brands.' : null,
    weekly.metrics.noDm >= 2 ? 'The product is protecting users from weak DMs and over-outreach.' : null,
  ].filter(Boolean) as string[];

  return {
    score,
    band: score >= 85 ? 'launch-ready private beta' : score >= 70 ? 'strong assisted beta' : score >= 50 ? 'usable internal beta' : 'setup and usage needed',
    weekly,
    pilot,
    settings,
    configuredBrands: configuredBrands.length,
    blockers,
    strengths,
    scoreBreakdown: {
      sessionsScore,
      actionScore,
      memoryScore,
      settingsScore,
      disciplineScore,
    },
  };
}
