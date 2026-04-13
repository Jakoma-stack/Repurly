import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function Hero() {
  return (
    <section
      id="workflow"
      className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-950 px-8 py-16 text-white shadow-[0_30px_120px_rgba(15,23,42,0.28)] lg:px-14 lg:py-20"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
      <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80 backdrop-blur">
            <CheckCircle2 className="size-4" /> LinkedIn-first content operations for agencies and B2B teams
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Run approvals, scheduling, publishing, and engagement like a premium operator.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Repurly brings drafting, target selection, approvals, queue visibility, operator controls, reporting, and AI-assisted engagement into one calmer workspace for multi-brand teams.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#pricing" className="inline-flex items-center rounded-2xl bg-white px-5 py-3 font-medium text-slate-950">
              See pricing <ArrowRight className="ml-2 size-4" />
            </a>
            <Link href="/sign-up" className="inline-flex items-center rounded-2xl border border-white/20 px-5 py-3 font-medium text-white/90">
              Start your workspace
            </Link>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="text-sm text-white/60">Publishing workflow</div>
            <div className="mt-3 space-y-3 text-sm">
              {[
                ['01', 'Plan and draft', 'Create content, attach assets, and keep working copy visible to the team.'],
                ['02', 'Review and approve', 'Move content through visible ownership instead of scattered message threads.'],
                ['03', 'Queue and publish', 'Schedule confidently with target selection, queue visibility, and clearer operator feedback.'],
                ['04', 'Respond and convert', 'Turn comments and signals into next actions with AI-assisted engagement and lead workflow.'],
              ].map(([step, title, body]) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-sky-300">{step}</div>
                  <div className="mt-1 text-base font-semibold">{title}</div>
                  <div className="mt-1 text-white/70">{body}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="text-sm text-white/60">What makes it different</div>
            <div className="mt-2 text-2xl font-semibold">Workflow control over channel sprawl</div>
            <div className="mt-3 text-sm text-white/70">
              Built for brands that care more about approvals, default targets, queue confidence, and recovery than a bloated social suite.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
