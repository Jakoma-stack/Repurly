import { NotificationsCenter } from '@/components/notifications/notifications-center';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getWorkspaceNotifications } from '@/server/queries/notifications';

export default async function NotificationsPage() {
  const session = await requireWorkspaceSession();
  const items = await getWorkspaceNotifications(session.workspaceId);

  return <NotificationsCenter items={items} />;
}
