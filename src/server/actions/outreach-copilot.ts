'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { requireWorkspaceRole } from '@/lib/auth/workspace';
import {
  buildOutreachDrafts,
  defaultNextActionForDecision,
  outreachGuardrailNote,
  scoreOutreachProspect,
  type OutreachChannel,
  type OutreachMetadata,
  type OutreachOffer,
} from '@/lib/outreach/copilot';
import { leadPipeline } from '../../../drizzle/schema';

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

async function refreshPages() {
  revalidatePath('/app');
  revalidatePath('/app/leads');
  revalidatePath('/app/engagement');
  revalidatePath('/app/outreach-copilot');
}

function normaliseStage(stage: string) {
  const allowed = new Set(['new', 'contacted', 'qualified', 'nurture', 'closed']);
  return allowed.has(stage) ? stage : 'new';
}

function buildMetadata(formData: FormData, leadName: string): { score: number; metadata: OutreachMetadata; nextAction: string } {
  const channel = (requiredString(formData, 'channel') || 'manual') as OutreachChannel;
  const offerFit = (requiredString(formData, 'offerFit') || 'General') as OutreachOffer;
  const relationship = requiredString(formData, 'relationship') || 'cold / unknown';
  const roleOrBusinessType = requiredString(formData, 'roleOrBusinessType');
  const sector = requiredString(formData, 'sector');
  const whyRelevant = requiredString(formData, 'whyRelevant');
  const source = requiredString(formData, 'source') || channel;
  const sourceUrl = requiredString(formData, 'sourceUrl') || undefined;
  const nextActionDate = requiredString(formData, 'nextActionDate') || todayIsoDate();

  const scored = scoreOutreachProspect({ relationship, roleOrBusinessType, sector, whyRelevant, channel, source });
  const drafts = buildOutreachDrafts({ leadName, offerFit, channel, whyRelevant, roleOrBusinessType });
  const nextAction = defaultNextActionForDecision(scored.decision, channel);

  return {
    score: scored.score,
    nextAction,
    metadata: {
      copilotVersion: 'manual-v1',
      source,
      sourceUrl,
      channel,
      offerFit,
      relationship,
      roleOrBusinessType,
      sector,
      whyRelevant,
      nextActionDate,
      scoreBreakdown: scored.breakdown,
      decision: scored.decision,
      actionType: nextAction,
      messageDrafts: drafts,
      guardrailNote: outreachGuardrailNote(),
    },
  };
}

export async function createOutreachProspect(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const brandId = nullableString(formData, 'brandId');
  const leadName = requiredString(formData, 'leadName');
  const leadHandle = nullableString(formData, 'leadHandle');
  const notes = nullableString(formData, 'notes');

  if (!workspaceId || !leadName) redirect('/app/outreach-copilot?error=invalid' as Route);
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);

  const { score, metadata, nextAction } = buildMetadata(formData, leadName);
  const stage = metadata.decision === 'send_now' ? 'new' : metadata.decision === 'skip' ? 'closed' : 'nurture';

  await db.insert(leadPipeline).values({
    workspaceId,
    brandId,
    leadName,
    leadHandle,
    stage,
    intentScore: score,
    nextAction,
    notes,
    metadata: metadata as Record<string, unknown>,
  });

  await refreshPages();
  redirect('/app/outreach-copilot?ok=created' as Route);
}

export async function regenerateOutreachDrafts(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const leadId = requiredString(formData, 'leadId');
  if (!workspaceId || !leadId) redirect('/app/outreach-copilot?error=invalid' as Route);
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);

  const rows = await db
    .select({ id: leadPipeline.id, leadName: leadPipeline.leadName, metadata: leadPipeline.metadata })
    .from(leadPipeline)
    .where(and(eq(leadPipeline.id, leadId), eq(leadPipeline.workspaceId, workspaceId)))
    .limit(1);

  const lead = rows[0];
  const metadata = lead?.metadata as OutreachMetadata | null | undefined;
  if (!lead || metadata?.copilotVersion !== 'manual-v1') redirect('/app/outreach-copilot?error=missing' as Route);

  const messageDrafts = buildOutreachDrafts({
    leadName: lead.leadName,
    offerFit: metadata.offerFit,
    channel: metadata.channel,
    whyRelevant: metadata.whyRelevant,
    roleOrBusinessType: metadata.roleOrBusinessType,
  });

  const nextMetadata: OutreachMetadata = {
    ...metadata,
    messageDrafts,
    guardrailNote: outreachGuardrailNote(),
  };

  await db
    .update(leadPipeline)
    .set({ metadata: nextMetadata as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(leadPipeline.id, lead.id));

  await refreshPages();
  redirect('/app/outreach-copilot?ok=drafts' as Route);
}

export async function updateOutreachProspect(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const leadId = requiredString(formData, 'leadId');
  const stage = normaliseStage(requiredString(formData, 'stage'));
  const nextAction = nullableString(formData, 'nextAction');
  const nextActionDate = requiredString(formData, 'nextActionDate') || todayIsoDate();
  const notes = nullableString(formData, 'notes');
  const lastOutcome = nullableString(formData, 'lastOutcome');
  const markContacted = requiredString(formData, 'markContacted') === 'yes';

  if (!workspaceId || !leadId) redirect('/app/outreach-copilot?error=invalid' as Route);
  await requireWorkspaceRole(workspaceId, ['owner', 'admin', 'editor']);

  const rows = await db
    .select({ id: leadPipeline.id, metadata: leadPipeline.metadata })
    .from(leadPipeline)
    .where(and(eq(leadPipeline.id, leadId), eq(leadPipeline.workspaceId, workspaceId)))
    .limit(1);

  const lead = rows[0];
  const metadata = lead?.metadata as OutreachMetadata | null | undefined;
  if (!lead || metadata?.copilotVersion !== 'manual-v1') redirect('/app/outreach-copilot?error=missing' as Route);

  const nextMetadata: OutreachMetadata = {
    ...metadata,
    nextActionDate,
    lastOutcome: lastOutcome ?? metadata.lastOutcome,
  };

  const updateValues = {
    stage,
    nextAction,
    notes,
    metadata: nextMetadata as Record<string, unknown>,
    updatedAt: new Date(),
    ...(markContacted ? { lastContactAt: new Date() } : {}),
  };

  await db.update(leadPipeline).set(updateValues).where(eq(leadPipeline.id, lead.id));

  await refreshPages();
  redirect('/app/outreach-copilot?ok=updated' as Route);
}
