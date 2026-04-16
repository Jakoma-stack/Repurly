import { Card, CardContent, CardHeader } from '@/components/ui/card';

const items = [
  {
    title: 'Publish safety',
    body: 'Idempotency keys, queue-state tracking, and provider-aware retries reduce the odds of duplicate or silent failures.',
  },
  {
    title: 'Reconnect posture',
    body: 'Expiring tokens and broken channels should create visible alerts before a customer discovers a failed publish.',
  },
  {
    title: 'Operator awareness',
    body: 'Webhook/email alerts and the activity console give support a single place to see what happened and what to do next.',
  },
];

export function ReliabilityOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.title}>
          <CardHeader>
            <h3 className="text-base font-semibold">{item.title}</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{item.body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
