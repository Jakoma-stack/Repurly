import { redirect } from 'next/navigation';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getWorkspaceSetupState } from '@/lib/onboarding/setup';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const setup = await getWorkspaceSetupState(session.workspaceId);

  if (!setup.isReadyForComposer) {
    redirect('/app?setup=required');
  }

  return <>{children}</>;
}
