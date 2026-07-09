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
      { label: 'Brands', value: String(metrics.brandCount) },
      { label: 'Hot leads', value: String(metrics.hotLeads) },
    ],
    queue,
    workflow: metrics,
  };
}
