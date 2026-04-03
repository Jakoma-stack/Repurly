import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950 px-8 py-16 text-white shadow-card lg:px-14 lg:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(109,94,252,0.35),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(0,191,255,0.18),transparent_25%)]" />
      <div className="relative grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-sm text-white/80">
            <CheckCircle2 className="size-4" /> LinkedIn-first paid pilot build
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Finish the approval-to-publish workflow your LinkedIn team actually uses.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Repurly helps agencies and B2B teams move from draft to approval to scheduled LinkedIn publishing with clearer recovery, better operator visibility, and less enterprise bloat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#pilot-offer" className="inline-flex items-center rounded-2xl bg-white px-5 py-3 font-medium text-slate-950">
              View pilot offer <ArrowRight className="ml-2 size-4" />
            </Link>
            <Link href="#pricing" className="inline-flex items-center rounded-2xl border border-white/20 px-5 py-3 font-medium text-white/90">
              Pilot pricing
            </Link>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-sm text-white/60">Operator workflow</div>
              <div className="mt-2 text-2xl font-semibold">Draft → approval → schedule → recovery</div>
              <div className="mt-3 text-sm text-emerald-300">Built to win paid pilots before broadening channels.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-sm text-white/60">Hero channel</div>
              <div className="mt-2 text-2xl font-semibold">LinkedIn profiles and company pages</div>
              <div className="mt-3 text-sm text-white/70">Target selection, approvals, queue visibility, job detail, and recovery come before channel breadth.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
