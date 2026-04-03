import { redirect } from 'next/navigation';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getWorkspaceSetupState } from '@/lib/onboarding/setup';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireWorkspaceSession();
  const setup = await getWorkspaceSetupState(session.workspaceId);

  if (!setup.isReadyForComposer) {
    redirect('/app?setup=required');
  }

  return <>{children}</>;
}
