import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-slate-950 px-8 py-16 text-white shadow-[0_30px_120px_rgba(15,23,42,0.28)] lg:px-14 lg:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
      <div className="relative grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80 backdrop-blur">
            <CheckCircle2 className="size-4" /> Premium LinkedIn content operations
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Run LinkedIn publishing with one premium system for drafting, approvals, scheduling, and recovery.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Repurly gives agencies and B2B teams a focused platform for multi-brand LinkedIn operations, with AI-assisted drafting,
            queue visibility, engagement workflow, and operator-grade recovery tooling.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#pricing" className="inline-flex items-center rounded-2xl bg-white px-5 py-3 font-medium text-slate-950">
              See pricing <ArrowRight className="ml-2 size-4" />
            </a>
            <Link href="/sign-up" className="inline-flex items-center rounded-2xl border border-white/20 px-5 py-3 font-medium text-white/90">
              Open the platform
            </Link>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-sm text-white/60">Core workflow</div>
              <div className="mt-2 text-2xl font-semibold">Draft → approval → schedule → recovery</div>
              <div className="mt-3 text-sm text-emerald-300">Built for premium LinkedIn operations, not channel sprawl.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-sm text-white/60">Operational coverage</div>
              <div className="mt-2 text-2xl font-semibold">Brands, queue, engagement, and leads</div>
              <div className="mt-3 text-sm text-white/70">A focused system for agencies and B2B teams that need workflow control more than social-suite clutter.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
