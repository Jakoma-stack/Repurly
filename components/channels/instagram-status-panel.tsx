const states = [
  {
    title: "Container processing",
    body: "Repurly now polls Instagram media containers before publish. Video, Reel, and carousel jobs stay in processing until Meta marks them ready.",
  },
  {
    title: "Actionable failures",
    body: "If Meta rejects media, the job result stores a user-facing message, phase, retryability, and a suggested next action like replace media, reconnect, or wait for processing.",
  },
  {
    title: "Graceful retries",
    body: "Jobs that are still processing stay queued instead of being marked failed. The durable workflow can retry them without losing the original scheduled post state.",
  },
];

export function InstagramStatusPanel() {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Instagram publish state handling</div>
          <div className="text-sm text-muted-foreground">Video and carousel workflows now surface clear progress and failure guidance instead of a vague pending state.</div>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Production-grade UX</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {states.map((state) => (
          <div key={state.title} className="rounded-2xl border border-border p-4">
            <div className="text-sm font-medium">{state.title}</div>
            <p className="mt-2 text-sm text-muted-foreground">{state.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
