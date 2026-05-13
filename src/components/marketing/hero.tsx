import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-slate-950 px-8 py-16 text-white shadow-[0_30px_120px_rgba(15,23,42,0.28)] lg:px-14 lg:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
      <div className="relative grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80 backdrop-blur">
            <CheckCircle2 className="size-4" /> LinkedIn-led revenue workflow · human-in-the-loop
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Turn expertise into LinkedIn-led campaigns, lead conversations, and booked-call workflows.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Repurly helps consultants, agencies, and B2B operators plan campaigns, draft content, manage approvals, track CTAs,
            and run safer human-approved follow-up without scraping, automated DMs, or fake engagement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#pricing" className="inline-flex items-center rounded-2xl bg-white px-5 py-3 font-medium text-slate-950">
              See pricing <ArrowRight className="ml-2 size-4" />
            </a>
            <Link href="/app/growth-os" className="inline-flex items-center rounded-2xl border border-white/20 px-5 py-3 font-medium text-white/90">
              View Growth OS
            </Link>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-sm text-white/60">Core workflow</div>
              <div className="mt-2 text-2xl font-semibold">Idea → campaign → CTA → lead follow-up</div>
              <div className="mt-3 text-sm text-emerald-300">Built for responsible LinkedIn-led revenue workflows, not spam automation.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-sm text-white/60">Operational coverage</div>
              <div className="mt-2 text-2xl font-semibold">Brands, offers, approvals, leads, and reports</div>
              <div className="mt-3 text-sm text-white/70">Start internally, prove pipeline impact, then sell pilots and assisted content operations.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
