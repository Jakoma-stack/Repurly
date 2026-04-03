import { getPublishingQueue, getWorkflowMetrics } from '@/server/queries/workflow';

export async function getDashboardSnapshot(workspaceId: string) {
  const [metrics, queue] = await Promise.all([
    getWorkflowMetrics(workspaceId),
    getPublishingQueue(workspaceId),
  ]);

  return {
    metrics: [
      { label: 'Drafts', value: String(metrics.drafts) },
      { label: 'Approvals pending', value: String(metrics.approvalsPending) },
      { label: 'Scheduled', value: String(metrics.scheduled) },
      { label: 'Published', value: String(metrics.published) },
    ],
    queue,
  };
}
