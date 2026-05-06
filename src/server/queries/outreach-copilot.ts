import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { brands, leadPipeline } from '../../../drizzle/schema';
import type { OutreachMetadata } from '@/lib/outreach/copilot';

type LeadRow = {
  id: string;
  brandName: string | null;
  leadName: string;
  leadHandle: string | null;
  stage: string;
  intentScore: number;
  nextAction: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  lastContactAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function asMetadata(value: Record<string, unknown> | null): OutreachMetadata | null {
  if (!value || value.copilotVersion !== 'manual-v1') return null;
  return value as OutreachMetadata;
}

function toDateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getOutreachCopilotSnapshot(workspaceId: string) {
  const rows = await db
    .select({
      id: leadPipeline.id,
      brandName: brands.name,
      leadName: leadPipeline.leadName,
      leadHandle: leadPipeline.leadHandle,
      stage: leadPipeline.stage,
      intentScore: leadPipeline.intentScore,
      nextAction: leadPipeline.nextAction,
      notes: leadPipeline.notes,
      metadata: leadPipeline.metadata,
      lastContactAt: leadPipeline.lastContactAt,
      createdAt: leadPipeline.createdAt,
      updatedAt: leadPipeline.updatedAt,
    })
    .from(leadPipeline)
    .leftJoin(brands, eq(brands.id, leadPipeline.brandId))
    .where(eq(leadPipeline.workspaceId, workspaceId))
    .orderBy(desc(leadPipeline.updatedAt));

  const prospects = (rows as LeadRow[])
    .map((row) => ({ ...row, outreach: asMetadata(row.metadata) }))
    .filter((row): row is LeadRow & { outreach: OutreachMetadata } => Boolean(row.outreach));

  const today = todayDateOnly();
  const queue = prospects
    .filter((lead) => {
      if (lead.stage === 'closed' || lead.outreach.decision === 'skip') return false;
      const actionDate = toDateOnly(lead.outreach.nextActionDate);
      return !actionDate || actionDate <= today;
    })
    .sort((a, b) => b.intentScore - a.intentScore);

  const sendNow = prospects.filter((lead) => lead.outreach.decision === 'send_now').length;
  const warmUp = prospects.filter((lead) => lead.outreach.decision === 'warm_up_first').length;
  const overdue = prospects.filter((lead) => {
    const actionDate = toDateOnly(lead.outreach.nextActionDate);
    return Boolean(actionDate && actionDate < today && lead.stage !== 'closed');
  }).length;
  const draftsReady = prospects.filter((lead) => Boolean(lead.outreach.messageDrafts)).length;

  const brandOptions = await db
    .select({ id: brands.id, name: brands.name, primaryCta: brands.primaryCta, defaultTone: brands.defaultTone })
    .from(brands)
    .where(eq(brands.workspaceId, workspaceId));

  return {
    prospects,
    queue,
    brands: brandOptions,
    metrics: {
      prospectsTotal: prospects.length,
      queueToday: queue.length,
      sendNow,
      warmUp,
      overdue,
      draftsReady,
    },
  };
}
