import { and, count, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { brands, integrations, platformAccounts } from '../../../drizzle/schema';

export type WorkspaceSetupStep = {
  key: 'connect-linkedin' | 'confirm-linkedin-target' | 'brand-foundation' | 'open-composer';
  title: string;
  description: string;
  href: string;
  status: 'complete' | 'current' | 'blocked';
};

export type WorkspaceSetupState = {
  linkedInConnected: boolean;
  linkedInTargetCount: number;
  hasDefaultLinkedInTarget: boolean;
  brandCount: number;
  isReadyForComposer: boolean;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  steps: WorkspaceSetupStep[];
};

export async function getWorkspaceSetupState(workspaceId: string): Promise<WorkspaceSetupState> {
  const [[brandRow], [linkedInRow], [targetRow], [defaultTargetRow]] = await Promise.all([
    db.select({ total: count() }).from(brands).where(eq(brands.workspaceId, workspaceId)),
    db
      .select({ total: count() })
      .from(integrations)
      .where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.provider, 'linkedin'), eq(integrations.status, 'connected'))),
    db
      .select({ total: count() })
      .from(platformAccounts)
      .where(and(eq(platformAccounts.workspaceId, workspaceId), eq(platformAccounts.provider, 'linkedin'), eq(platformAccounts.publishEnabled, true))),
    db
      .select({ total: count() })
      .from(platformAccounts)
      .where(
        and(
          eq(platformAccounts.workspaceId, workspaceId),
          eq(platformAccounts.provider, 'linkedin'),
          eq(platformAccounts.publishEnabled, true),
          eq(platformAccounts.isDefault, true),
        ),
      ),
  ]);

  const brandCount = Number(brandRow?.total ?? 0);
  const linkedInConnected = Number(linkedInRow?.total ?? 0) > 0;
  const linkedInTargetCount = Number(targetRow?.total ?? 0);
  const hasDefaultLinkedInTarget = Number(defaultTargetRow?.total ?? 0) > 0;
  const isReadyForComposer = linkedInConnected && hasDefaultLinkedInTarget;

  const steps: WorkspaceSetupStep[] = [
    {
      key: 'connect-linkedin',
      title: 'Connect LinkedIn',
      description: 'Authenticate the workspace against LinkedIn before any live drafting or scheduling flow begins.',
      href: '/app/channels',
      status: linkedInConnected ? 'complete' : 'current',
    },
    {
      key: 'confirm-linkedin-target',
      title: 'Confirm the default LinkedIn target',
      description: 'Make sure the correct profile or company page is available and set as the workspace default target.',
      href: '/app/channels',
      status: !linkedInConnected ? 'blocked' : hasDefaultLinkedInTarget ? 'complete' : 'current',
    },
    {
      key: 'brand-foundation',
      title: 'Confirm at least one brand',
      description: 'Keep brand setup simple so posts, approvals, and queue items stay attached to the right client or business line.',
      href: '/app/content',
      status: brandCount > 0 ? 'complete' : isReadyForComposer ? 'current' : 'blocked',
    },
    {
      key: 'open-composer',
      title: 'Create the first LinkedIn draft',
      description: 'Once setup is complete, move into drafting, approval, scheduling, and queue review.',
      href: '/app/content',
      status: isReadyForComposer ? 'current' : 'blocked',
    },
  ];

  const primaryCtaHref = !linkedInConnected
    ? '/app/channels'
    : !hasDefaultLinkedInTarget
      ? '/app/channels'
      : '/app/content';

  const primaryCtaLabel = !linkedInConnected
    ? 'Start LinkedIn setup'
    : !hasDefaultLinkedInTarget
      ? 'Confirm LinkedIn target'
      : 'Open composer';

  return {
    linkedInConnected,
    linkedInTargetCount,
    hasDefaultLinkedInTarget,
    brandCount,
    isReadyForComposer,
    primaryCtaHref,
    primaryCtaLabel,
    steps,
  };
}
