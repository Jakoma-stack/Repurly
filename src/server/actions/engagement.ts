'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { buildReplyOptions, scoreCommentIntent } from '@/lib/ai/engagement';
import { brands, engagementComments, engagementReplyDrafts, leadPipeline } from '../../../drizzle/schema';

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function refreshPages() {
  revalidatePath('/app');
  revalidatePath('/app/engagement');
  revalidatePath('/app/leads');
}

async function upsertLeadFromComment(args: {
  workspaceId: string;
  brandId?: string | null;
  commentId: string;
  leadName: string;
  leadHandle?: string | null;
  intentScore: number;
  nextAction?: string | null;
}) {
  const existing = await db
    .select({ id: leadPipeline.id })
    .from(leadPipeline)
    .where(and(eq(leadPipeline.workspaceId, args.workspaceId), eq(leadPipeline.commentId, args.commentId)))
    .limit(1);

  const values = {
    workspaceId: args.workspaceId,
    brandId: args.brandId ?? null,
    commentId: args.commentId,
    leadName: args.leadName,
    leadHandle: args.leadHandle ?? null,
    intentScore: args.intentScore,
    stage: args.intentScore >= 75 ? 'qualified' : 'new',
    nextAction: args.nextAction ?? (args.intentScore >= 75 ? 'Send DM and offer a practical next step.' : 'Reply in-thread and gauge buying intent.'),
    notes: null,
    updatedAt: new Date(),
  };

  if (existing[0]?.id) {
    await db.update(leadPipeline).set(values).where(eq(leadPipeline.id, existing[0].id));
    return existing[0].id;
  }

  const inserted = await db.insert(leadPipeline).values(values).returning({ id: leadPipeline.id });
  return inserted[0]?.id ?? null;
}

export async function saveEngagementComment(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const brandId = requiredString(formData, 'brandId') || null;
  const commenterName = requiredString(formData, 'commenterName');
  const commenterHandle = requiredString(formData, 'commenterHandle') || null;
  const sourcePostTitle = requiredString(formData, 'sourcePostTitle') || null;
  const commentText = requiredString(formData, 'commentText');

  if (!workspaceId || !commenterName || !commentText) {
    redirect('/app/engagement?error=invalid' as Route);
  }

  const intent = scoreCommentIntent(commentText);

  const inserted = await db
    .insert(engagementComments)
    .values({
      workspaceId,
      brandId,
      platform: 'linkedin',
      commenterName,
      commenterHandle,
      sourcePostTitle,
      commentText,
      intentLabel: intent.intentLabel,
      intentScore: intent.intentScore,
      sentiment: intent.sentiment,
    })
    .returning({ id: engagementComments.id });

  const commentId = inserted[0]?.id;
  if (commentId && intent.intentScore >= 45) {
    await upsertLeadFromComment({
      workspaceId,
      brandId,
      commentId,
      leadName: commenterName,
      leadHandle: commenterHandle,
      intentScore: intent.intentScore,
    });
  }

  await refreshPages();
  redirect('/app/engagement?ok=captured' as Route);
}

export async function generateEngagementReply(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const commentId = requiredString(formData, 'commentId');
  if (!workspaceId || !commentId) redirect('/app/engagement?error=invalid' as Route);

  const rows = await db
    .select({
      id: engagementComments.id,
      workspaceId: engagementComments.workspaceId,
      brandId: engagementComments.brandId,
      commenterName: engagementComments.commenterName,
      commenterHandle: engagementComments.commenterHandle,
      commentText: engagementComments.commentText,
      sourcePostTitle: engagementComments.sourcePostTitle,
      intentLabel: engagementComments.intentLabel,
      intentScore: engagementComments.intentScore,
      brandName: brands.name,
      brandTone: brands.defaultTone,
      primaryCta: brands.primaryCta,
    })
    .from(engagementComments)
    .leftJoin(brands, eq(brands.id, engagementComments.brandId))
    .where(and(eq(engagementComments.id, commentId), eq(engagementComments.workspaceId, workspaceId)))
    .limit(1);

  const comment = rows[0];
  if (!comment) redirect('/app/engagement?error=missing' as Route);

  const suggestions = await buildReplyOptions({
    brandName: comment.brandName ?? 'Repurly',
    brandTone: comment.brandTone,
    commentText: comment.commentText,
    intentLabel: comment.intentLabel as 'hot' | 'warm' | 'nurture' | 'spam',
    sourcePostTitle: comment.sourcePostTitle,
    primaryCta: comment.primaryCta,
  });

  await db
    .update(engagementComments)
    .set({
      replyOptions: suggestions.replies,
      suggestedDmText: suggestions.dm,
      metadata: {
        aiQualificationSummary: suggestions.qualificationSummary,
        aiNextBestAction: suggestions.nextBestAction,
        aiEscalationRecommendation: suggestions.escalationRecommendation,
      },
      updatedAt: new Date(),
    })
    .where(eq(engagementComments.id, comment.id));

  if (comment.intentScore >= 45) {
    await upsertLeadFromComment({
      workspaceId,
      brandId: comment.brandId,
      commentId: comment.id,
      leadName: comment.commenterName,
      leadHandle: comment.commenterHandle,
      intentScore: comment.intentScore,
      nextAction: suggestions.nextBestAction,
    });

    const leadRows = await db
      .select({ id: leadPipeline.id })
      .from(leadPipeline)
      .where(and(eq(leadPipeline.workspaceId, workspaceId), eq(leadPipeline.commentId, comment.id)))
      .limit(1);

    if (leadRows[0]?.id) {
      await db
        .update(leadPipeline)
        .set({ notes: suggestions.leadNotes, nextAction: suggestions.nextBestAction, updatedAt: new Date() })
        .where(eq(leadPipeline.id, leadRows[0].id));
    }
  } else {
    await db
      .update(engagementComments)
      .set({
        metadata: {
          aiQualificationSummary: suggestions.qualificationSummary,
          aiNextBestAction: suggestions.nextBestAction,
          aiEscalationRecommendation: suggestions.escalationRecommendation,
        },
        updatedAt: new Date(),
      })
      .where(eq(engagementComments.id, comment.id));
  }

  await refreshPages();
  redirect('/app/engagement?ok=generated' as Route);
}

