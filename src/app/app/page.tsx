import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardSnapshot } from "@/server/queries/dashboard";
import Link from "next/link";
import { requireWorkspaceSession } from "@/lib/auth/workspace";

export default async function DashboardPage() {
  const session = await requireWorkspaceSession();
  const data = await getDashboardSnapshot(session.workspaceId);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <div className="text-sm text-muted-foreground">{metric.label}</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Publishing queue</h2>
              <p className="text-sm text-muted-foreground">What is going out next in the LinkedIn-first launch workflow.</p>
            </div>
            <Link href="/app/content"><Button>Create post</Button></Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span>Need deeper visibility than the queue?</span>
              <Link href="/app/activity" className="font-medium text-primary">Open publish history</Link>
            </div>
            {data.queue.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border p-4">
                <div className="text-sm text-muted-foreground">{item.scheduledFor}</div>
                <div className="mt-1 font-medium">{item.title}</div>
                <div className="mt-2 text-sm text-primary">{item.status}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Workspace setup</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>1. Connect LinkedIn as your live-first channel</div>
            <div>2. Connect your first publish account and choose the default target</div>
            <div>3. Create a brand and attach voice guidance</div>
            <div>4. Upload reusable image and video assets</div>
            <div>5. Confirm billing and team roles</div>
            <div>6. Add a secondary channel only after the pilot workflow proves itself</div>
            <div className="pt-2">
              <Link className="font-medium text-primary" href="/api/help/download-guide">Download quickstart guide</Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
