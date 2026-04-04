import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getWorkspaceBillingAccessState } from '@/lib/billing/workspace-billing';

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const session = await requireWorkspaceSession();

  if (session.workspaceId === '__local_setup__') {
    return (
      <AppShell session={session}>
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-xl border bg-background p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Workspace setup needed</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              You are signed in, but this Clerk user does not have a workspace membership in the database yet.
              For local development, Repurly is showing this setup screen instead of bouncing you back to the homepage.
            </p>

            <div className="mt-6 space-y-3 text-sm">
              <p><strong>Next step:</strong> seed or create a workspace + membership for your Clerk user.</p>
              <p>Helpful commands to try from the project root:</p>
              <pre className="overflow-x-auto rounded-lg border bg-muted p-4 text-xs">{`npm run seed\n# or create the workspace/user membership in your DB manually`}</pre>
              <p className="text-muted-foreground">
                After the workspace exists, refresh <code>/app</code>.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-pathname') ?? '/app';
  const billing = await getWorkspaceBillingAccessState(session.workspaceId);
  const isBillingRoute = pathname.startsWith('/app/billing');

  if (billing && !billing.hasPaidAccess && !isBillingRoute) {
    redirect('/app/billing?billing=payment-required');
  }

  return <AppShell session={session}>{children}</AppShell>;
}
