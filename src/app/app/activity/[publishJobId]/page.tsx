import { notFound } from 'next/navigation';

import { ActivityDetail } from '@/components/activity/activity-detail';
import { getPublishActivityDetail } from '@/server/queries/publish-activity-detail';

export default async function PublishJobDetailPage({
  params,
}: {
  params: Promise<{ publishJobId: string }>;
}) {
  const { publishJobId } = await params;
  const detail = await getPublishActivityDetail(publishJobId);

  if (!detail) {
    notFound();
  }

  return <ActivityDetail detail={detail} />;
}
