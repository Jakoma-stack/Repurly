import { Card, CardContent, CardHeader } from '@/components/ui/card';

const providers = [
  { key: 'stripe', status: 'Live', body: 'Subscription lifecycle webhooks can update workspace billing state and trigger upgrade prompts.' },
  { key: 'meta', status: 'Ready', body: 'Meta webhooks can acknowledge container and page events so Instagram and Facebook workflows do less blind polling.' },
  { key: 'x', status: 'Ready', body: 'X webhook intake can capture account or post health events into the ops trail.' },
  { key: 'youtube', status: 'Ready', body: 'YouTube callback intake can record upload processing state and surface it in activity history.' },
];

export function WebhookStatus() {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Webhook intake posture</h2>
        <p className="text-sm text-muted-foreground">Where providers support callbacks, Repurly should use them to move jobs forward, refresh activity timelines, and warn customers sooner.</p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {providers.map((provider) => (
          <div key={provider.key} className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-slate-900">{provider.key}</div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">{provider.status}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{provider.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
