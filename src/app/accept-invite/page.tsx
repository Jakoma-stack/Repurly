import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { acceptWorkspaceInvite } from '@/server/actions/settings';

export default async function AcceptInvitePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Accept workspace invite</h1>
          <p className="text-sm text-muted-foreground">Join the invited workspace using the same email address that received the invitation.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            <form action={acceptWorkspaceInvite} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              <div className="rounded-2xl border border-border bg-slate-50 p-4 text-sm text-slate-700">You will be added to the workspace after sign-in if the invite email matches your current account email.</div>
              <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Accept invite</button>
            </form>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Invite token missing.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
