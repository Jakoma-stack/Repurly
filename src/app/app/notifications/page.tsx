import { NotificationsCenter } from '@/components/notifications/notifications-center';
import { getWorkspaceNotifications } from '@/server/queries/notifications';
import { requireWorkspaceSession } from '@/lib/auth/workspace';

export default async function NotificationsPage() {
  const session = await requireWorkspaceSession();
  const items = await getWorkspaceNotifications(session.workspaceId);
  return <NotificationsCenter items={items} />;
}
