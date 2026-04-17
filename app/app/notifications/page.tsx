import { NotificationsCenter } from '@/components/notifications/notifications-center';
import { getWorkspaceNotifications } from '@/server/queries/notifications';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';

export default async function NotificationsPage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const items = await getWorkspaceNotifications(session.workspaceId);
  return <NotificationsCenter items={items} />;
}
