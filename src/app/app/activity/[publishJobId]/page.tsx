import { notFound } from 'next/navigation';

import { ActivityDetail } from '@/components/activity/activity-detail';
import { getPublishActivityDetail } from '@/server/queries/publish-activity-detail';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';

export default async function PublishJobDetailPage({
  params,
}: {
  params: Promise<{ publishJobId: string }>;
}) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const { publishJobId } = await params;
  const detail = await getPublishActivityDetail(publishJobId);

  if (!detail) {
    notFound();
  }

  return <ActivityDetail detail={detail} />;
}