export async function markReplySent(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const commentId = requiredString(formData, 'commentId');
  const replyText = requiredString(formData, 'replyText');
  const dmText = requiredString(formData, 'dmText');
  const dmRequested = requiredString(formData, 'sendDm') === 'yes';

  if (!workspaceId || !commentId || !replyText) redirect('/app/engagement?error=invalid' as Route);

  const rows = await db
    .select({
      id: engagementComments.id,
      brandId: engagementComments.brandId,
      commenterName: engagementComments.commenterName,
      commenterHandle: engagementComments.commenterHandle,
      intentScore: engagementComments.intentScore,
    })
    .from(engagementComments)
    .where(and(eq(engagementComments.id, commentId), eq(engagementComments.workspaceId, workspaceId)))
    .limit(1);

  const comment = rows[0];
  if (!comment) redirect('/app/engagement?error=missing' as Route);

  await db.insert(engagementReplyDrafts).values({
    commentId,
    workspaceId,
    replyText,
    channel: dmRequested ? 'dm' : 'comment',
    status: 'sent',
    approvedAt: new Date(),
  });

  await db
    .update(engagementComments)
    .set({
      selectedReplyText: replyText,
      suggestedDmText: dmText || null,
      replyStatus: 'sent',
      dmStatus: dmRequested ? 'drafted' : 'not_started',
      updatedAt: new Date(),
    })
    .where(eq(engagementComments.id, commentId));

  await upsertLeadFromComment({
    workspaceId,
    brandId: comment.brandId,
    commentId,
    leadName: comment.commenterName,
    leadHandle: comment.commenterHandle,
    intentScore: comment.intentScore,
    nextAction: dmRequested ? 'Follow up in DM and confirm fit.' : 'Watch for response and decide whether to DM.',
  });

  const leadRows = await db
    .select({ id: leadPipeline.id })
    .from(leadPipeline)
    .where(and(eq(leadPipeline.workspaceId, workspaceId), eq(leadPipeline.commentId, commentId)))
    .limit(1);

  if (leadRows[0]?.id) {
    await db
      .update(leadPipeline)
      .set({
        stage: dmRequested ? (comment.intentScore >= 75 ? 'qualified' : 'contacted') : 'contacted',
        lastContactAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadPipeline.id, leadRows[0].id));
  }

  await refreshPages();
  redirect('/app/engagement?ok=sent' as Route);
}

export async function updateLeadStage(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const leadId = requiredString(formData, 'leadId');
  const stage = requiredString(formData, 'stage');
  const nextAction = requiredString(formData, 'nextAction') || null;
  const notes = requiredString(formData, 'notes') || null;

  if (!workspaceId || !leadId || !stage) redirect('/app/leads?error=invalid' as Route);

  await db
    .update(leadPipeline)
    .set({ stage, nextAction, notes, updatedAt: new Date() })
    .where(and(eq(leadPipeline.id, leadId), eq(leadPipeline.workspaceId, workspaceId)));

  await refreshPages();
  redirect(`/app/leads?ok=updated&stage=${stage}` as Route);
}
