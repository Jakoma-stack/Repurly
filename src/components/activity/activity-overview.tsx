import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function ActivityOverview({
  highlights,
}: {
  highlights: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {highlights.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <div className="text-sm text-muted-foreground">{item.label}</div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
