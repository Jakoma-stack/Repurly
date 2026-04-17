import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { saveNotificationPreference } from '@/server/actions/notifications';
import { getNotificationPreferences } from '@/server/queries/notification-preferences';

export default async function NotificationSettingsPage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const preferences = await getNotificationPreferences(session.workspaceId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">Notification preferences</h1>
          <p className="text-sm text-muted-foreground">Choose how Repurly delivers publish outcomes: immediate in-app, immediate email, or a daily digest.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {preferences.map((pref) => (
            <form key={`${pref.channel}-${pref.eventGroup}`} action={saveNotificationPreference} className="rounded-2xl border border-border p-4">
              <input type="hidden" name="workspaceId" value={session.workspaceId} />
              <input type="hidden" name="channel" value={pref.channel} />
              <input type="hidden" name="eventGroup" value={pref.eventGroup} />
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium text-slate-900">{pref.channel} · {pref.eventGroup}</div>
                  <div className="text-sm text-muted-foreground">Backed by live publish delivery outcomes and provider callbacks.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="enabled" value={pref.enabled ? 'false' : 'true'} />
                  <button className="rounded-2xl border border-border px-4 py-2 text-sm font-medium text-slate-700">
                    {pref.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Digest</span>
                  <select name="digest" defaultValue={pref.digest} className="w-full rounded-2xl border border-border bg-white px-3 py-2">
                    <option value="instant">Instant</option>
                    <option value="daily">Daily</option>
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Target</span>
                  <input name="target" defaultValue={pref.target ?? ''} placeholder="Email address or destination" className="w-full rounded-2xl border border-border bg-white px-3 py-2" />
                </label>
              </div>
              <div className="mt-3">
                <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save preference</button>
              </div>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
