import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-slate-950 px-8 py-16 text-white shadow-[0_30px_120px_rgba(15,23,42,0.28)] lg:px-14 lg:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
      <div className="relative grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80 backdrop-blur">
            <CheckCircle2 className="size-4" /> Daily LinkedIn Opportunity Desk
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Know who to reply to, who to follow up, what to ignore and what to post next.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Repurly turns messy LinkedIn notifications, comments, analytics and profile signals into a daily action plan for consultants, founders and expert-led businesses.
          </p>
          <p className="mt-4 max-w-2xl rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/82">
            Repurly drafts. You approve. You post or send. Repurly logs and learns. No risky auto-DMs, comments or connection requests.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#pricing" className="inline-flex items-center rounded-2xl bg-white px-5 py-3 font-medium text-slate-950">
              See beta pricing <ArrowRight className="ml-2 size-4" />
            </a>
            <Link href="/sign-up?plan=core" className="inline-flex items-center rounded-2xl border border-white/20 px-5 py-3 font-medium text-white/90">
              Join private beta
            </Link>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-sm text-white/60">Daily workflow</div>
              <div className="mt-2 text-2xl font-semibold">Review → reply → follow up → log → learn</div>
              <div className="mt-3 text-sm text-emerald-300">Built for relationship-led LinkedIn, not generic content volume.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-sm text-white/60">Opportunity desk</div>
              <div className="mt-2 text-2xl font-semibold">Replies, relationships, analytics and next posts</div>
              <div className="mt-3 text-sm text-white/70">Paste what happened. Repurly ranks the signals, drafts the actions and keeps the tracker updated after you approve.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
